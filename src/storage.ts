import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const defaultPath = path.join(process.cwd(), "data", "tutor.db");
const dbPath = process.env.DB_PATH ?? defaultPath;

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    summary TEXT,
    difficulty TEXT,
    mode TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

// Add message_id column if it doesn't exist (migration for existing databases)
try {
  db.exec(`ALTER TABLE messages ADD COLUMN message_id TEXT`);
} catch {
  // Column already exists, ignore
}

const insertMessage = db.prepare(
  "INSERT INTO messages (message_id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)"
);

export const saveMessage = (messageId: string, sessionId: string, role: string, content: string) => {
  insertMessage.run(messageId, sessionId, role, content, new Date().toISOString());
};

export interface SessionSummary {
  session_id: string;
  message_count: number;
  started_at: string;
  last_message_at: string;
}

export const getSessionHistory = (limit = 10): SessionSummary[] => {
  const stmt = db.prepare(`
    SELECT 
      session_id,
      COUNT(*) as message_count,
      MIN(created_at) as started_at,
      MAX(created_at) as last_message_at
    FROM messages
    GROUP BY session_id
    ORDER BY MAX(created_at) DESC
    LIMIT ?
  `);
  return stmt.all(limit) as SessionSummary[];
};

export interface StoredMessage {
  id: number;
  message_id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
}

export const getSessionMessages = (sessionId: string): StoredMessage[] => {
  const stmt = db.prepare(`
    SELECT id, message_id, session_id, role, content, created_at
    FROM messages
    WHERE session_id = ?
    ORDER BY created_at ASC
  `);
  return stmt.all(sessionId) as StoredMessage[];
};

export const sessionExists = (sessionId: string): boolean => {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM messages WHERE session_id = ?
  `);
  const result = stmt.get(sessionId) as { count: number };
  return result.count > 0;
};

export interface SessionRecord {
  session_id: string;
  summary: string | null;
  difficulty: string | null;
  mode: string | null;
  created_at: string;
  updated_at: string;
}

const upsertSession = db.prepare(`
  INSERT INTO sessions (session_id, summary, difficulty, mode, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(session_id) DO UPDATE SET
    summary = COALESCE(excluded.summary, sessions.summary),
    difficulty = COALESCE(excluded.difficulty, sessions.difficulty),
    mode = COALESCE(excluded.mode, sessions.mode),
    updated_at = excluded.updated_at
`);

export const saveSession = (
  sessionId: string,
  options: { summary?: string; difficulty?: string; mode?: string } = {}
): void => {
  const now = new Date().toISOString();
  upsertSession.run(
    sessionId,
    options.summary ?? null,
    options.difficulty ?? null,
    options.mode ?? null,
    now,
    now
  );
};

export const updateSessionSummary = (sessionId: string, summary: string): void => {
  const stmt = db.prepare(`
    UPDATE sessions SET summary = ?, updated_at = ? WHERE session_id = ?
  `);
  const now = new Date().toISOString();
  const result = stmt.run(summary, now, sessionId);
  if (result.changes === 0) {
    saveSession(sessionId, { summary });
  }
};

export const getSession = (sessionId: string): SessionRecord | null => {
  const stmt = db.prepare(`
    SELECT session_id, summary, difficulty, mode, created_at, updated_at
    FROM sessions WHERE session_id = ?
  `);
  return (stmt.get(sessionId) as SessionRecord) ?? null;
};

export const getSessionWithSummary = (sessionId: string): SessionSummary & { summary: string | null } | null => {
  const stmt = db.prepare(`
    SELECT 
      m.session_id,
      COUNT(*) as message_count,
      MIN(m.created_at) as started_at,
      MAX(m.created_at) as last_message_at,
      s.summary
    FROM messages m
    LEFT JOIN sessions s ON m.session_id = s.session_id
    WHERE m.session_id = ?
    GROUP BY m.session_id
  `);
  return (stmt.get(sessionId) as SessionSummary & { summary: string | null }) ?? null;
};

export const getSessionHistoryWithSummaries = (limit = 10): (SessionSummary & { summary: string | null })[] => {
  const stmt = db.prepare(`
    SELECT 
      m.session_id,
      COUNT(*) as message_count,
      MIN(m.created_at) as started_at,
      MAX(m.created_at) as last_message_at,
      s.summary
    FROM messages m
    LEFT JOIN sessions s ON m.session_id = s.session_id
    GROUP BY m.session_id
    ORDER BY MAX(m.created_at) DESC
    LIMIT ?
  `);
  return stmt.all(limit) as (SessionSummary & { summary: string | null })[];
};

// Vocabulary tables
db.exec(`
  CREATE TABLE IF NOT EXISTS vocabulary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL,
    definition TEXT,
    example TEXT,
    collection TEXT DEFAULT 'default',
    mastery_level INTEGER DEFAULT 0,
    times_reviewed INTEGER DEFAULT 0,
    last_reviewed_at TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(word, collection)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS collections (
    name TEXT PRIMARY KEY,
    description TEXT,
    created_at TEXT NOT NULL
  )
`);

export interface VocabItem {
  id: number;
  word: string;
  definition: string | null;
  example: string | null;
  collection: string;
  mastery_level: number;
  times_reviewed: number;
  last_reviewed_at: string | null;
  created_at: string;
}

export interface VocabCollection {
  name: string;
  description: string | null;
  created_at: string;
  word_count?: number;
}

const insertVocab = db.prepare(`
  INSERT INTO vocabulary (word, definition, example, collection, created_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(word, collection) DO UPDATE SET
    definition = COALESCE(excluded.definition, vocabulary.definition),
    example = COALESCE(excluded.example, vocabulary.example)
`);

export const saveVocabItem = (
  word: string,
  options: { definition?: string; example?: string; collection?: string } = {}
): void => {
  const now = new Date().toISOString();
  insertVocab.run(
    word.toLowerCase().trim(),
    options.definition ?? null,
    options.example ?? null,
    options.collection ?? "default",
    now
  );
};

export const saveVocabItems = (
  words: string[],
  collection = "default"
): number => {
  const now = new Date().toISOString();
  let saved = 0;
  for (const word of words) {
    const trimmed = word.toLowerCase().trim();
    if (trimmed) {
      insertVocab.run(trimmed, null, null, collection, now);
      saved++;
    }
  }
  return saved;
};

export const getVocabByCollection = (collection = "default", limit = 50): VocabItem[] => {
  const stmt = db.prepare(`
    SELECT * FROM vocabulary
    WHERE collection = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(collection, limit) as VocabItem[];
};

export const getAllVocab = (limit = 100): VocabItem[] => {
  const stmt = db.prepare(`
    SELECT * FROM vocabulary
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(limit) as VocabItem[];
};

export const getVocabForPractice = (collection?: string, limit = 10): VocabItem[] => {
  const stmt = collection
    ? db.prepare(`
        SELECT * FROM vocabulary
        WHERE collection = ?
        ORDER BY mastery_level ASC, times_reviewed ASC, RANDOM()
        LIMIT ?
      `)
    : db.prepare(`
        SELECT * FROM vocabulary
        ORDER BY mastery_level ASC, times_reviewed ASC, RANDOM()
        LIMIT ?
      `);
  return (collection ? stmt.all(collection, limit) : stmt.all(limit)) as VocabItem[];
};

export const updateVocabMastery = (id: number, correct: boolean): void => {
  const stmt = db.prepare(`
    UPDATE vocabulary SET
      mastery_level = mastery_level + ?,
      times_reviewed = times_reviewed + 1,
      last_reviewed_at = ?
    WHERE id = ?
  `);
  const delta = correct ? 1 : -1;
  const now = new Date().toISOString();
  stmt.run(delta, now, id);
};

export const deleteVocabItem = (id: number): boolean => {
  const stmt = db.prepare(`DELETE FROM vocabulary WHERE id = ?`);
  const result = stmt.run(id);
  return result.changes > 0;
};

export const getCollections = (): VocabCollection[] => {
  const stmt = db.prepare(`
    SELECT 
      c.name,
      c.description,
      c.created_at,
      COUNT(v.id) as word_count
    FROM collections c
    LEFT JOIN vocabulary v ON c.name = v.collection
    GROUP BY c.name
    ORDER BY c.created_at DESC
  `);
  return stmt.all() as VocabCollection[];
};

export const createCollection = (name: string, description?: string): void => {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO collections (name, description, created_at)
    VALUES (?, ?, ?)
  `);
  stmt.run(name.toLowerCase().trim(), description ?? null, new Date().toISOString());
};

export const deleteCollection = (name: string): { deleted: boolean; wordsRemoved: number } => {
  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM vocabulary WHERE collection = ?`);
  const count = (countStmt.get(name) as { count: number }).count;
  
  const deleteVocabStmt = db.prepare(`DELETE FROM vocabulary WHERE collection = ?`);
  deleteVocabStmt.run(name);
  
  const deleteCollectionStmt = db.prepare(`DELETE FROM collections WHERE name = ?`);
  const result = deleteCollectionStmt.run(name);
  
  return { deleted: result.changes > 0, wordsRemoved: count };
};

export const getVocabStats = (): { total: number; mastered: number; learning: number; collections: number } => {
  const totalStmt = db.prepare(`SELECT COUNT(*) as count FROM vocabulary`);
  const total = (totalStmt.get() as { count: number }).count;
  
  const masteredStmt = db.prepare(`SELECT COUNT(*) as count FROM vocabulary WHERE mastery_level >= 3`);
  const mastered = (masteredStmt.get() as { count: number }).count;
  
  const collectionsStmt = db.prepare(`SELECT COUNT(DISTINCT collection) as count FROM vocabulary`);
  const collections = (collectionsStmt.get() as { count: number }).count;
  
  return { total, mastered, learning: total - mastered, collections };
};
