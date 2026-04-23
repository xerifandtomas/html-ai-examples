/**
 * database.js — thin compatibility shim.
 *
 * All schema management and query access is now handled by the repository
 * layer in ./repositories/. This file simply re-exports the helpers that
 * server.js and any legacy callers expect.
 */
const { getAdapter, getRepos, initDatabase } = require('./repositories');

module.exports = { getAdapter, getRepos, initDatabase };
