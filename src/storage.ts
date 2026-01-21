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
    title TEXT,
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

try {
  db.exec(`ALTER TABLE sessions ADD COLUMN title TEXT`);
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
  title?: string | null;
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
  title: string | null;
  summary: string | null;
  difficulty: string | null;
  mode: string | null;
  created_at: string;
  updated_at: string;
}

const upsertSession = db.prepare(`
  INSERT INTO sessions (session_id, title, summary, difficulty, mode, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(session_id) DO UPDATE SET
    title = COALESCE(excluded.title, sessions.title),
    summary = COALESCE(excluded.summary, sessions.summary),
    difficulty = COALESCE(excluded.difficulty, sessions.difficulty),
    mode = COALESCE(excluded.mode, sessions.mode),
    updated_at = excluded.updated_at
`);

export const saveSession = (
  sessionId: string,
  options: { title?: string; summary?: string; difficulty?: string; mode?: string } = {}
): void => {
  const now = new Date().toISOString();
  upsertSession.run(
    sessionId,
    options.title ?? null,
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

export const updateSessionTitle = (sessionId: string, title: string): void => {
  const stmt = db.prepare(`
    UPDATE sessions SET title = ?, updated_at = ? WHERE session_id = ?
  `);
  const now = new Date().toISOString();
  const result = stmt.run(title, now, sessionId);
  if (result.changes === 0) {
    saveSession(sessionId, { title });
  }
};

export const getSession = (sessionId: string): SessionRecord | null => {
  const stmt = db.prepare(`
    SELECT session_id, title, summary, difficulty, mode, created_at, updated_at
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
      s.title,
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
      s.title,
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

export interface LearningStats {
  sessions: {
    total: number;
    thisWeek: number;
    thisMonth: number;
  };
  messages: {
    total: number;
    userMessages: number;
    assistantMessages: number;
    avgPerSession: number;
  };
  vocabulary: {
    total: number;
    mastered: number;
    learning: number;
    reviewedToday: number;
    totalReviews: number;
  };
  streaks: {
    currentStreak: number;
    longestStreak: number;
    lastActiveDate: string | null;
  };
  practice: {
    mostUsedMode: string | null;
    modeBreakdown: Record<string, number>;
  };
}

export const getLearningStats = (): LearningStats => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const totalSessionsStmt = db.prepare(`SELECT COUNT(DISTINCT session_id) as count FROM messages`);
  const totalSessions = (totalSessionsStmt.get() as { count: number }).count;

  const weekSessionsStmt = db.prepare(`
    SELECT COUNT(DISTINCT session_id) as count FROM messages WHERE created_at >= ?
  `);
  const weekSessions = (weekSessionsStmt.get(weekAgo) as { count: number }).count;

  const monthSessionsStmt = db.prepare(`
    SELECT COUNT(DISTINCT session_id) as count FROM messages WHERE created_at >= ?
  `);
  const monthSessions = (monthSessionsStmt.get(monthAgo) as { count: number }).count;

  const totalMessagesStmt = db.prepare(`SELECT COUNT(*) as count FROM messages`);
  const totalMessages = (totalMessagesStmt.get() as { count: number }).count;

  const userMessagesStmt = db.prepare(`SELECT COUNT(*) as count FROM messages WHERE role = 'user'`);
  const userMessages = (userMessagesStmt.get() as { count: number }).count;

  const assistantMessagesStmt = db.prepare(`SELECT COUNT(*) as count FROM messages WHERE role = 'assistant'`);
  const assistantMessages = (assistantMessagesStmt.get() as { count: number }).count;

  const avgPerSession = totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0;

  const vocabTotalStmt = db.prepare(`SELECT COUNT(*) as count FROM vocabulary`);
  const vocabTotal = (vocabTotalStmt.get() as { count: number }).count;

  const vocabMasteredStmt = db.prepare(`SELECT COUNT(*) as count FROM vocabulary WHERE mastery_level >= 3`);
  const vocabMastered = (vocabMasteredStmt.get() as { count: number }).count;

  const reviewedTodayStmt = db.prepare(`
    SELECT COUNT(*) as count FROM vocabulary WHERE last_reviewed_at >= ?
  `);
  const reviewedToday = (reviewedTodayStmt.get(todayStart) as { count: number }).count;

  const totalReviewsStmt = db.prepare(`SELECT SUM(times_reviewed) as total FROM vocabulary`);
  const totalReviews = (totalReviewsStmt.get() as { total: number | null }).total ?? 0;

  const activeDaysStmt = db.prepare(`
    SELECT DISTINCT DATE(created_at) as day FROM messages ORDER BY day DESC LIMIT 365
  `);
  const activeDays = (activeDaysStmt.all() as { day: string }[]).map(r => r.day);
  
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  if (activeDays.length > 0) {
    const isActiveRecently = activeDays[0] === today || activeDays[0] === yesterday;
    
    for (let i = 0; i < activeDays.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const prevDay = new Date(activeDays[i - 1]);
        const currDay = new Date(activeDays[i]);
        const diffDays = Math.round((prevDay.getTime() - currDay.getTime()) / (24 * 60 * 60 * 1000));
        
        if (diffDays === 1) {
          tempStreak++;
        } else {
          if (isActiveRecently && currentStreak === 0) {
            currentStreak = tempStreak;
          }
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      }
    }
    
    longestStreak = Math.max(longestStreak, tempStreak);
    if (isActiveRecently && currentStreak === 0) {
      currentStreak = tempStreak;
    }
  }

  const lastActiveDate = activeDays.length > 0 ? activeDays[0] : null;

  const modeStmt = db.prepare(`
    SELECT mode, COUNT(*) as count FROM sessions WHERE mode IS NOT NULL GROUP BY mode ORDER BY count DESC
  `);
  const modeResults = modeStmt.all() as { mode: string; count: number }[];
  
  const modeBreakdown: Record<string, number> = {};
  let mostUsedMode: string | null = null;
  
  for (const row of modeResults) {
    modeBreakdown[row.mode] = row.count;
    if (!mostUsedMode) {
      mostUsedMode = row.mode;
    }
  }

  return {
    sessions: {
      total: totalSessions,
      thisWeek: weekSessions,
      thisMonth: monthSessions,
    },
    messages: {
      total: totalMessages,
      userMessages,
      assistantMessages,
      avgPerSession,
    },
    vocabulary: {
      total: vocabTotal,
      mastered: vocabMastered,
      learning: vocabTotal - vocabMastered,
      reviewedToday,
      totalReviews,
    },
    streaks: {
      currentStreak,
      longestStreak,
      lastActiveDate,
    },
    practice: {
      mostUsedMode,
      modeBreakdown,
    },
  };
};
