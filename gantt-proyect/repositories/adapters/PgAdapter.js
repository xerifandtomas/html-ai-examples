'use strict';

const { Pool }        = require('pg');
const MigrationRunner = require('../MigrationRunner');

/**
 * Adapter for PostgreSQL using the `pg` connection pool.
 *
 * Key PostgreSQL behavior handled by this adapter:
 *   1. Positional parameters ($1, $2, ...) instead of `?` placeholders.
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
    * @param {string} sql
   */
  _toPositional(sql) {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  }

  /** Returns all matching rows. */
  /** @param {string} sql @param {unknown[]} [params=[]] */
  async query(sql, params = []) {
    const { rows } = await this._pool.query(this._toPositional(sql), params);
    return rows;
  }

  /** Returns the first matching row or null. */
  /** @param {string} sql @param {unknown[]} [params=[]] */
  async queryOne(sql, params = []) {
    const { rows } = await this._pool.query(this._toPositional(sql), params);
    return rows[0] ?? null;
  }

  /** Executes a non-SELECT statement. Returns { changes }. */
  /** @param {string} sql @param {unknown[]} [params=[]] */
  async execute(sql, params = []) {
    const result = await this._pool.query(this._toPositional(sql), params);
    return { changes: result.rowCount || 0 };
  }

  /**
   * Executes an INSERT statement and returns the new row's id.
   * Appends `RETURNING id` automatically if not present.
  * @param {string} sql
  * @param {unknown[]} [params=[]]
   */
  async insert(sql, params = []) {
    const baseSql = sql.replace(/;\s*$/, '');
    const pgSql = /RETURNING\s+/i.test(baseSql)
      ? this._toPositional(baseSql)
      : this._toPositional(`${baseSql} RETURNING id`);
    const { rows } = await this._pool.query(pgSql, params);
    const insertRows = /** @type {{id: number}[]} */ (rows);
    if (!insertRows[0] || insertRows[0].id == null) {
      throw new Error('INSERT did not return an id. Ensure SQL includes RETURNING id.');
    }
    return insertRows[0].id;
  }

  /**
   * Runs `fn(txAdapter)` inside a BEGIN/COMMIT/ROLLBACK block on a
   * dedicated client so the transaction is properly isolated.
   * @param {any} fn
   */
  async transaction(fn) {
    const client = await this._pool.connect();
    const self = this;
    /** @type {any} */
    const txAdapter = {
      query:    async (/** @type {string} */ sql, /** @type {unknown[]} */ params = []) => { const { rows }   = await client.query(self._toPositional(sql), params); return rows; },
      queryOne: async (/** @type {string} */ sql, /** @type {unknown[]} */ params = []) => { const { rows }   = await client.query(self._toPositional(sql), params); return rows[0] ?? null; },
      execute:  async (/** @type {string} */ sql, /** @type {unknown[]} */ params = []) => { const result     = await client.query(self._toPositional(sql), params); return { changes: result.rowCount || 0 }; },
      insert:   async (/** @type {string} */ sql, /** @type {unknown[]} */ params = []) => {
        const baseSql = sql.replace(/;\s*$/, '');
        const pgSql = /RETURNING\s+/i.test(baseSql)
          ? self._toPositional(baseSql)
          : self._toPositional(`${baseSql} RETURNING id`);
        const { rows } = await client.query(pgSql, params);
        const insertRows = /** @type {{id: number}[]} */ (rows);
        if (!insertRows[0] || insertRows[0].id == null) {
          throw new Error('INSERT did not return an id. Ensure SQL includes RETURNING id.');
        }
        return insertRows[0].id;
      },
      /** @param {(txAdapter: unknown) => Promise<unknown>} innerFn */
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

  /** Runs all pending migrations and creates tables if they do not exist. */
  async init() {
    await MigrationRunner.run(this, 'pg');
    console.log('[DB] PostgreSQL schema ready.');
  }

  async close() {
    await this._pool.end();
  }
}

module.exports = PgAdapter;
