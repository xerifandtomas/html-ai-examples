'use strict';

const fs   = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

const CREATE_TRACKING = `CREATE TABLE IF NOT EXISTS schema_migrations (
  id     SERIAL PRIMARY KEY,
  name   VARCHAR(255) NOT NULL UNIQUE,
  ran_at TIMESTAMPTZ DEFAULT NOW()
)`;

class MigrationRunner {
  /**
   * Runs all pending migrations in alphabetical order.
   * @param {object} adapter  - A PostgreSQL adapter instance.
   * @param {'pg'} dialect
   */
  static async run(adapter, dialect) {
    if (dialect !== 'pg') {
      throw new Error(`Unsupported migration dialect "${dialect}". Only "pg" is allowed.`);
    }

    // 1. Ensure tracking table exists.
    await adapter.execute(CREATE_TRACKING);

    // 2. Fetch already-applied migrations.
    const ran = new Set(
      (await adapter.query('SELECT name FROM schema_migrations ORDER BY name')).map(r => r.name)
    );

    // 3. List migration files sorted numerically.
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => /^\d+.*\.js$/.test(f))
      .sort();

    // 4. Apply pending migrations.
    for (const file of files) {
      if (ran.has(file)) continue;

      const migration = require(path.join(MIGRATIONS_DIR, file));
      if (!migration.up || typeof migration.up.pg !== 'function') {
        throw new Error(`Migration ${file} must expose up.pg(db).`);
      }

      console.log(`[DB] Running migration: ${file}`);

      await adapter.transaction(async (tx) => {
        await migration.up.pg(tx);
        await tx.execute('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      });

      console.log(`[DB] Migration applied: ${file}`);
    }
  }
}

module.exports = MigrationRunner;
