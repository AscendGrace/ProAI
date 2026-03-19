import { promises as fs } from 'fs';
import path from 'path';
import type { ScanStore } from '../scanStore';
import type { ScanOptions, ScanReport, Vulnerability } from '../types';
import { callLlm } from '../util/llmAdapter';
import { buildFileTree, pickKeyFiles, readFileLimited } from '../util/projectContext';
import { safeParseJsonArray } from '../util/safeJson';
import { auditPrompt, systemPrompt } from './prompts';

export async function runAiAudit(input: {
  rootDir: string;
  project: ScanReport['project'];
  scanStore: ScanStore;
  scanId: string;
  userPrompt?: string;
  options?: ScanOptions;
}): Promise<Vulnerability[]> {
  const { rootDir, project, scanStore, scanId, userPrompt, options } = input;

  const language: 'zh' | 'en' =
    options?.language ?? (process.env.OUTPUT_LANGUAGE === 'en' ? 'en' : 'zh');

  const fileTree = await buildFileTree(rootDir, { maxLines: 500 });
  const keyFilePaths = await pickKeyFiles(rootDir);
  const keyFiles = [];
  for (const p of keyFilePaths) {
    const content = await readFileLimited(path.join(rootDir, p), 2400);
    keyFiles.push({ path: p, content });
  }

  const projectSummary = JSON.stringify(project, null, 2);

  scanStore.log(scanId, 'info', `Auditing ${keyFiles.length} key files`);

  const prompt = auditPrompt({
    language,
    projectSummary,
    fileTree,
    keyFiles,
    userPrompt,
  });

  const completion = await callLlm({
    roleSystem: systemPrompt(language),
    user: prompt,
    modelHint: 'coding',
    temperature: 0.2,
    options,
  });

  await fs.writeFile(path.join(rootDir, '.mcpscan_audit_raw.txt'), completion, 'utf8');

  const parsed = safeParseJsonArray(completion);
  const findings = parsed.map((f, idx) => normalizeFinding(f, idx));
  scanStore.log(scanId, 'info', `Initial findings: ${findings.length}`);

  return findings;
}

function normalizeFinding(raw: unknown, idx: number): Vulnerability {
  const fallback: Vulnerability = {
    id: `F-${idx + 1}`,
    title: 'Unparsed finding',
    category: 'unknown',
    severity: 'info',
    status: 'needs_review',
    description: '',
    impact: '',
    evidence: [],
    exploitation: '',
    remediation: '',
    confidence: 0.1,
    notes: 'Model output could not be parsed into a valid object',
  };

  if (!raw || typeof raw !== 'object') {
    return fallback;
  }
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' && o.id.trim() ? o.id : fallback.id;

  const evidence = Array.isArray(o.evidence)
    ? o.evidence
        .filter((e) => e && typeof e === 'object')
        .map((e) => {
          const ev = e as Record<string, unknown>;
          return {
            file: typeof ev.file === 'string' ? ev.file : 'unknown',
            lineStart: typeof ev.lineStart === 'number' ? ev.lineStart : undefined,
            lineEnd: typeof ev.lineEnd === 'number' ? ev.lineEnd : undefined,
            snippet: typeof ev.snippet === 'string' ? ev.snippet : undefined,
          };
        })
    : [];

  const severity = ((): Vulnerability['severity'] => {
    const s = typeof o.severity === 'string' ? o.severity.toLowerCase() : '';
    if (s === 'critical' || s === 'high' || s === 'medium' || s === 'low' || s === 'info') {
      return s;
    }
    return fallback.severity;
  })();

  const status = ((): Vulnerability['status'] => {
    const s = typeof o.status === 'string' ? o.status : '';
    if (s === 'confirmed' || s === 'likely' || s === 'needs_review' || s === 'false_positive') {
      return s;
    }
    return fallback.status;
  })();

  const confidence = typeof o.confidence === 'number' ? clamp01(o.confidence) : fallback.confidence;

  return {
    id,
    title: typeof o.title === 'string' ? o.title : fallback.title,
    category: typeof o.category === 'string' ? o.category : fallback.category,
    severity,
    status,
    description: typeof o.description === 'string' ? o.description : fallback.description,
    impact: typeof o.impact === 'string' ? o.impact : fallback.impact,
    evidence,
    exploitation: typeof o.exploitation === 'string' ? o.exploitation : fallback.exploitation,
    remediation: typeof o.remediation === 'string' ? o.remediation : fallback.remediation,
    confidence,
    notes: typeof o.notes === 'string' ? o.notes : undefined,
  };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) {
    return 0;
  }
  if (n < 0) {
    return 0;
  }
  if (n > 1) {
    return 1;
  }
  return n;
}
