'use strict';

/**
 * Factory that reads DB_DRIVER and returns the PostgreSQL adapter plus
 * pre-wired repository instances.
 *
 * Supported drivers (case-insensitive):
 *   pg, postgres, postgresql
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
const SubscriptionRepository = require('./SubscriptionRepository');

/** @type {import('./adapters/PgAdapter') | null} */
let _adapter = null;

/** @type {{users: UserRepository, teams: TeamRepository, projects: ProjectRepository, organizations: OrganizationRepository, subscriptions: SubscriptionRepository} | null} */
let _repos = null;

function createAdapter() {
  const driver = (process.env.DB_DRIVER || 'pg').toLowerCase();

  if (driver === 'pg' || driver === 'postgres' || driver === 'postgresql') {
    const PgAdapter = require('./adapters/PgAdapter');
    return new PgAdapter();
  }

  throw new Error(
    `Unsupported DB_DRIVER "${driver}". This application supports only PostgreSQL (pg/postgres/postgresql).`
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
      subscriptions: new SubscriptionRepository(db),
    };
  }
  return _repos;
}

async function initDatabase() {
  await getAdapter().init();
}

module.exports = { getAdapter, getRepos, initDatabase };
