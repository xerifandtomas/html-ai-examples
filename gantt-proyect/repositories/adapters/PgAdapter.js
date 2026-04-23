'use strict';

const { Pool } = require('pg');

/**
 * Adapter for PostgreSQL using the `pg` connection pool.
 *
 * Key differences from SQLite/MySQL that this adapter handles internally:
 *   1. Positional parameters ($1, $2, …) instead of `?` placeholders.
 *   2. INSERT must include `RETURNING id` to retrieve the generated PK.
 *   3. Connection-level transaction management.
 *
 * Environment variables:
 *   DB_HOST     (default: localhost)
 *   DB_PORT     (default: 5432)
 *   DB_USER     (default: gantt)
 *   DB_PASSWORD (default: gantt)
 *   DB_NAME     (default: gantt)
 */
class PgAdapter {
  constructor() {
    this._pool = new Pool({
      host:     process.env.DB_HOST     || 'localhost',
      port: parseInt(process.env.DB_PORT     || '5432', 10),
      user:     process.env.DB_USER     || 'gantt',
      password: process.env.DB_PASSWORD || 'gantt',
      database: process.env.DB_NAME     || 'gantt',
      max: 10,
    });
  }

  /**
   * Converts `?` placeholders to PostgreSQL positional `$N` parameters.
   * e.g. "WHERE id = ? AND role = ?" → "WHERE id = $1 AND role = $2"
   */
  _toPositional(sql) {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  }

  /** Returns all matching rows. */
  async query(sql, params = []) {
    const { rows } = await this._pool.query(this._toPositional(sql), params);
    return rows;
  }

  /** Returns the first matching row or null. */
  async queryOne(sql, params = []) {
    const { rows } = await this._pool.query(this._toPositional(sql), params);
    return rows[0] ?? null;
  }

  /** Executes a non-SELECT statement. Returns { changes }. */
  async execute(sql, params = []) {
    const result = await this._pool.query(this._toPositional(sql), params);
    return { changes: result.rowCount };
  }

  /**
   * Executes an INSERT statement and returns the new row's id.
   * Appends `RETURNING id` automatically if not present.
   */
  async insert(sql, params = []) {
    const baseSql = sql.replace(/;\s*$/, '');
    const pgSql = /RETURNING\s+/i.test(baseSql)
      ? this._toPositional(baseSql)
      : this._toPositional(`${baseSql} RETURNING id`);
    const { rows } = await this._pool.query(pgSql, params);
    return rows[0].id;
  }

  /**
   * Runs `fn(txAdapter)` inside a BEGIN/COMMIT/ROLLBACK block on a
   * dedicated client so the transaction is properly isolated.
   */
  async transaction(fn) {
    const client = await this._pool.connect();
    const self = this;
    const txAdapter = {
      query:    async (sql, params = []) => { const { rows }   = await client.query(self._toPositional(sql), params); return rows; },
      queryOne: async (sql, params = []) => { const { rows }   = await client.query(self._toPositional(sql), params); return rows[0] ?? null; },
      execute:  async (sql, params = []) => { const result     = await client.query(self._toPositional(sql), params); return { changes: result.rowCount }; },
      insert:   async (sql, params = []) => {
        const baseSql = sql.replace(/;\s*$/, '');
        const pgSql = /RETURNING\s+/i.test(baseSql)
          ? self._toPositional(baseSql)
          : self._toPositional(`${baseSql} RETURNING id`);
        const { rows } = await client.query(pgSql, params);
        return rows[0].id;
      },
      transaction: (innerFn) => innerFn(txAdapter), // reuse same client
    };
    try {
      await client.query('BEGIN');
      const result = await fn(txAdapter);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Creates all tables if they do not exist. */
  async init() {
    await this._pool.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id         SERIAL      PRIMARY KEY,
        name       VARCHAR(255) NOT NULL,
        leader_id  INTEGER      NOT NULL,
        created_at TIMESTAMPTZ  DEFAULT NOW()
      );
    `);
    await this._pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL       PRIMARY KEY,
        email         VARCHAR(255) UNIQUE NOT NULL,
        username      VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role          VARCHAR(50)  NOT NULL DEFAULT 'member',
        team_id       INTEGER      REFERENCES teams(id),
        created_at    TIMESTAMPTZ  DEFAULT NOW()
      );
    `);
    await this._pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id          SERIAL       PRIMARY KEY,
        name        VARCHAR(255) NOT NULL,
        description TEXT         DEFAULT '',
        start_date  DATE         NOT NULL,
        end_date    DATE         NOT NULL,
        team_id     INTEGER      NOT NULL REFERENCES teams(id),
        created_by  INTEGER      NOT NULL REFERENCES users(id),
        status      VARCHAR(50)  NOT NULL DEFAULT 'active',
        created_at  TIMESTAMPTZ  DEFAULT NOW()
      );
    `);
    await this._pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id          SERIAL      PRIMARY KEY,
        project_id  INTEGER     NOT NULL REFERENCES projects(id),
        name        VARCHAR(255) NOT NULL,
        description TEXT        DEFAULT '',
        start_date  DATE        NOT NULL,
        end_date    DATE        NOT NULL,
        progress    INTEGER     NOT NULL DEFAULT 0,
        color       VARCHAR(20) NOT NULL DEFAULT '#e94560',
        parent_id   INTEGER     REFERENCES tasks(id),
        assigned_to INTEGER     REFERENCES users(id),
        created_by  INTEGER     NOT NULL REFERENCES users(id),
        status      VARCHAR(50) NOT NULL DEFAULT 'pending',
        sort_order  INTEGER     NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('[DB] PostgreSQL schema ready.');
  }

  async close() {
    await this._pool.end();
  }
}

module.exports = PgAdapter;
