'use strict';

/**
 * Migration 001 - Initial schema (PostgreSQL only).
 *
 * Creation order respects FK dependencies:
 *  1. users
 *  2. organizations
 *  3. teams
 *  4. organization_members
 *  5. organization_invitations
 *  6. team_members
 *  7. team_invitations
 *  8. projects
 *  9. tasks
 * 10. task_assignees
 * 11. plan_history
 */

module.exports = {
  up: {
    /** @param {{execute: (sql: string, params?: unknown[]) => Promise<unknown>}} db */
    async pg(db) {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id            SERIAL       PRIMARY KEY,
          email         VARCHAR(255) UNIQUE NOT NULL,
          username      VARCHAR(255) NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role          VARCHAR(50)  NOT NULL DEFAULT 'member',
          created_at    TIMESTAMPTZ  DEFAULT NOW()
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS organizations (
          id         SERIAL       PRIMARY KEY,
          name       VARCHAR(255) NOT NULL,
          owner_id   INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          plan       VARCHAR(20)  NOT NULL DEFAULT 'free',
          created_at TIMESTAMPTZ  DEFAULT NOW()
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS teams (
          id              SERIAL       PRIMARY KEY,
          name            VARCHAR(255) NOT NULL,
          leader_id       INTEGER      NOT NULL,
          organization_id INTEGER      NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          created_at      TIMESTAMPTZ  DEFAULT NOW()
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS organization_members (
          user_id         INTEGER     NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
          organization_id INTEGER     NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          role            VARCHAR(50) NOT NULL DEFAULT 'member',
          created_at      TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (user_id, organization_id)
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS organization_invitations (
          id              SERIAL       PRIMARY KEY,
          organization_id INTEGER      NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          created_by      INTEGER      NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
          token           VARCHAR(255) UNIQUE NOT NULL,
          expires_at      TIMESTAMPTZ  NOT NULL,
          created_at      TIMESTAMPTZ  DEFAULT NOW()
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS team_members (
          user_id    INTEGER     NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
          team_id    INTEGER     NOT NULL REFERENCES teams(id)  ON DELETE CASCADE,
          role       VARCHAR(50) NOT NULL DEFAULT 'member',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (user_id, team_id)
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS team_invitations (
          id         SERIAL       PRIMARY KEY,
          team_id    INTEGER      NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
          created_by INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token      VARCHAR(255) UNIQUE NOT NULL,
          expires_at TIMESTAMPTZ  NOT NULL,
          created_at TIMESTAMPTZ  DEFAULT NOW()
        )
      `);

      await db.execute(`
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
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS tasks (
          id              SERIAL       PRIMARY KEY,
          project_id      INTEGER      NOT NULL REFERENCES projects(id),
          name            VARCHAR(255) NOT NULL,
          description     TEXT         DEFAULT '',
          start_date      DATE         NOT NULL,
          end_date        DATE         NOT NULL,
          progress        INTEGER      NOT NULL DEFAULT 0,
          color           VARCHAR(20)  NOT NULL DEFAULT '#e94560',
          parent_id       INTEGER      REFERENCES tasks(id),
          assigned_to     INTEGER      REFERENCES users(id),
          created_by      INTEGER      NOT NULL REFERENCES users(id),
          status          VARCHAR(50)  NOT NULL DEFAULT 'pending',
          sort_order      INTEGER      NOT NULL DEFAULT 0,
          estimated_hours INTEGER      NOT NULL DEFAULT 0,
          created_at      TIMESTAMPTZ  DEFAULT NOW()
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS task_assignees (
          task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          PRIMARY KEY (task_id, user_id)
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS plan_history (
          id              SERIAL       PRIMARY KEY,
          organization_id INTEGER      NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          plan            VARCHAR(20)  NOT NULL,
          changed_by      INTEGER      REFERENCES users(id),
          changed_at      TIMESTAMPTZ  DEFAULT NOW()
        )
      `);
    },
  },
};
