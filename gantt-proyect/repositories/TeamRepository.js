'use strict';

/**
 * TeamRepository — team and member management.
 */
class TeamRepository {
  constructor(adapter) {
    this.db = adapter;
  }

  async findAll() {
    return this.db.query(`
      SELECT t.*, u.username AS leader_name
      FROM teams t
      LEFT JOIN users u ON u.id = t.leader_id
    `);
  }

  async findById(id) {
    return this.db.queryOne(
      `SELECT t.*, u.username AS leader_name
       FROM teams t
       LEFT JOIN users u ON u.id = t.leader_id
       WHERE t.id = ?`,
      [id]
    );
  }

  async findByLeaderOrMember(userId, teamId) {
    return this.db.queryOne(
      `SELECT t.*, u.username AS leader_name
       FROM teams t
       LEFT JOIN users u ON u.id = t.leader_id
       WHERE t.id = ?`,
      [teamId]
    );
  }

  /** Create team and assign the creator as leader — atomically. */
  async createWithLeader(name, leaderId, leaderCurrentRole) {
    return this.db.transaction(async (tx) => {
      const teamRepo = new TeamRepository(tx);
      const UserRepository = require('./UserRepository');
      const userRepo = new UserRepository(tx);

      const teamId = await teamRepo._insert(name, leaderId, tx);
      const newRole = leaderCurrentRole === 'admin' ? 'admin' : 'team_leader';
      await userRepo.updateTeam(leaderId, teamId, newRole);
      return teamId;
    });
  }

  /** Low-level insert used inside transactions. */
  async _insert(name, leaderId, txAdapter) {
    const db = txAdapter || this.db;
    return db.insert(
      'INSERT INTO teams (name, leader_id) VALUES (?, ?)',
      [name, leaderId]
    );
  }

  async findMembers(teamId) {
    return this.db.query(
      'SELECT id, email, username, role, created_at FROM users WHERE team_id = ?',
      [teamId]
    );
  }

  async addMember(userId, teamId, role) {
    await this.db.execute(
      'UPDATE users SET team_id = ?, role = ? WHERE id = ?',
      [teamId, role, userId]
    );
  }

  async removeMember(userId, teamId) {
    await this.db.execute(
      "UPDATE users SET team_id = NULL, role = 'member' WHERE id = ? AND team_id = ?",
      [userId, teamId]
    );
  }
}

module.exports = TeamRepository;
