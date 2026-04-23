const express = require('express');
const jwt = require('jsonwebtoken');
const { getRepos } = require('../repositories');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/teams  — admin sees all; others see own team
router.get('/', async (req, res) => {
  try {
    const { teams } = getRepos();
    if (req.user.role === 'admin') {
      return res.json(await teams.findAll());
    }
    if (!req.user.team_id) return res.json([]);
    const team = await teams.findById(req.user.team_id);
    return res.json(team ? [team] : []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/teams
router.post('/', async (req, res) => {
  if (!['admin', 'team_leader'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Team name is required' });

  try {
    const { teams, users } = getRepos();
    const teamId = await teams.createWithLeader(name, req.user.id, req.user.role);
    const team = await teams.findById(teamId);
    const user = await users.findById(req.user.id);
    // Return a refreshed token so subsequent requests reflect the new team_id
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, team_id: user.team_id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.status(201).json({ team, token });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/teams/:id/members
router.get('/:id/members', async (req, res) => {
  const teamId = parseInt(req.params.id, 10);
  if (req.user.role !== 'admin' && req.user.team_id !== teamId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const { teams } = getRepos();
    const members = await teams.findMembers(teamId);
    return res.json(members);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/teams/:id/members  — add by email
router.post('/:id/members', async (req, res) => {
  const teamId = parseInt(req.params.id, 10);
  const { email, role } = req.body;

  if (!['admin', 'team_leader'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  if (req.user.role === 'team_leader' && req.user.team_id !== teamId) {
    return res.status(403).json({ error: 'Access denied to this team' });
  }
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const memberRole = ['member', 'team_leader'].includes(role) ? role : 'member';

  try {
    const { users, teams } = getRepos();
    const user = await users.findByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await teams.addMember(user.id, teamId, memberRole);
    const updated = await users.findById(user.id);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/teams/:id/members/:userId
router.delete('/:id/members/:userId', async (req, res) => {
  const teamId = parseInt(req.params.id, 10);
  const userId = parseInt(req.params.userId, 10);

  if (!['admin', 'team_leader'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  if (req.user.role === 'team_leader' && req.user.team_id !== teamId) {
    return res.status(403).json({ error: 'Access denied to this team' });
  }

  try {
    const { teams } = getRepos();
    await teams.removeMember(userId, teamId);
    return res.json({ message: 'Member removed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

