import { promises as fs } from 'fs';
import path from 'path';
import type { ScanStore } from '../scanStore';
import type { ScanReport } from '../types';
import { listFilesRecursive } from '../util/fsWalk';
import { sniffProject } from '../util/projectSniffer';

export async function analyzeProject(input: {
  rootDir: string;
  scanStore: ScanStore;
  scanId: string;
}): Promise<ScanReport['project']> {
  const { rootDir, scanStore, scanId } = input;
  const files = await listFilesRecursive(rootDir, {
    maxFiles: 6000,
    maxTotalBytes: 80 * 1024 * 1024,
  });

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const rootName = path.basename(rootDir);
  const sniff = await sniffProject(
    rootDir,
    files.map((f) => f.relativePath),
  );

  scanStore.log(
    scanId,
    'info',
    `Project files: ${files.length}, total size: ${Math.round(totalBytes / 1024)} KB`,
  );
  scanStore.log(
    scanId,
    'info',
    `Languages: ${sniff.languages.join(', ') || 'unknown'}; Frameworks: ${sniff.frameworks.join(', ') || 'unknown'}`,
  );

  await fs.writeFile(
    path.join(rootDir, '.mcpscan_project.json'),
    JSON.stringify(
      { rootName, ...sniff, fileStats: { totalFiles: files.length, totalBytes } },
      null,
      2,
    ),
    'utf8',
  );

  return {
    rootName,
    languages: sniff.languages,
    frameworks: sniff.frameworks,
    mcpIndicators: sniff.mcpIndicators,
    fileStats: {
      totalFiles: files.length,
      totalBytes,
    },
  };
}
