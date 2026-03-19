import path from 'path';
import { promises as fs } from 'fs';
import type { Vulnerability } from '../types';
import { listFilesRecursive } from './fsWalk';

const AUTH_HINTS = [
  'auth',
  'authenticate',
  'authorization',
  'authorize',
  'permission',
  'rbac',
  'jwt',
  'token',
  'session',
  'middleware',
  'guard',
  'acl',
  'role',
];

export async function buildRelatedCodeBundle(input: {
  rootDir: string;
  finding: Vulnerability;
  maxFiles: number;
  maxCharsPerFile: number;
}): Promise<Array<{ path: string; content: string }>> {
  const { rootDir, finding, maxFiles, maxCharsPerFile } = input;
  const fileSet = new Set<string>();
  const snippets: Array<{ file: string; content: string }> = [];

  for (const ev of finding.evidence) {
    if (ev.file && typeof ev.file === 'string') {
      fileSet.add(ev.file);
    }
  }

  const files = await listFilesRecursive(rootDir, { maxFiles: 5000, maxTotalBytes: 80 * 1024 * 1024 });
  const rels = files.map((f) => f.relativePath);

  const identifierHints = new Set<string>();
  for (const ev of finding.evidence) {
    if (!ev.file) {
      continue;
    }
    try {
      const abs = path.join(rootDir, ev.file);
      const window = await readWindow(abs, ev.lineStart, ev.lineEnd, { maxChars: maxCharsPerFile });
      snippets.push({ file: ev.file, content: window });
      for (const id of extractIdentifiers(window)) {
        identifierHints.add(id);
      }
    } catch {
      continue;
    }
  }

  const hinted = rels
    .filter((p) => AUTH_HINTS.some((h) => p.toLowerCase().includes(h)) || p.toLowerCase().includes('route'))
    .slice(0, maxFiles);

  for (const p of hinted) {
    fileSet.add(p);
  }

  const callChainHits = pickCallChainFiles(rels, identifierHints, maxFiles);
  for (const p of callChainHits) {
    fileSet.add(p);
  }

  const picked = [...fileSet].slice(0, Math.max(0, maxFiles - snippets.length));
  const out: Array<{ path: string; content: string }> = [];

  for (const s of snippets) {
    out.push({ path: s.file, content: s.content });
  }

  for (const rel of picked) {
    const abs = path.join(rootDir, rel);
    try {
      const content = await readLimited(abs, maxCharsPerFile);
      out.push({ path: rel, content });
    } catch {
      continue;
    }
  }

  return out.slice(0, maxFiles);
}

async function readLimited(absPath: string, maxChars: number): Promise<string> {
  const buf = await fs.readFile(absPath);
  const s = buf.toString('utf8');
  if (s.length <= maxChars) {
    return s;
  }
  return s.slice(0, maxChars) + '\n...[truncated]';
}

async function readWindow(
  absPath: string,
  lineStart: number | undefined,
  lineEnd: number | undefined,
  opts: { maxChars: number },
): Promise<string> {
  const raw = await fs.readFile(absPath, 'utf8');
  if (!lineStart || lineStart < 1) {
    return raw.length <= opts.maxChars ? raw : raw.slice(0, opts.maxChars) + '\n...[truncated]';
  }
  const lines = raw.split(/\r?\n/);
  const start = Math.max(0, lineStart - 1 - 30);
  const end = Math.min(lines.length, (lineEnd ?? lineStart) + 30);
  const window = lines.slice(start, end).join('\n');
  if (window.length <= opts.maxChars) {
    return window;
  }
  return window.slice(0, opts.maxChars) + '\n...[truncated]';
}

function extractIdentifiers(content: string): string[] {
  const ids = content.match(/[A-Za-z_][A-Za-z0-9_]{2,}/g) ?? [];
  const deny = new Set([
    'const',
    'let',
    'var',
    'function',
    'return',
    'class',
    'export',
    'import',
    'from',
    'if',
    'else',
    'for',
    'while',
    'try',
    'catch',
    'finally',
    'await',
    'async',
    'new',
    'throw',
    'true',
    'false',
    'null',
    'undefined',
    'this',
    'super',
  ]);
  const out: string[] = [];
  for (const id of ids) {
    if (deny.has(id)) {
      continue;
    }
    if (id.length > 40) {
      continue;
    }
    out.push(id);
  }
  return [...new Set(out)].slice(0, 24);
}

function pickCallChainFiles(allFiles: string[], ids: Set<string>, limit: number): string[] {
  const idList = [...ids].filter((x) => x.length >= 3).slice(0, 20);
  if (!idList.length) {
    return [];
  }

  const scored: Array<{ file: string; score: number }> = [];
  for (const f of allFiles) {
    const lower = f.toLowerCase();
    if (!/\.(ts|js|tsx|jsx|py)$/.test(lower)) {
      continue;
    }
    let score = 0;
    for (const id of idList) {
      const idLower = id.toLowerCase();
      if (lower.includes(idLower)) {
        score += 2;
      }
    }
    if (lower.includes('route') || lower.includes('router')) {
      score += 3;
    }
    if (lower.includes('auth') || lower.includes('middleware') || lower.includes('guard')) {
      score += 3;
    }
    if (score > 0) {
      scored.push({ file: f, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.min(limit, 10)).map((x) => x.file);
}
