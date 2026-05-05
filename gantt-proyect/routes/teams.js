const express = require('express');
const rateLimit = require('express-rate-limit');
const { getRepos } = require('../repositories');
const { requireAuth, requireOrganization } = require('../middleware/auth');
const { checkLimit } = require('../middleware/tierLimits');

const router = express.Router();

const invitationAcceptLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

router.use(requireAuth);
router.use(requireOrganization);

// GET /api/teams — admin sees all; others see their teams
router.get('/', async (req, res) => {
  try {
    const { teams } = getRepos();
    if (req.user.role === 'admin' || req.organization.role === 'owner') {
      return res.json(await teams.findAll(req.organization.id));
    }
    const userTeams = await teams.findUserTeams(req.user.id, req.organization.id);
    return res.json(userTeams);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/teams
router.post('/', checkLimit('teams'), async (req, res) => {
  if (!['admin', 'team_leader', 'owner'].includes(req.organization.role) && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Team name is required' });

  try {
    const { teams } = getRepos();
    const teamId = await teams.createWithLeader(name, req.user.id, req.organization.role, req.organization.id);
    const team = await teams.findById(teamId, req.organization.id);
    return res.status(201).json({ team });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/teams/:id/members
router.get('/:id/members', async (req, res) => {
  const teamId = parseInt(req.params.id, 10);
  const { teams } = getRepos();
  const isMember = await teams.isUserMember(req.user.id, teamId);

  if (req.user.role !== 'admin' && !isMember) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const members = await teams.findMembers(teamId);
    return res.json(members);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/teams/:id/members  — add by email
router.post('/:id/members', checkLimit('team_members'), async (req, res) => {
  const teamId = parseInt(req.params.id, 10);
  const { email, role } = req.body;
  const { teams } = getRepos();
  const isLeader = await teams.isUserTeamLeader(req.user.id, teamId);

  if (req.user.role !== 'admin' && !isLeader) {
    return res.status(403).json({ error: 'Insufficient permissions to invite members' });
  }

  if (!email) return res.status(400).json({ error: 'Email is required' });

  const memberRole = ['member', 'team_leader'].includes(role) ? role : 'member';

  try {
    const { users } = getRepos();
    const user = await users.findByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await teams.addMember(user.id, teamId, memberRole);
    const updated = await users.findById(user.id);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/teams/:id/members/:userId
router.delete('/:id/members/:userId', async (req, res) => {
  const teamId = parseInt(req.params.id, 10);
  const userId = parseInt(req.params.userId, 10);
  const { teams } = getRepos();
  const isLeader = await teams.isUserTeamLeader(req.user.id, teamId);

  if (req.user.role !== 'admin' && !isLeader) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  if (req.user.id === userId) {
    return res.status(400).json({ error: 'You cannot remove yourself from the team' });
  }

  try {
    await teams.removeMember(userId, teamId);
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/teams/:id/invitations
router.post('/:id/invitations', checkLimit('invite_links'), async (req, res) => {
  const teamId = parseInt(req.params.id, 10);
  const { teams } = getRepos();
  const isLeader = await teams.isUserTeamLeader(req.user.id, teamId);

  if (req.user.role !== 'admin' && !isLeader) {
    return res.status(403).json({ error: 'Insufficient permissions to invite members' });
  }

  try {
    const token = await teams.createInvitation(teamId, req.user.id);
    const inviteLink = `${req.protocol}://${req.get('host')}/api/teams/invitations/accept?token=${token}`;
    return res.json({ inviteLink, token });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/invitations/accept?token=...
router.get('/invitations/accept', invitationAcceptLimiter, async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Invitation token is required' });

  try {
    const { teams } = getRepos();
    const invitation = await teams.findInvitationByToken(token);

    if (!invitation || new Date() > new Date(invitation.expires_at)) {
      return res.status(404).json({ error: 'Invitation not found or has expired' });
    }

    await teams.addMember(req.user.id, invitation.team_id, 'member');
    await teams.deleteInvitation(token);

    return res.json({ message: `Successfully joined team ${invitation.team_id}` });
  } catch (err) {
    if (
      err.message.includes('duplicate key') ||
      err.message.includes('UNIQUE constraint failed')
    ) {
      return res.status(409).json({ error: 'You are already a member of this team' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

