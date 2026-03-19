export function systemPrompt(language: 'zh' | 'en'): string {
  if (language === 'en') {
    return [
      'You are an expert security auditor for MCP Servers.',
      'Work like an autonomous code-scanning agent:',
      '1) gather project info, 2) audit code, 3) extract vulnerabilities, 4) review exploitability, 5) produce a report.',
      'Be precise, cite evidence, and avoid guessing.',
    ].join('\n');
  }
  return [
    '你是 MCP Server 的资深安全审计专家。',
    '以自动化扫描 Agent 的方式工作：',
    '1) 信息收集 2) 代码审计 3) 漏洞整理 4) 可利用性复核 5) 输出报告。',
    '结论必须基于证据，避免臆测。',
  ].join('\n');
}

export function auditPrompt(input: {
  language: 'zh' | 'en';
  projectSummary: string;
  fileTree: string;
  keyFiles: Array<{ path: string; content: string }>;
  userPrompt?: string;
}): string {
  const base =
    input.language === 'en'
      ? [
          'Audit the MCP Server project for security risks.',
          'Focus on MCP-specific risks and common web/app vulnerabilities.',
          'Return a JSON array of findings (no markdown).',
        ]
      : [
          '审计该 MCP Server 项目的安全风险。',
          '重点关注 MCP 场景风险 + 常见应用漏洞。',
          '只输出 JSON 数组（不要 markdown）。',
          '重要：所有字段内容必须使用中文输出，包括 title、description、impact、exploitation、remediation 等。',
        ];

  const schema =
    input.language === 'en'
      ? [
          'Each finding must be:',
          '{ id, title, category, severity, status, description, impact, evidence[], exploitation, remediation, confidence, notes? }',
          'severity: critical|high|medium|low|info; status: needs_review|likely|confirmed|false_positive',
          'evidence item: { file, lineStart?, lineEnd?, snippet? }',
          'confidence: 0..1',
        ]
      : [
          '每条漏洞必须包含：',
          '{ id, title, category, severity, status, description, impact, evidence[], exploitation, remediation, confidence, notes? }',
          'severity: critical|high|medium|low|info; status: needs_review|likely|confirmed|false_positive',
          'evidence: { file, lineStart?, lineEnd?, snippet? }',
          'confidence: 0..1',
        ];

  const extra = input.userPrompt?.trim()
    ? input.language === 'en'
      ? `Additional focus: ${input.userPrompt.trim()}`
      : `额外关注点：${input.userPrompt.trim()}`
    : '';

  const filesBlock = input.keyFiles
    .map((f) => `\n=== FILE: ${f.path} ===\n${f.content}\n`)
    .join('\n');

  return [
    ...base,
    ...schema,
    extra,
    '',
    'Project summary:',
    input.projectSummary,
    '',
    'Directory tree (partial):',
    input.fileTree,
    '',
    'Key files:',
    filesBlock,
  ]
    .filter(Boolean)
    .join('\n');
}

export function exploitabilityReviewPrompt(input: {
  language: 'zh' | 'en';
  findingJson: string;
  relatedCode: Array<{ path: string; content: string }>;
}): string {
  const base =
    input.language === 'en'
      ? [
          'Re-evaluate exploitability and false-positives for the following finding.',
          'Consider inter-procedural control flow: routing/handlers -> middleware/auth -> business -> sink.',
          'If an auth/permission check or sanitization is enforced for all paths, mark false_positive or downgrade severity.',
        ]
      : [
          '请对下面的漏洞做"可利用性复核"，重点降低组合调用导致的误报。',
          '必须考虑跨函数/跨文件调用链：路由/入口 -> middleware/auth -> 业务逻辑 -> 危险点。',
          '如果所有可达路径都强制执行了鉴权/权限/参数化查询/过滤，请标记为 false_positive 或降低严重性。',
        ];

  const output =
    input.language === 'en'
      ? [
          'Return a single JSON object with same schema as the finding, but updated fields.',
          'Keep id unchanged. Provide concise notes explaining the decision.',
        ]
      : ['只返回单个 JSON 对象，结构与原漏洞一致，但允许更新字段。', 'id 不变；notes 里给出简洁依据。'];

  const related = input.relatedCode
    .map((f) => `\n=== FILE: ${f.path} ===\n${f.content}\n`)
    .join('\n');

  return [...base, ...output, '', 'Finding:', input.findingJson, '', 'Related code:', related].join(
    '\n',
  );
}
