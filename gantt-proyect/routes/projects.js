const express = require('express');
const { getRepos } = require('../repositories');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/projects
router.get('/', async (req, res) => {
  try {
    const { projects, users } = getRepos();
    let teamId;
    if (req.user.role === 'admin') {
      teamId = null; // repo returns all projects when teamId is null
    } else if (req.user.team_id) {
      teamId = req.user.team_id;
    } else {
      return res.json([]);
    }
    return res.json(await projects.findAll(teamId));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/projects
router.post('/', async (req, res) => {
  if (!['admin', 'team_leader'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const { name, description, start_date, end_date, team_id } = req.body;
  if (!name || !start_date || !end_date) {
    return res.status(400).json({ error: 'name, start_date, and end_date are required' });
  }

  try {
    const { projects, users } = getRepos();
    // Always read team_id fresh from DB in case JWT is stale after team creation
    const freshUser = await users.findById(req.user.id);
    const freshTeamId = freshUser ? freshUser.team_id : req.user.team_id;
    const resolvedTeamId = req.user.role === 'admin' ? (team_id || freshTeamId) : freshTeamId;
    if (!resolvedTeamId) {
      return res.status(400).json({ error: 'Team association required. Join or create a team first.' });
    }

    const project = await projects.create({
      name, description, start_date, end_date,
      team_id: resolvedTeamId,
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
    const project = await projects.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (req.user.role !== 'admin' && project.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    return res.json(project);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:id
router.put('/:id', async (req, res) => {
  try {
    const { projects } = getRepos();
    const project = await projects.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (req.user.role !== 'admin' && project.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role === 'member') {
      return res.status(403).json({ error: 'Insufficient permissions' });
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
    const project = await projects.findById(req.params.id);
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
router.post('/:id/tasks', async (req, res) => {
  try {
    const { projects } = getRepos();
    const project = await projects.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (req.user.role !== 'admin' && project.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role === 'member') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name, description, start_date, end_date, progress, color, parent_id, assigned_to, sort_order } = req.body;
    if (!name || !start_date || !end_date) {
      return res.status(400).json({ error: 'name, start_date, and end_date are required' });
    }

    const task = await projects.createTask({
      project_id: req.params.id,
      name, description, start_date, end_date, progress, color,
      parent_id:   parent_id   ?? null,
      assigned_to: assigned_to ?? null,
      created_by:  req.user.id,
      sort_order,
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

    const { name, description, start_date, end_date, progress, color, parent_id, assigned_to, status, sort_order } = req.body;
    const updated = await projects.updateTask(req.params.taskId, {
      name, description, start_date, end_date, progress, color,
      parent_id, assigned_to, status, sort_order,
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

