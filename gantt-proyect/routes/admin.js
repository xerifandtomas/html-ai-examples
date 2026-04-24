'use strict';

const express = require('express');
const { getRepos } = require('../repositories');
const { requireAuth } = require('../middleware/auth');
const { VALID_PLANS, getPlanLimitsJSON, PLAN_LABELS } = require('../config/tiers');

const router = express.Router();

// All admin routes require authentication AND global admin role
router.use(requireAuth);
router.use((req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
});

// GET /api/admin/organizations — list all orgs with plan + usage
router.get('/organizations', async (req, res) => {
  try {
    const { subscriptions } = getRepos();
    const orgs = await subscriptions.listOrgsWithPlans();
    // Enrich with limit info for convenience
    const result = orgs.map(o => ({
      ...o,
      plan_label: PLAN_LABELS[o.plan] || o.plan,
      limits: getPlanLimitsJSON(o.plan),
    }));
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/organizations/:id/plan — change tier
router.put('/organizations/:id/plan', async (req, res) => {
  const orgId = parseInt(req.params.id, 10);
  const { plan } = req.body;

  if (!plan || !VALID_PLANS.includes(plan)) {
    return res.status(400).json({
      error: `Invalid plan. Valid values: ${VALID_PLANS.join(', ')}`,
    });
  }

  try {
    const { subscriptions } = getRepos();
    await subscriptions.setOrgPlan(orgId, plan, req.user.id);
    return res.json({
      message: `Plan updated to "${plan}"`,
      plan,
      plan_label: PLAN_LABELS[plan],
      limits: getPlanLimitsJSON(plan),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
