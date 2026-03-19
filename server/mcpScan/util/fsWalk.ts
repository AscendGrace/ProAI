import { promises as fs } from 'fs';
import path from 'path';

export async function listFilesRecursive(
  rootDir: string,
  limits: { maxFiles: number; maxTotalBytes: number },
): Promise<Array<{ relativePath: string; size: number }>> {
  const out: Array<{ relativePath: string; size: number }> = [];
  let totalBytes = 0;

  const visit = async (dir: string): Promise<void> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (out.length >= limits.maxFiles) {
        return;
      }
      const abs = path.join(dir, ent.name);
      const rel = path.relative(rootDir, abs).replaceAll('\\', '/');
      if (ent.isDirectory()) {
        if (
          ent.name === 'node_modules' ||
          ent.name === '.git' ||
          ent.name === 'dist' ||
          ent.name === 'build'
        ) {
          continue;
        }
        await visit(abs);
      } else if (ent.isFile()) {
        try {
          const st = await fs.stat(abs);
          totalBytes += st.size;
          if (totalBytes > limits.maxTotalBytes) {
            return;
          }
          out.push({ relativePath: rel, size: st.size });
        } catch {
          continue;
        }
      }
    }
  };

  await visit(rootDir);
  return out;
}
