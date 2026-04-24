'use strict';

/**
 * Factory that reads the DB_DRIVER environment variable and returns the
 * correct database adapter together with pre-wired repository instances.
 *
 * Supported drivers (case-insensitive):
 *   sqlite  — better-sqlite3  (default)
 *   mysql   — mysql2/promise
 *   mariadb — mysql2/promise  (alias for mysql)
 *   pg      — pg (PostgreSQL)
 *   postgres
 *
 * Usage:
 *   const { adapter, repos, initDatabase } = require('./repositories');
 *   await initDatabase();
 *   const user = await repos.users.findById(1);
 */

const UserRepository    = require('./UserRepository');
const TeamRepository    = require('./TeamRepository');
const ProjectRepository = require('./ProjectRepository');
const OrganizationRepository = require('./OrganizationRepository');

let _adapter = null;
let _repos   = null;

function createAdapter() {
  const driver = (process.env.DB_DRIVER || 'sqlite').toLowerCase();

  if (driver === 'sqlite') {
    const SqliteAdapter = require('./adapters/SqliteAdapter');
    return new SqliteAdapter();
  }

  if (driver === 'mysql' || driver === 'mariadb') {
    const MysqlAdapter = require('./adapters/MysqlAdapter');
    return new MysqlAdapter();
  }

  if (driver === 'pg' || driver === 'postgres' || driver === 'postgresql') {
    const PgAdapter = require('./adapters/PgAdapter');
    return new PgAdapter();
  }

  throw new Error(
    `Unknown DB_DRIVER "${driver}". Supported values: sqlite, mysql, mariadb, pg, postgres.`
  );
}

function getAdapter() {
  if (!_adapter) _adapter = createAdapter();
  return _adapter;
}

function getRepos() {
  if (!_repos) {
    const db = getAdapter();
    _repos = {
      users:    new UserRepository(db),
      teams:    new TeamRepository(db),
      projects: new ProjectRepository(db),
      organizations: new OrganizationRepository(db),
    };
  }
  return _repos;
}

async function initDatabase() {
  await getAdapter().init();
}

module.exports = { getAdapter, getRepos, initDatabase };
