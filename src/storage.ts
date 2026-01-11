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
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);

const insertMessage = db.prepare(
  "INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)"
);

export const saveMessage = (sessionId: string, role: string, content: string) => {
  insertMessage.run(sessionId, role, content, new Date().toISOString());
};
