'use strict';
const crypto = require('crypto');

/**
 * TeamRepository — team and member management.
 */
class TeamRepository {
  constructor(adapter) {
    this.db = adapter;
  }

  async findAll(organizationId) {
    return this.db.query(`
      SELECT t.*, u.username AS leader_name
      FROM teams t
      LEFT JOIN users u ON u.id = t.leader_id
      WHERE t.organization_id = ?
    `, [organizationId]);
  }

  async findById(id, organizationId) {
    return this.db.queryOne(
      `SELECT t.*, u.username AS leader_name
       FROM teams t
       LEFT JOIN users u ON u.id = t.leader_id
       WHERE t.id = ? AND t.organization_id = ?`,
      [id, organizationId]
    );
  }

  async findByLeaderOrMember(userId, teamId, organizationId) {
    return this.db.queryOne(
      `SELECT t.*, u.username AS leader_name
       FROM teams t
       LEFT JOIN users u ON u.id = t.leader_id
       WHERE t.id = ? AND t.organization_id = ?`,
      [teamId, organizationId]
    );
  }

  /** Create team and assign the creator as leader — atomically. */
  async createWithLeader(name, leaderId, leaderCurrentRole, organizationId) {
    return this.db.transaction(async (tx) => {
      const teamRepo = new TeamRepository(tx);
      const teamId = await teamRepo._insert(name, leaderId, tx, organizationId);
      const newRole = leaderCurrentRole === 'admin' ? 'admin' : 'team_leader';
      await teamRepo.addMember(leaderId, teamId, newRole);
      return teamId;
    });
  }

  /** Low-level insert used inside transactions. */
  async _insert(name, leaderId, txAdapter, organizationId) {
    const db = txAdapter || this.db;
    return db.insert(
      'INSERT INTO teams (name, leader_id, organization_id) VALUES (?, ?, ?)',
      [name, leaderId, organizationId]
    );
  }

  async findMembers(teamId) {
    return this.db.query(
      `SELECT u.id, u.email, u.username, tm.role, tm.created_at
       FROM users u
       JOIN team_members tm ON u.id = tm.user_id
       WHERE tm.team_id = ?`,
      [teamId]
    );
  }

  async addMember(userId, teamId, role) {
    await this.db.execute(
      'INSERT INTO team_members (user_id, team_id, role) VALUES (?, ?, ?)',
      [userId, teamId, role]
    );
  }

  async removeMember(userId, teamId) {
    await this.db.execute(
      'DELETE FROM team_members WHERE user_id = ? AND team_id = ?',
      [userId, teamId]
    );
  }

  async findUserTeams(userId, organizationId) {
    return this.db.query(
      `SELECT t.*, tm.role
       FROM teams t
       JOIN team_members tm ON t.id = tm.team_id
       WHERE tm.user_id = ? AND t.organization_id = ?`,
      [userId, organizationId]
    );
  }

  async isUserMember(userId, teamId) {
    const r = await this.db.queryOne(
      'SELECT 1 FROM team_members WHERE user_id = ? AND team_id = ?',
      [userId, teamId]
    );
    return r != null;
  }

  async isUserTeamLeader(userId, teamId) {
    const r = await this.db.queryOne(
      "SELECT 1 FROM team_members WHERE user_id = ? AND team_id = ? AND role IN ('team_leader', 'admin')",
      [userId, teamId]
    );
    return r != null;
  }

  async createInvitation(teamId, inviterId) {
    const token = crypto.randomBytes(20).toString('hex');
    const expires = new Date();
    expires.setDate(expires.getDate() + 7); // 7 day validity

    await this.db.insert(
      'INSERT INTO team_invitations (team_id, created_by, token, expires_at) VALUES (?, ?, ?, ?)',
      [teamId, inviterId, token, expires.toISOString()]
    );
    return token;
  }

  async findInvitationByToken(token) {
    return this.db.queryOne('SELECT * FROM team_invitations WHERE token = ?', [token]);
  }

  async deleteInvitation(token) {
    await this.db.execute('DELETE FROM team_invitations WHERE token = ?', [token]);
  }
}

module.exports = TeamRepository;
