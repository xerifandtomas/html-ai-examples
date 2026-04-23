const express = require('express');
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/projects
router.get('/', (req, res) => {
  const db = getDb();
  try {
    let projects;
    if (req.user.role === 'admin') {
      projects = db.prepare(`
        SELECT p.*, t.name AS team_name,
               u.username AS created_by_name,
               (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS task_count
        FROM projects p
        LEFT JOIN teams t ON t.id = p.team_id
        LEFT JOIN users u ON u.id = p.created_by
        ORDER BY p.created_at DESC
      `).all();
    } else if (req.user.team_id) {
      projects = db.prepare(`
        SELECT p.*, t.name AS team_name,
               u.username AS created_by_name,
               (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS task_count
        FROM projects p
        LEFT JOIN teams t ON t.id = p.team_id
        LEFT JOIN users u ON u.id = p.created_by
        WHERE p.team_id = ?
        ORDER BY p.created_at DESC
      `).all(req.user.team_id);
    } else {
      projects = [];
    }
    return res.json(projects);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

// POST /api/projects
router.post('/', (req, res) => {
  if (!['admin', 'team_leader'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const { name, description, start_date, end_date, team_id } = req.body;
  if (!name || !start_date || !end_date) {
    return res.status(400).json({ error: 'name, start_date, and end_date are required' });
  }

  const resolvedTeamId = req.user.role === 'admin' ? (team_id || req.user.team_id) : req.user.team_id;
  if (!resolvedTeamId) {
    return res.status(400).json({ error: 'Team association required. Join or create a team first.' });
  }

  const db = getDb();
  try {
    const result = db.prepare(`
      INSERT INTO projects (name, description, start_date, end_date, team_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, description || '', start_date, end_date, resolvedTeamId, req.user.id);

    const project = db.prepare(`
      SELECT p.*, t.name AS team_name, u.username AS created_by_name
      FROM projects p
      LEFT JOIN teams t ON t.id = p.team_id
      LEFT JOIN users u ON u.id = p.created_by
      WHERE p.id = ?
    `).get(result.lastInsertRowid);

    return res.status(201).json(project);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

// GET /api/projects/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  try {
    const project = db.prepare(`
      SELECT p.*, t.name AS team_name, u.username AS created_by_name,
             (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS task_count
      FROM projects p
      LEFT JOIN teams t ON t.id = p.team_id
      LEFT JOIN users u ON u.id = p.created_by
      WHERE p.id = ?
    `).get(req.params.id);

    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (req.user.role !== 'admin' && project.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json(project);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

// PUT /api/projects/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (req.user.role !== 'admin' && project.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role === 'member') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name, description, start_date, end_date, status } = req.body;
    db.prepare(`
      UPDATE projects SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        status = COALESCE(?, status)
      WHERE id = ?
    `).run(name, description, start_date, end_date, status, req.params.id);

    const updated = db.prepare(`
      SELECT p.*, t.name AS team_name, u.username AS created_by_name
      FROM projects p
      LEFT JOIN teams t ON t.id = p.team_id
      LEFT JOIN users u ON u.id = p.created_by
      WHERE p.id = ?
    `).get(req.params.id);

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

// DELETE /api/projects/:id
router.delete('/:id', (req, res) => {
  if (!['admin', 'team_leader'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const db = getDb();
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (req.user.role !== 'admin' && project.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    db.prepare('DELETE FROM tasks WHERE project_id = ?').run(req.params.id);
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    return res.json({ message: 'Project deleted' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

// GET /api/projects/:id/tasks
router.get('/:id/tasks', (req, res) => {
  const db = getDb();
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (req.user.role !== 'admin' && project.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const tasks = db.prepare(`
      SELECT t.*, u.username AS assigned_to_name, u.email AS assigned_to_email
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      WHERE t.project_id = ?
      ORDER BY t.sort_order ASC, t.id ASC
    `).all(req.params.id);

    return res.json(tasks);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

// POST /api/projects/:id/tasks
router.post('/:id/tasks', (req, res) => {
  const db = getDb();
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
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

    const result = db.prepare(`
      INSERT INTO tasks (project_id, name, description, start_date, end_date, progress, color, parent_id, assigned_to, created_by, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.params.id,
      name,
      description || '',
      start_date,
      end_date,
      progress || 0,
      color || '#e94560',
      parent_id || null,
      assigned_to || null,
      req.user.id,
      sort_order || 0
    );

    const task = db.prepare(`
      SELECT t.*, u.username AS assigned_to_name
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      WHERE t.id = ?
    `).get(result.lastInsertRowid);

    return res.status(201).json(task);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

// PUT /api/projects/:id/tasks/:taskId
router.put('/:id/tasks/:taskId', (req, res) => {
  const db = getDb();
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (req.user.role !== 'admin' && project.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?').get(req.params.taskId, req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Members can only update progress on tasks assigned to them
    if (req.user.role === 'member' && task.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'You can only update tasks assigned to you' });
    }

    const { name, description, start_date, end_date, progress, color, parent_id, assigned_to, status, sort_order } = req.body;

    db.prepare(`
      UPDATE tasks SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        progress = COALESCE(?, progress),
        color = COALESCE(?, color),
        parent_id = COALESCE(?, parent_id),
        assigned_to = COALESCE(?, assigned_to),
        status = COALESCE(?, status),
        sort_order = COALESCE(?, sort_order)
      WHERE id = ?
    `).run(name, description, start_date, end_date, progress, color, parent_id, assigned_to, status, sort_order, req.params.taskId);

    const updated = db.prepare(`
      SELECT t.*, u.username AS assigned_to_name
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      WHERE t.id = ?
    `).get(req.params.taskId);

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

// DELETE /api/projects/:id/tasks/:taskId
router.delete('/:id/tasks/:taskId', (req, res) => {
  if (req.user.role === 'member') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const db = getDb();
  try {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?').get(req.params.taskId, req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Delete child tasks first
    db.prepare('DELETE FROM tasks WHERE parent_id = ?').run(req.params.taskId);
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.taskId);
    return res.json({ message: 'Task deleted' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

module.exports = router;
