import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'data', 'test-tutor.db');

describe('storage functions', () => {
  let db: Database.Database;

  beforeEach(() => {
    fs.mkdirSync(path.dirname(TEST_DB_PATH), { recursive: true });
    
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    
    db = new Database(TEST_DB_PATH);
    
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
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('messages', () => {
    it('inserts and retrieves messages', () => {
      const insertStmt = db.prepare(
        'INSERT INTO messages (message_id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
      );
      insertStmt.run('msg-1', 'session-1', 'user', 'Hello', new Date().toISOString());
      insertStmt.run('msg-2', 'session-1', 'assistant', 'Hi!', new Date().toISOString());

      const selectStmt = db.prepare('SELECT * FROM messages WHERE session_id = ?');
      const messages = selectStmt.all('session-1');

      expect(messages).toHaveLength(2);
    });

    it('counts messages per session', () => {
      const insertStmt = db.prepare(
        'INSERT INTO messages (message_id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
      );
      insertStmt.run('msg-1', 'session-1', 'user', 'Hello', new Date().toISOString());
      insertStmt.run('msg-2', 'session-1', 'assistant', 'Hi!', new Date().toISOString());
      insertStmt.run('msg-3', 'session-2', 'user', 'Bye', new Date().toISOString());

      const countStmt = db.prepare(
        'SELECT session_id, COUNT(*) as count FROM messages GROUP BY session_id'
      );
      const counts = countStmt.all() as { session_id: string; count: number }[];

      expect(counts).toHaveLength(2);
      expect(counts.find(c => c.session_id === 'session-1')?.count).toBe(2);
      expect(counts.find(c => c.session_id === 'session-2')?.count).toBe(1);
    });
  });

  describe('vocabulary', () => {
    it('inserts vocabulary items', () => {
      const insertStmt = db.prepare(
        'INSERT INTO vocabulary (word, collection, created_at) VALUES (?, ?, ?)'
      );
      insertStmt.run('hello', 'default', new Date().toISOString());
      insertStmt.run('world', 'default', new Date().toISOString());

      const countStmt = db.prepare('SELECT COUNT(*) as count FROM vocabulary');
      const result = countStmt.get() as { count: number };

      expect(result.count).toBe(2);
    });

    it('tracks mastery levels', () => {
      const insertStmt = db.prepare(
        'INSERT INTO vocabulary (word, collection, mastery_level, created_at) VALUES (?, ?, ?, ?)'
      );
      insertStmt.run('easy', 'default', 5, new Date().toISOString());
      insertStmt.run('hard', 'default', 1, new Date().toISOString());

      const masteredStmt = db.prepare(
        'SELECT COUNT(*) as count FROM vocabulary WHERE mastery_level >= 3'
      );
      const mastered = masteredStmt.get() as { count: number };

      expect(mastered.count).toBe(1);
    });

    it('groups by collection', () => {
      const insertStmt = db.prepare(
        'INSERT INTO vocabulary (word, collection, created_at) VALUES (?, ?, ?)'
      );
      insertStmt.run('apple', 'fruits', new Date().toISOString());
      insertStmt.run('banana', 'fruits', new Date().toISOString());
      insertStmt.run('car', 'vehicles', new Date().toISOString());

      const groupStmt = db.prepare(
        'SELECT collection, COUNT(*) as count FROM vocabulary GROUP BY collection'
      );
      const groups = groupStmt.all() as { collection: string; count: number }[];

      expect(groups).toHaveLength(2);
      expect(groups.find(g => g.collection === 'fruits')?.count).toBe(2);
      expect(groups.find(g => g.collection === 'vehicles')?.count).toBe(1);
    });
  });

  describe('sessions', () => {
    it('stores session with summary', () => {
      const insertStmt = db.prepare(
        'INSERT INTO sessions (session_id, summary, created_at, updated_at) VALUES (?, ?, ?, ?)'
      );
      const now = new Date().toISOString();
      insertStmt.run('session-1', 'A practice session about grammar', now, now);

      const selectStmt = db.prepare('SELECT * FROM sessions WHERE session_id = ?');
      const session = selectStmt.get('session-1') as { session_id: string; summary: string };

      expect(session.summary).toBe('A practice session about grammar');
    });
  });
});
