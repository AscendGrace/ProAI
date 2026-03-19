import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

export type Db = Awaited<ReturnType<typeof openDb>>

function getDbPath() {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  return path.resolve(__dirname, '..', 'data', 'proai.db')
}

export async function openDb() {
  const filename = getDbPath()
  await fs.mkdir(path.dirname(filename), { recursive: true })
  const db = await open({
    filename,
    driver: sqlite3.Database,
  })
  await db.exec('PRAGMA foreign_keys = ON;')
  await migrate(db)
  return db
}

async function migrate(db: Awaited<ReturnType<typeof open>>) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      library TEXT NOT NULL,
      riskType TEXT NOT NULL,
      riskSubType TEXT,
      prompt TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_prompts_library ON prompts(library);
    CREATE INDEX IF NOT EXISTS idx_prompts_riskType ON prompts(riskType);
    CREATE INDEX IF NOT EXISTS idx_prompts_riskSubType ON prompts(riskSubType);

    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      standard TEXT NOT NULL,
      status TEXT NOT NULL,
      targetProvider TEXT NOT NULL,
      targetBaseUrl TEXT NOT NULL,
      targetApiKey TEXT,
      targetModel TEXT,
      createdAt INTEGER NOT NULL,
      startedAt INTEGER,
      finishedAt INTEGER,
      totalCount INTEGER NOT NULL DEFAULT 0,
      passCount INTEGER NOT NULL DEFAULT 0,
      failCount INTEGER NOT NULL DEFAULT 0,
      passRate REAL NOT NULL DEFAULT 0,
      error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_evaluations_createdAt ON evaluations(createdAt);
    CREATE INDEX IF NOT EXISTS idx_evaluations_standard ON evaluations(standard);
    CREATE INDEX IF NOT EXISTS idx_evaluations_status ON evaluations(status);

    CREATE TABLE IF NOT EXISTS evaluation_items (
      id TEXT PRIMARY KEY,
      evaluationId TEXT NOT NULL,
      promptId TEXT,
      inputPrompt TEXT NOT NULL,
      riskType TEXT NOT NULL,
      modelOutput TEXT NOT NULL,
      evaluatorScore INTEGER,
      evaluatorRawOutput TEXT,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (evaluationId) REFERENCES evaluations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_eval_items_evalId ON evaluation_items(evaluationId);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mcp_scans (
      id TEXT PRIMARY KEY,
      name TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      original_filename TEXT NOT NULL,
      status TEXT NOT NULL,
      progress_stage TEXT NOT NULL,
      progress_percent INTEGER NOT NULL,
      error TEXT,
      options TEXT NOT NULL,
      logs TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_mcp_scans_created_at ON mcp_scans(created_at);

    CREATE TABLE IF NOT EXISTS mcp_reports (
      scan_id TEXT PRIMARY KEY,
      generated_at INTEGER NOT NULL,
      project_info TEXT NOT NULL,
      findings TEXT NOT NULL,
      score_total INTEGER NOT NULL,
      score_risk_level TEXT NOT NULL,
      markdown TEXT NOT NULL,
      FOREIGN KEY (scan_id) REFERENCES mcp_scans(id) ON DELETE CASCADE
    );
  `)

  // 检查并添加 riskSubType 列（如果不存在）
  const columns = await db.all<Array<{ name: string }>>('PRAGMA table_info(prompts);')
  const hasRiskSubType = columns.some(col => col.name === 'riskSubType')
  if (!hasRiskSubType) {
    await db.exec('ALTER TABLE prompts ADD COLUMN riskSubType TEXT;')
    await db.exec('CREATE INDEX IF NOT EXISTS idx_prompts_riskSubType ON prompts(riskSubType);')
  }

  // 检查并添加 evaluation_items 表的 riskSubType 列
  const evalItemColumns = await db.all<Array<{ name: string }>>('PRAGMA table_info(evaluation_items);')
  const hasEvalItemRiskSubType = evalItemColumns.some(col => col.name === 'riskSubType')
  if (!hasEvalItemRiskSubType) {
    await db.exec('ALTER TABLE evaluation_items ADD COLUMN riskSubType TEXT;')
  }
}
