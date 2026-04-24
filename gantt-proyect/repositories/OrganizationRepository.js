'use strict';
const crypto = require('crypto');

/**
 * OrganizationRepository — organization and member management.
 */
class OrganizationRepository {
  constructor(adapter) {
    this.db = adapter;
  }

  async findAllForUser(userId) {
    return this.db.query(`
      SELECT o.*, om.role as user_role
      FROM organizations o
      JOIN organization_members om ON o.id = om.organization_id
      WHERE om.user_id = ?
    `, [userId]);
  }

  async findById(id) {
    return this.db.queryOne('SELECT * FROM organizations WHERE id = ?', [id]);
  }

  async create(name, ownerId) {
    return this.db.transaction(async (tx) => {
      const orgId = await tx.insert(
        'INSERT INTO organizations (name, owner_id) VALUES (?, ?)',
        [name, ownerId]
      );
      await tx.execute(
        'INSERT INTO organization_members (user_id, organization_id, role) VALUES (?, ?, ?)',
        [ownerId, orgId, 'owner']
      );
      return orgId;
    });
  }

  async isUserMember(userId, organizationId) {
    const r = await this.db.queryOne(
      'SELECT role FROM organization_members WHERE user_id = ? AND organization_id = ?',
      [userId, organizationId]
    );
    return r;
  }

  async findMembers(organizationId) {
    return this.db.query(`
      SELECT u.id, u.email, u.username, om.role, om.created_at
      FROM users u
      JOIN organization_members om ON u.id = om.user_id
      WHERE om.organization_id = ?
    `, [organizationId]);
  }

  async addMember(userId, organizationId, role = 'member') {
    await this.db.execute(
      'INSERT INTO organization_members (user_id, organization_id, role) VALUES (?, ?, ?)',
      [userId, organizationId, role]
    );
  }

  async removeMember(userId, organizationId) {
    await this.db.execute(
      'DELETE FROM organization_members WHERE user_id = ? AND organization_id = ?',
      [userId, organizationId]
    );
  }

  async createInvitation(organizationId, inviterId) {
    const token = crypto.randomBytes(20).toString('hex');
    const expires = new Date();
    expires.setDate(expires.getDate() + 7); // 7 day validity

    await this.db.insert(
      'INSERT INTO organization_invitations (organization_id, created_by, token, expires_at) VALUES (?, ?, ?, ?)',
      [organizationId, inviterId, token, expires.toISOString()]
    );
    return token;
  }

  async findInvitationByToken(token) {
    return this.db.queryOne('SELECT * FROM organization_invitations WHERE token = ?', [token]);
  }

  async deleteInvitation(token) {
    await this.db.execute('DELETE FROM organization_invitations WHERE token = ?', [token]);
  }
}

module.exports = OrganizationRepository;
