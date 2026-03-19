import { promises as fs } from 'fs';
import path from 'path';
import { listFilesRecursive } from './fsWalk';

export async function buildFileTree(rootDir: string, opts: { maxLines: number }): Promise<string> {
  const files = await listFilesRecursive(rootDir, { maxFiles: 4000, maxTotalBytes: 60 * 1024 * 1024 });
  const lines: string[] = [];
  for (const f of files) {
    lines.push(f.relativePath);
    if (lines.length >= opts.maxLines) {
      break;
    }
  }
  return lines.join('\n');
}

export async function pickKeyFiles(rootDir: string): Promise<string[]> {
  const candidates = [
    'package.json',
    'pyproject.toml',
    'requirements.txt',
    'README.md',
    'readme.md',
    'src/index.ts',
    'src/main.ts',
    'src/server.ts',
    'index.ts',
    'index.js',
    'main.py',
    'app.py',
    'server.py',
  ];
  const found: string[] = [];
  for (const rel of candidates) {
    try {
      await fs.stat(path.join(rootDir, rel));
      found.push(rel);
    } catch {
      continue;
    }
  }

  const files = await listFilesRecursive(rootDir, { maxFiles: 4000, maxTotalBytes: 60 * 1024 * 1024 });
  const interesting = files
    .map((f) => f.relativePath)
    .filter((p) => /\.(ts|js|py|go|java|rs)$/.test(p))
    .sort((a, b) => scorePath(b) - scorePath(a))
    .slice(0, 18);

  for (const p of interesting) {
    if (!found.includes(p)) {
      found.push(p);
    }
  }
  return found.slice(0, 20);
}

function scorePath(p: string): number {
  const lower = p.toLowerCase();
  let score = 0;
  if (/(^|\/)(index|main|app|server)\./.test(lower)) {
    score += 10;
  }
  if (lower.includes('route') || lower.includes('router')) {
    score += 6;
  }
  if (lower.includes('auth') || lower.includes('guard') || lower.includes('middleware')) {
    score += 6;
  }
  if (lower.includes('db') || lower.includes('sql') || lower.includes('query')) {
    score += 6;
  }
  if (lower.includes('tool') || lower.includes('mcp')) {
    score += 6;
  }
  if (/\.(ts|js)$/.test(lower)) {
    score += 2;
  }
  if (/\.(py)$/.test(lower)) {
    score += 2;
  }
  return score;
}

export async function readFileLimited(absPath: string, maxChars: number): Promise<string> {
  const buf = await fs.readFile(absPath);
  const s = buf.toString('utf8');
  if (s.length <= maxChars) {
    return s;
  }
  return s.slice(0, maxChars) + '\n...[truncated]';
}
