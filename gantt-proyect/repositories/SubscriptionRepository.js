'use strict';

class SubscriptionRepository {
  constructor(db) {
    this._db = db;
  }

  /** Returns the plan name for the given organization. */
  async getOrgPlan(orgId) {
    const row = await this._db.queryOne(
      'SELECT plan FROM organizations WHERE id = ?',
      [orgId]
    );
    return row ? row.plan : 'free';
  }

  /**
   * Updates the plan for an organization and records the change in plan_history.
   */
  async setOrgPlan(orgId, plan, changedBy) {
    await this._db.execute(
      'UPDATE organizations SET plan = ? WHERE id = ?',
      [plan, orgId]
    );
    await this._db.insert(
      'INSERT INTO plan_history (organization_id, plan, changed_by) VALUES (?, ?, ?)',
      [orgId, plan, changedBy || null]
    );
  }

  /** Number of teams in the given organization. */
  async countTeams(orgId) {
    const row = await this._db.queryOne(
      'SELECT COUNT(*) AS cnt FROM teams WHERE organization_id = ?',
      [orgId]
    );
    return row ? (row.cnt || row['COUNT(*)'] || 0) : 0;
  }

  /** Number of projects in the given team. */
  async countProjects(teamId) {
    const row = await this._db.queryOne(
      'SELECT COUNT(*) AS cnt FROM projects WHERE team_id = ?',
      [teamId]
    );
    return row ? (row.cnt || row['COUNT(*)'] || 0) : 0;
  }

  /** Number of tasks in the given project (not counting subtasks separately). */
  async countTasks(projectId) {
    const row = await this._db.queryOne(
      'SELECT COUNT(*) AS cnt FROM tasks WHERE project_id = ?',
      [projectId]
    );
    return row ? (row.cnt || row['COUNT(*)'] || 0) : 0;
  }

  /** Number of members in the given organization (all roles). */
  async countOrgMembers(orgId) {
    const row = await this._db.queryOne(
      'SELECT COUNT(*) AS cnt FROM organization_members WHERE organization_id = ?',
      [orgId]
    );
    return row ? (row.cnt || row['COUNT(*)'] || 0) : 0;
  }

  /** Number of members in the given team. */
  async countTeamMembers(teamId) {
    const row = await this._db.queryOne(
      'SELECT COUNT(*) AS cnt FROM team_members WHERE team_id = ?',
      [teamId]
    );
    return row ? (row.cnt || row['COUNT(*)'] || 0) : 0;
  }

  /**
   * Returns a summary of resource usage for an organization.
   * Used by the GET /current/plan endpoint.
   */
  async getOrgUsage(orgId) {
    const [teams, members] = await Promise.all([
      this.countTeams(orgId),
      this.countOrgMembers(orgId),
    ]);
    return { teams, orgMembers: members };
  }

  /**
   * Returns a list of all organizations with their plan and usage counts.
   * Used by the admin panel.
   */
  async listOrgsWithPlans() {
    return this._db.query(
      `SELECT o.id, o.name, o.plan, o.created_at,
              u.username AS owner_name, u.email AS owner_email,
              (SELECT COUNT(*) FROM teams t WHERE t.organization_id = o.id) AS team_count,
              (SELECT COUNT(*) FROM organization_members om WHERE om.organization_id = o.id) AS member_count
       FROM organizations o
       LEFT JOIN users u ON u.id = o.owner_id
       ORDER BY o.created_at DESC`,
      []
    );
  }
}

module.exports = SubscriptionRepository;
