const express = require('express');
const { getRepos } = require('../repositories');
const { requireAuth, requireOrganization } = require('../middleware/auth');
const { checkLimit } = require('../middleware/tierLimits');
const { getPlanLimitsJSON, UPGRADE_PATH, PLAN_LABELS } = require('../config/tiers');

const router = express.Router();
router.use(requireAuth);

// GET /api/organizations - List organizations for the authenticated user
router.get('/', async (req, res) => {
  try {
    const { organizations } = getRepos();
    const orgs = await organizations.findAllForUser(req.user.id);
    return res.json(orgs);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/organizations - Create a new organization
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Organization name is required' });

  try {
    const { organizations } = getRepos();
    const orgId = await organizations.create(name, req.user.id);
    const org = await organizations.findById(orgId);
    return res.status(201).json(org);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/organizations/invitations/accept?token=...
router.get('/invitations/accept', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Invitation token is required' });

  try {
    const { organizations } = getRepos();
    const invitation = await organizations.findInvitationByToken(token);

    if (!invitation || new Date() > new Date(invitation.expires_at)) {
      return res.status(404).json({ error: 'Invitation not found or has expired' });
    }

    await organizations.addMember(req.user.id, invitation.organization_id, 'member');
    await organizations.deleteInvitation(token);

    return res.json({ message: `Successfully joined organization ${invitation.organization_id}` });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed') || err.message.includes('PRIMARY KEY')) {
      return res.status(409).json({ error: 'You are already a member of this organization' });
    }
    return res.status(500).json({ error: err.message });
  }
});

// The following routes require the X-Organization-ID header
router.use(requireOrganization);

// GET /api/organizations/current - Get details of the active organization
router.get('/current', async (req, res) => {
  try {
    const { organizations } = getRepos();
    const org = await organizations.findById(req.organization.id);
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    // Attach the user's role in this organization
    org.user_role = req.organization.role;
    return res.json(org);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/organizations/current/members - List members of the active organization
router.get('/current/members', async (req, res) => {
  try {
    const { organizations } = getRepos();
    const members = await organizations.findMembers(req.organization.id);
    return res.json(members);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/organizations/current/members/:userId - Remove a member from the active organization
router.delete('/current/members/:userId', async (req, res) => {
  if (req.organization.role !== 'owner' && req.organization.role !== 'admin') {
    return res.status(403).json({ error: 'Insufficient permissions to remove members' });
  }

  const targetUserId = parseInt(req.params.userId, 10);
  if (isNaN(targetUserId)) return res.status(400).json({ error: 'Invalid user ID' });

  try {
    const { organizations } = getRepos();
    // Prevent removing the owner
    const members = await organizations.findMembers(req.organization.id);
    const target = members.find(m => m.id === targetUserId);
    if (!target) return res.status(404).json({ error: 'Member not found' });
    if (target.role === 'owner') return res.status(403).json({ error: 'Cannot remove the organization owner' });

    await organizations.removeMember(targetUserId, req.organization.id);
    return res.json({ message: 'Member removed from organization' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/organizations/current/invitations - Create an invitation to the organization
router.post('/current/invitations', checkLimit('invite_links'), async (req, res) => {
  if (req.organization.role !== 'owner' && req.organization.role !== 'admin') {
    return res.status(403).json({ error: 'Insufficient permissions to invite members' });
  }

  try {
    const { organizations } = getRepos();
    const token = await organizations.createInvitation(req.organization.id, req.user.id);
    const inviteLink = `${req.protocol}://${req.get('host')}/api/organizations/invitations/accept?token=${token}`;
    return res.json({ inviteLink, token });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/organizations/current/plan — returns plan, limits, and current usage
router.get('/current/plan', async (req, res) => {
  try {
    const { subscriptions } = getRepos();
    const plan = await subscriptions.getOrgPlan(req.organization.id);
    const usage = await subscriptions.getOrgUsage(req.organization.id);
    return res.json({
      plan,
      label: PLAN_LABELS[plan] || plan,
      limits: getPlanLimitsJSON(plan),
      upgrade_to: UPGRADE_PATH[plan] || null,
      usage,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
