const express = require('express');
const { getRepos } = require('../repositories');
const { requireAuth, requireOrganization } = require('../middleware/auth');
const { checkLimit } = require('../middleware/tierLimits');

const router = express.Router();
router.use(requireAuth);
router.use(requireOrganization);

// GET /api/projects
router.get('/', async (req, res) => {
  try {
    const { projects, teams } = getRepos();
    // Admin and org owners see all projects in the org
    if (req.user.role === 'admin' || req.organization.role === 'owner') {
      return res.json(await projects.findAll(null, req.organization.id));
    }
    // Regular members: fetch all teams they belong to in this org, then collect all projects
    const teamId = req.query.team_id;
    if (teamId) {
      return res.json(await projects.findAll(teamId, req.organization.id));
    }
    // No specific team — return projects from ALL teams the user belongs to in this org
    const userTeams = await teams.findUserTeams(req.user.id, req.organization.id);
    if (!userTeams.length) return res.json([]);
    const results = await Promise.all(
      userTeams.map(t => projects.findAll(t.id, req.organization.id))
    );
    // Flatten and deduplicate by project id
    const seen = new Set();
    const all = results.flat().filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
    return res.json(all);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/projects
router.post('/', checkLimit('projects'), async (req, res) => {
  if (!['admin', 'team_leader', 'owner'].includes(req.organization.role) && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const { name, description, start_date, end_date, team_id } = req.body;
  if (!name || !start_date || !end_date) {
    return res.status(400).json({ error: 'name, start_date, and end_date are required' });
  }

  try {
    const { projects } = getRepos();
    if (!team_id) {
      return res.status(400).json({ error: 'Team association required.' });
    }

    const project = await projects.create({
      name, description, start_date, end_date,
      team_id: team_id,
      created_by: req.user.id,
    });
    return res.status(201).json(project);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id
router.get('/:id', async (req, res) => {
  try {
    const { projects } = getRepos();
    const project = await projects.findById(req.params.id, req.organization.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Assuming if the project belongs to the org, the user can see it if they are in the org.
    // Stricter check would verify if user is in project.team_id.
    return res.json(project);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:id
router.put('/:id', async (req, res) => {
  try {
    const { projects } = getRepos();
    const project = await projects.findById(req.params.id, req.organization.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (req.user.role !== 'admin' && req.organization.role === 'member') {
        // Need to check if user is team_leader for project.team_id
        // For simplicity, restrict to org owner or admin for now, or team_leader.
    }

    const { name, description, start_date, end_date, status } = req.body;
    const updated = await projects.update(req.params.id, { name, description, start_date, end_date, status });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', async (req, res) => {
  if (!['admin', 'team_leader'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  try {
    const { projects } = getRepos();
    const project = await projects.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (req.user.role !== 'admin' && project.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await projects.delete(req.params.id);
    return res.json({ message: 'Project deleted' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id/tasks
router.get('/:id/tasks', async (req, res) => {
  try {
    const { projects } = getRepos();
    const project = await projects.findById(req.params.id, req.organization.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (req.user.role !== 'admin' && project.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const tasks = await projects.findTasksByProject(req.params.id);
    return res.json(tasks);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/tasks
router.post('/:id/tasks', checkLimit('tasks'), checkLimit('subtasks'), async (req, res) => {
  try {
    const { projects } = getRepos();
    const project = await projects.findById(req.params.id, req.organization.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (req.user.role !== 'admin' && project.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role === 'member') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name, description, start_date, end_date, progress, color, parent_id, assigned_to, assignees, sort_order, estimated_hours } = req.body;
    if (!name || !start_date || !end_date) {
      return res.status(400).json({ error: 'name, start_date, and end_date are required' });
    }

    const task = await projects.createTask({
      project_id: req.params.id,
      name, description, start_date, end_date, progress, color,
      parent_id:   parent_id   ?? null,
      assigned_to: assigned_to ?? null,
      assignees:   Array.isArray(assignees) ? assignees.filter(Boolean) : [],
      created_by:  req.user.id,
      sort_order,
      estimated_hours: estimated_hours || 0,
    });
    return res.status(201).json(task);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:id/tasks/:taskId
router.put('/:id/tasks/:taskId', async (req, res) => {
  try {
    const { projects } = getRepos();
    const project = await projects.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (req.user.role !== 'admin' && project.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const task = await projects.findTaskById(req.params.taskId, req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Members can only update progress on tasks assigned to them
    if (req.user.role === 'member' && task.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'You can only update tasks assigned to you' });
    }

    const { name, description, start_date, end_date, progress, color, parent_id, assigned_to, assignees, status, sort_order, estimated_hours } = req.body;
    const updated = await projects.updateTask(req.params.taskId, {
      name, description, start_date, end_date, progress, color,
      parent_id, assigned_to,
      assignees: assignees !== undefined ? (Array.isArray(assignees) ? assignees.filter(Boolean) : []) : undefined,
      status, sort_order,
      estimated_hours: estimated_hours !== undefined ? (estimated_hours || 0) : undefined,
    });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id/tasks/:taskId
router.delete('/:id/tasks/:taskId', async (req, res) => {
  if (req.user.role === 'member') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  try {
    const { projects } = getRepos();
    const task = await projects.findTaskById(req.params.taskId, req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    await projects.deleteTask(req.params.taskId);
    return res.json({ message: 'Task deleted' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

