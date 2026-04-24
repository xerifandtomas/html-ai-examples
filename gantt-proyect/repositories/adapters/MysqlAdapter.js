'use strict';

const mysql = require('mysql2/promise');

/**
 * Adapter for MySQL / MariaDB using mysql2/promise connection pool.
 *
 * Environment variables:
 *   DB_HOST     (default: localhost)
 *   DB_PORT     (default: 3306)
 *   DB_USER     (default: gantt)
 *   DB_PASSWORD (default: gantt)
 *   DB_NAME     (default: gantt)
 */
class MysqlAdapter {
  constructor() {
    this._pool = mysql.createPool({
      host:              process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT     || '3306', 10),
      user:              process.env.DB_USER     || 'gantt',
      password:          process.env.DB_PASSWORD || 'gantt',
      database:          process.env.DB_NAME     || 'gantt',
      waitForConnections: true,
      connectionLimit:    10,
      queueLimit:         0,
      timezone:           'Z',
    });
  }

  /** Returns all matching rows. */
  async query(sql, params = []) {
    const [rows] = await this._pool.query(sql, params);
    return rows;
  }

  /** Returns the first matching row or null. */
  async queryOne(sql, params = []) {
    const [rows] = await this._pool.query(sql, params);
    return rows[0] ?? null;
  }

  /** Executes a non-SELECT statement. Returns { changes }. */
  async execute(sql, params = []) {
    const [result] = await this._pool.execute(sql, params);
    return { changes: result.affectedRows };
  }

  /**
   * Executes an INSERT statement and returns the new row's id.
   * MySQL returns insertId directly from the result metadata.
   */
  async insert(sql, params = []) {
    const [result] = await this._pool.execute(sql, params);
    return result.insertId;
  }

  /**
   * Runs `fn(txAdapter)` inside a BEGIN/COMMIT/ROLLBACK block on a
   * dedicated connection so the transaction is properly isolated.
   */
  async transaction(fn) {
    const conn = await this._pool.getConnection();
    const txAdapter = {
      query:    async (sql, params = []) => { const [rows]   = await conn.query(sql, params);   return rows; },
      queryOne: async (sql, params = []) => { const [rows]   = await conn.query(sql, params);   return rows[0] ?? null; },
      execute:  async (sql, params = []) => { const [result] = await conn.execute(sql, params); return { changes: result.affectedRows }; },
      insert:   async (sql, params = []) => { const [result] = await conn.execute(sql, params); return result.insertId; },
      transaction: (innerFn) => innerFn(txAdapter), // reuse same connection for nested calls
    };
    try {
      await conn.beginTransaction();
      const result = await fn(txAdapter);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /** Creates all tables if they do not exist. */
  async init() {
    const conn = await this._pool.getConnection();
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS teams (
          id         INT AUTO_INCREMENT PRIMARY KEY,
          name       VARCHAR(255) NOT NULL,
          leader_id  INT          NOT NULL,
          created_at DATETIME     DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS users (
          id            INT AUTO_INCREMENT PRIMARY KEY,
          email         VARCHAR(255) UNIQUE NOT NULL,
          username      VARCHAR(255)        NOT NULL,
          password_hash VARCHAR(255)        NOT NULL,
          role          VARCHAR(50)         NOT NULL DEFAULT 'member',
          team_id       INT,
          created_at    DATETIME            DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (team_id) REFERENCES teams(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS projects (
          id          INT AUTO_INCREMENT PRIMARY KEY,
          name        VARCHAR(255) NOT NULL,
          description TEXT         DEFAULT '',
          start_date  DATE         NOT NULL,
          end_date    DATE         NOT NULL,
          team_id     INT          NOT NULL,
          created_by  INT          NOT NULL,
          status      VARCHAR(50)  NOT NULL DEFAULT 'active',
          created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (team_id)    REFERENCES teams(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS tasks (
          id          INT AUTO_INCREMENT PRIMARY KEY,
          project_id  INT          NOT NULL,
          name        VARCHAR(255) NOT NULL,
          description TEXT         DEFAULT '',
          start_date  DATE         NOT NULL,
          end_date    DATE         NOT NULL,
          progress    INT          NOT NULL DEFAULT 0,
          color       VARCHAR(20)  NOT NULL DEFAULT '#e94560',
          parent_id   INT,
          assigned_to INT,
          created_by  INT          NOT NULL,
          status      VARCHAR(50)  NOT NULL DEFAULT 'pending',
          sort_order  INT          NOT NULL DEFAULT 0,
          created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id)  REFERENCES projects(id),
          FOREIGN KEY (parent_id)   REFERENCES tasks(id),
          FOREIGN KEY (assigned_to) REFERENCES users(id),
          FOREIGN KEY (created_by)  REFERENCES users(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      // Idempotent migrations
      try { await conn.query("ALTER TABLE organizations ADD COLUMN plan VARCHAR(20) NOT NULL DEFAULT 'free'"); } catch {}
      try { await conn.query('ALTER TABLE tasks ADD COLUMN estimated_hours INT NOT NULL DEFAULT 0'); } catch {}
      await conn.query(`
        CREATE TABLE IF NOT EXISTS plan_history (
          id              INT AUTO_INCREMENT PRIMARY KEY,
          organization_id INT     NOT NULL,
          plan            VARCHAR(20) NOT NULL,
          changed_by      INT,
          changed_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log('[DB] MySQL/MariaDB schema ready.');
    } finally {
      conn.release();
    }
  }

  async close() {
    await this._pool.end();
  }
}

module.exports = MysqlAdapter;
