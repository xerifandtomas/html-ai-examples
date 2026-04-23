const express = require('express');
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/teams  — admin sees all; others see own team
router.get('/', (req, res) => {
  const db = getDb();
  try {
    if (req.user.role === 'admin') {
      const teams = db.prepare(`
        SELECT t.*, u.username AS leader_name
        FROM teams t
        LEFT JOIN users u ON u.id = t.leader_id
      `).all();
      return res.json(teams);
    }

    if (!req.user.team_id) return res.json([]);

    const team = db.prepare(`
      SELECT t.*, u.username AS leader_name
      FROM teams t
      LEFT JOIN users u ON u.id = t.leader_id
      WHERE t.id = ?
    `).get(req.user.team_id);

    return res.json(team ? [team] : []);
  } catch (err) {
    return res.status(500).json({ error: err.message });}
});

// POST /api/teams
router.post('/', (req, res) => {
  if (!['admin', 'team_leader'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Team name is required' });

  const jwt = require('jsonwebtoken');
  const { JWT_SECRET } = require('../middleware/auth');
  const db = getDb();
  try {
    const newTeamId = db.transaction(() => {
      const result = db.prepare('INSERT INTO teams (name, leader_id) VALUES (?, ?)').run(name, req.user.id);
      const teamId = result.lastInsertRowid;
      db.prepare('UPDATE users SET team_id = ?, role = ? WHERE id = ?').run(
        teamId,
        req.user.role === 'admin' ? 'admin' : 'team_leader',
        req.user.id
      );
      return teamId;
    })();

    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(newTeamId);
    const user = db.prepare('SELECT id, email, role, team_id FROM users WHERE id = ?').get(req.user.id);
    // Return a refreshed token so subsequent requests reflect the new team_id
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, team_id: user.team_id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.status(201).json({ team, token });
  } catch (err) {
    return res.status(500).json({ error: err.message });}
});

// GET /api/teams/:id/members
router.get('/:id/members', (req, res) => {
  const teamId = parseInt(req.params.id);
  if (req.user.role !== 'admin' && req.user.team_id !== teamId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const db = getDb();
  try {
    const members = db.prepare(
      'SELECT id, email, username, role, created_at FROM users WHERE team_id = ?'
    ).all(teamId);
    return res.json(members);
  } catch (err) {
    return res.status(500).json({ error: err.message });}
});

// POST /api/teams/:id/members  — add by email
router.post('/:id/members', (req, res) => {
  const teamId = parseInt(req.params.id);
  const { email, role } = req.body;

  if (!['admin', 'team_leader'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  if (req.user.role === 'team_leader' && req.user.team_id !== teamId) {
    return res.status(403).json({ error: 'Access denied to this team' });
  }
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const memberRole = ['member', 'team_leader'].includes(role) ? role : 'member';

  const db = getDb();
  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    db.prepare('UPDATE users SET team_id = ?, role = ? WHERE id = ?').run(teamId, memberRole, user.id);
    const updated = db.prepare('SELECT id, email, username, role, team_id FROM users WHERE id = ?').get(user.id);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });}
});

// DELETE /api/teams/:id/members/:userId
router.delete('/:id/members/:userId', (req, res) => {
  const teamId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);

  if (!['admin', 'team_leader'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  if (req.user.role === 'team_leader' && req.user.team_id !== teamId) {
    return res.status(403).json({ error: 'Access denied to this team' });
  }

  const db = getDb();
  try {
    db.prepare("UPDATE users SET team_id = NULL, role = 'member' WHERE id = ? AND team_id = ?").run(userId, teamId);
    return res.json({ message: 'Member removed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });}
});

module.exports = router;
