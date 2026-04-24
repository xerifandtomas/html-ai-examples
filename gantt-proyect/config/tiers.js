'use strict';

/**
 * Central definition of tier limits.
 * All business logic that needs to enforce limits reads from here.
 */
const TIER_LIMITS = {
  free: {
    maxTeams:             1,
    maxProjectsPerTeam:   2,
    maxTasksPerProject:   30,
    maxOrgMembers:        3,
    maxTeamMembers:       3,
    inviteLinks:          false,
    subtasks:             false,
  },
  team: {
    maxTeams:             5,
    maxProjectsPerTeam:   20,
    maxTasksPerProject:   200,
    maxOrgMembers:        15,
    maxTeamMembers:       15,
    inviteLinks:          true,
    subtasks:             true,
  },
  business: {
    maxTeams:             Infinity,
    maxProjectsPerTeam:   Infinity,
    maxTasksPerProject:   Infinity,
    maxOrgMembers:        Infinity,
    maxTeamMembers:       Infinity,
    inviteLinks:          true,
    subtasks:             true,
  },
};

const VALID_PLANS = Object.keys(TIER_LIMITS);

/**
 * Returns the limits for a given plan name.
 * Falls back to 'free' limits for unknown plans.
 */
function getPlanLimits(plan) {
  return TIER_LIMITS[plan] || TIER_LIMITS.free;
}

/**
 * Returns a serialisable version of limits (Infinity → null)
 * suitable for JSON responses.
 */
function getPlanLimitsJSON(plan) {
  const limits = getPlanLimits(plan);
  const out = {};
  for (const [k, v] of Object.entries(limits)) {
    out[k] = v === Infinity ? null : v;
  }
  return out;
}

/**
 * Human-readable label for display in UI.
 */
const PLAN_LABELS = {
  free:     'Free',
  team:     'Team',
  business: 'Business',
};

/**
 * Suggested upgrade path for each plan.
 */
const UPGRADE_PATH = {
  free:     'team',
  team:     'business',
  business: null,
};

module.exports = { TIER_LIMITS, VALID_PLANS, getPlanLimits, getPlanLimitsJSON, PLAN_LABELS, UPGRADE_PATH };
