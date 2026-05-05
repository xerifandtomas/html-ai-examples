'use strict';

const { getPlanLimits, UPGRADE_PATH } = require('../config/tiers');
const { getRepos } = require('../repositories');

/**
 * Returns an Express middleware that checks whether the current organization
 * is allowed to create a new resource of the given type.
 *
 * Requires:
 *   - req.organization.id  (set by requireOrganization)
 *   - req.body             (for 'subtasks': checks parent_id presence)
 *   - req.params.id        (for 'tasks'/'team_members': team/project id)
 *
 * On limit exceeded responds:
 *   403 { error, code: 'TIER_LIMIT', resource, limit, current, plan, upgrade_to }
 *
 * @param {'teams'|'projects'|'tasks'|'subtasks'|'org_members'|'team_members'|'invite_links'} resource
 */
function checkLimit(resource) {
  return async function tierLimitMiddleware(req, res, next) {
    try {
      const { subscriptions } = getRepos();
      const orgId = req.organization.id;
      const plan = await subscriptions.getOrgPlan(orgId);
      const limits = getPlanLimits(plan);

      let current = 0;
      let limit;
      let allowed = true;

      switch (resource) {
        case 'teams': {
          limit = limits.maxTeams;
          if (limit !== Infinity) {
            current = await subscriptions.countTeams(orgId);
            allowed = current < limit;
          }
          break;
        }

        case 'projects': {
          limit = limits.maxProjectsPerTeam;
          if (limit !== Infinity) {
            const teamId = parseInt(req.body.team_id, 10);
            if (teamId) {
              current = await subscriptions.countProjects(teamId);
              allowed = current < limit;
            }
          }
          break;
        }

        case 'tasks': {
          limit = limits.maxTasksPerProject;
          if (limit !== Infinity) {
            const projectId = parseInt(req.params.id, 10);
            if (projectId) {
              current = await subscriptions.countTasks(projectId);
              allowed = current < limit;
            }
          }
          break;
        }

        case 'subtasks': {
          // Only enforce if a parent_id is provided in the body
          if (!req.body.parent_id) break;
          limit = 'feature';
          allowed = limits.subtasks;
          break;
        }

        case 'org_members': {
          limit = limits.maxOrgMembers;
          if (limit !== Infinity) {
            current = await subscriptions.countOrgMembers(orgId);
            allowed = current < limit;
          }
          break;
        }

        case 'team_members': {
          limit = limits.maxTeamMembers;
          if (limit !== Infinity) {
            const teamId = parseInt(req.params.id, 10);
            if (teamId) {
              current = await subscriptions.countTeamMembers(teamId);
              allowed = current < limit;
            }
          }
          break;
        }

        case 'invite_links': {
          limit = 'feature';
          allowed = limits.inviteLinks;
          break;
        }

        default:
          // Unknown resource — pass through
          return next();
      }

      if (!allowed) {
        return res.status(403).json({
          error: `Has alcanzado el límite de tu plan ${plan} para "${resource}".`,
          code: 'TIER_LIMIT',
          resource,
          limit: limit === Infinity ? null : limit,
          current,
          plan,
          upgrade_to: UPGRADE_PATH[plan] || null,
        });
      }

      return next();
    } catch (err) {
      // On unexpected error, let the request through so the real route handles it
      console.error('[tierLimits] Error checking tier limit:', err.message);
      return next();
    }
  };
}

module.exports = { checkLimit };
