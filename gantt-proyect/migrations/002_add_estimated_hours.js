'use strict';

/**
 * Migration 002 — Add estimated_hours column to tasks.
 */

module.exports = {
  up: {
    /** @param {{execute: (sql: string, params?: unknown[]) => Promise<unknown>}} db */
    async pg(db) {
      await db.execute('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours INTEGER NOT NULL DEFAULT 0');
    },
  },
};
