'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

/**
 * Adapter for better-sqlite3.
 * All public methods return Promises so callers can use async/await uniformly.
 * Internally uses synchronous better-sqlite3 calls wrapped in resolved Promises.
 */
class SqliteAdapter {
  constructor() {
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'data', 'gantt.db');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this._db = new Database(dbPath);
    this._db.pragma('journal_mode = WAL');
    this._db.pragma('foreign_keys = ON');
  }

  /** Returns all matching rows. */
  async query(sql, params = []) {
    return this._db.prepare(sql).all(params);
  }

  /** Returns the first matching row or null. */
  async queryOne(sql, params = []) {
    return this._db.prepare(sql).get(params) ?? null;
  }

  /** Executes a non-SELECT statement (UPDATE/DELETE). Returns { changes }. */
  async execute(sql, params = []) {
    const r = this._db.prepare(sql).run(params);
    return { changes: r.changes };
  }

  /**
   * Executes an INSERT statement and returns the new row's id.
   * SQLite uses lastInsertRowid from the run() result.
   */
  async insert(sql, params = []) {
    const r = this._db.prepare(sql).run(params);
    return r.lastInsertRowid;
  }

  /**
   * Runs `fn(txAdapter)` inside a BEGIN/COMMIT/ROLLBACK block.
   * `txAdapter` exposes the same query/queryOne/execute/insert interface.
   * Because better-sqlite3 is synchronous, we manage the transaction
   * boundaries manually so `fn` can be async.
   */
  async transaction(fn) {
    this._db.prepare('BEGIN').run();
    try {
      const result = await fn(this);
      this._db.prepare('COMMIT').run();
      return result;
    } catch (err) {
      this._db.prepare('ROLLBACK').run();
      throw err;
    }
  }

  /** Creates all tables if they do not exist. */
  async init() {
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS organizations (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL,
        owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT    DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS organization_members (
        user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        role            TEXT    NOT NULL DEFAULT 'member',
        created_at      TEXT    DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, organization_id)
      );

      CREATE TABLE IF NOT EXISTS organization_invitations (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        created_by      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token           TEXT    UNIQUE NOT NULL,
        expires_at      TEXT    NOT NULL,
        created_at      TEXT    DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS teams (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        name            TEXT    NOT NULL,
        leader_id       INTEGER NOT NULL,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        created_at      TEXT    DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        email         TEXT    UNIQUE NOT NULL,
        username      TEXT    NOT NULL,
        password_hash TEXT    NOT NULL,
        role          TEXT    NOT NULL DEFAULT 'member',
        created_at    TEXT    DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS team_members (
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        team_id    INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        role       TEXT    NOT NULL DEFAULT 'member',
        created_at TEXT    DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, team_id)
      );

      CREATE TABLE IF NOT EXISTS team_invitations (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id    INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token      TEXT    UNIQUE NOT NULL,
        expires_at TEXT    NOT NULL,
        created_at TEXT    DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS projects (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        description TEXT    DEFAULT '',
        start_date  TEXT    NOT NULL,
        end_date    TEXT    NOT NULL,
        team_id     INTEGER NOT NULL REFERENCES teams(id),
        created_by  INTEGER NOT NULL REFERENCES users(id),
        status      TEXT    NOT NULL DEFAULT 'active',
        created_at  TEXT    DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id  INTEGER NOT NULL REFERENCES projects(id),
        name        TEXT    NOT NULL,
        description TEXT    DEFAULT '',
        start_date  TEXT    NOT NULL,
        end_date    TEXT    NOT NULL,
        progress    INTEGER NOT NULL DEFAULT 0,
        color       TEXT    NOT NULL DEFAULT '#e94560',
        parent_id   INTEGER REFERENCES tasks(id),
        assigned_to INTEGER REFERENCES users(id),
        created_by  INTEGER NOT NULL REFERENCES users(id),
        status      TEXT    NOT NULL DEFAULT 'pending',
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT    DEFAULT (datetime('now'))
      );
    `);
    console.log('[DB] SQLite schema ready.');
  }

  async close() {
    this._db.close();
  }
}

module.exports = SqliteAdapter;
