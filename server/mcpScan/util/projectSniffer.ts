import { promises as fs } from 'fs';
import path from 'path';

export async function sniffProject(
  rootDir: string,
  relativePaths: string[],
): Promise<{ languages: string[]; frameworks: string[]; mcpIndicators: string[] }> {
  const languages = new Set<string>();
  const frameworks = new Set<string>();
  const mcpIndicators = new Set<string>();

  const extLangMap: Record<string, string> = {
    '.ts': 'TypeScript', '.tsx': 'TypeScript',
    '.js': 'JavaScript', '.jsx': 'JavaScript',
    '.py': 'Python',
    '.go': 'Go',
    '.java': 'Java',
    '.rs': 'Rust',
    '.cpp': 'C++', '.cxx': 'C++', '.cc': 'C++', '.hpp': 'C++',
    '.c': 'C', '.h': 'C',
    '.cs': 'C#',
    '.php': 'PHP',
    '.rb': 'Ruby',
    '.kt': 'Kotlin', '.kts': 'Kotlin',
    '.swift': 'Swift',
    '.dart': 'Dart',
    '.scala': 'Scala',
    '.lua': 'Lua',
    '.r': 'R',
    '.sh': 'Shell',
  };

  for (const p of relativePaths) {
    const ext = path.extname(p).toLowerCase();
    const lang = extLangMap[ext];
    if (lang) {
      languages.add(lang);
    }
  }

  if (relativePaths.includes('package.json')) {
    try {
      const pkg = JSON.parse(
        await fs.readFile(path.join(rootDir, 'package.json'), 'utf8'),
      ) as Record<string, unknown>;
      const deps = {
        ...((pkg.dependencies as Record<string, string>) ?? {}),
        ...((pkg.devDependencies as Record<string, string>) ?? {}),
      };
      const depNames = Object.keys(deps);
      if (depNames.some((n) => n.includes('express'))) {
        frameworks.add('Express');
      }
      if (depNames.some((n) => n.includes('fastify'))) {
        frameworks.add('Fastify');
      }
      if (depNames.some((n) => n.includes('koa'))) {
        frameworks.add('Koa');
      }
      if (depNames.some((n) => n.includes('@modelcontextprotocol') || n === 'mcp')) {
        mcpIndicators.add('npm:mcp');
      }
      if (depNames.some((n) => n.includes('zod'))) {
        frameworks.add('Zod');
      }
    } catch {
      // Ignore parse errors
    }
  }

  if (relativePaths.includes('requirements.txt')) {
    try {
      const req = await fs.readFile(path.join(rootDir, 'requirements.txt'), 'utf8');
      if (/mcp/i.test(req)) {
        mcpIndicators.add('py:mcp');
      }
      if (/fastapi/i.test(req)) {
        frameworks.add('FastAPI');
      }
      if (/flask/i.test(req)) {
        frameworks.add('Flask');
      }
    } catch {
      // Ignore read errors
    }
  }

  if (relativePaths.some((p) => p.toLowerCase().includes('mcp'))) {
    mcpIndicators.add('path:mcp');
  }
  if (
    relativePaths.some((p) => p.endsWith('mcp.json') || p.endsWith('mcp.yaml') || p.endsWith('mcp.yml'))
  ) {
    mcpIndicators.add('config:mcp');
  }

  return {
    languages: [...languages],
    frameworks: [...frameworks],
    mcpIndicators: [...mcpIndicators],
  };
}
