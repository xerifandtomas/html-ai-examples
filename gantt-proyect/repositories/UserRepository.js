'use strict';

/**
 * UserRepository — all user-related DB operations.
 * Uses the injected adapter so the same code works with SQLite, MySQL, and PostgreSQL.
 */
class UserRepository {
  constructor(adapter) {
    this.db = adapter;
  }

  async findByEmail(email) {
    return this.db.queryOne('SELECT * FROM users WHERE email = ?', [email]);
  }

  async findById(id) {
    return this.db.queryOne(
      'SELECT id, email, username, role, team_id, created_at FROM users WHERE id = ?',
      [id]
    );
  }

  async create(email, username, passwordHash, role) {
    const id = await this.db.insert(
      'INSERT INTO users (email, username, password_hash, role) VALUES (?, ?, ?, ?)',
      [email, username, passwordHash, role]
    );
    return this.findById(id);
  }

  async updatePassword(id, hash) {
    await this.db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
  }

  /** Assign user to a team and set their role. */
  async updateTeam(id, teamId, role) {
    await this.db.execute(
      'UPDATE users SET team_id = ?, role = ? WHERE id = ?',
      [teamId, role, id]
    );
  }

  /** Remove user from a team and reset their role to member. */
  async clearTeam(id, teamId) {
    await this.db.execute(
      "UPDATE users SET team_id = NULL, role = 'member' WHERE id = ? AND team_id = ?",
      [id, teamId]
    );
  }
}

module.exports = UserRepository;
