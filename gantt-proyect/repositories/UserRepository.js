'use strict';

/**
 * UserRepository - all user-related DB operations.
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
      'SELECT id, email, username, role, created_at FROM users WHERE id = ?',
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
}

module.exports = UserRepository;
