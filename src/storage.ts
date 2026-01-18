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
