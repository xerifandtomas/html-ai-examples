'use strict';

/**
 * ProjectRepository — project CRUD and task operations.
 */
class ProjectRepository {
  constructor(adapter) {
    this.db = adapter;
  }

  // ─── Projects ────────────────────────────────────────────────────────────────

  _projectCols() {
    return `
      SELECT p.*, t.name AS team_name,
             u.username AS created_by_name,
             (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS task_count,
             COALESCE((SELECT AVG(progress) FROM tasks WHERE project_id = p.id), 0) AS avg_progress
    `;
  }

  async findAll(teamId, organizationId) {
    if (teamId == null) {
      // admin/owner: all projects in the organization
      return this.db.query(`
        ${this._projectCols()}
        FROM projects p
        LEFT JOIN teams t ON t.id = p.team_id
        LEFT JOIN users u ON u.id = p.created_by
        WHERE t.organization_id = ?
        ORDER BY p.created_at DESC
      `, [organizationId]);
    }
    return this.db.query(`
      ${this._projectCols()}
      FROM projects p
      LEFT JOIN teams t ON t.id = p.team_id
      LEFT JOIN users u ON u.id = p.created_by
      WHERE p.team_id = ? AND t.organization_id = ?
      ORDER BY p.created_at DESC
    `, [teamId, organizationId]);
  }

  async findById(id, organizationId) {
    return this.db.queryOne(`
      ${this._projectCols()}
      FROM projects p
      LEFT JOIN teams t ON t.id = p.team_id
      LEFT JOIN users u ON u.id = p.created_by
      WHERE p.id = ? AND t.organization_id = ?
    `, [id, organizationId]);
  }

  async create({ name, description, start_date, end_date, team_id, created_by }) {
    const id = await this.db.insert(
      'INSERT INTO projects (name, description, start_date, end_date, team_id, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || '', start_date, end_date, team_id, created_by]
    );
    return this.findById(id);
  }

  async update(id, { name, description, start_date, end_date, status }) {
    await this.db.execute(`
      UPDATE projects SET
        name        = COALESCE(?, name),
        description = COALESCE(?, description),
        start_date  = COALESCE(?, start_date),
        end_date    = COALESCE(?, end_date),
        status      = COALESCE(?, status)
      WHERE id = ?
    `, [name ?? null, description ?? null, start_date ?? null, end_date ?? null, status ?? null, id]);
    return this.findById(id);
  }

  /** Deletes a project and all its tasks atomically. */
  async delete(id) {
    await this.db.transaction(async (tx) => {
      await tx.execute('DELETE FROM tasks WHERE project_id = ?', [id]);
      await tx.execute('DELETE FROM projects WHERE id = ?', [id]);
    });
  }

  // ─── Tasks ────────────────────────────────────────────────────────────────────

  async findTasksByProject(projectId) {
    return this.db.query(`
      SELECT t.*, u.username AS assigned_to_name, u.email AS assigned_to_email
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      WHERE t.project_id = ?
      ORDER BY t.sort_order ASC, t.id ASC
    `, [projectId]);
  }

  async findTaskById(taskId, projectId) {
    return this.db.queryOne(
      'SELECT * FROM tasks WHERE id = ? AND project_id = ?',
      [taskId, projectId]
    );
  }

  async createTask({ project_id, name, description, start_date, end_date, progress, color, parent_id, assigned_to, created_by, sort_order }) {
    const id = await this.db.insert(`
      INSERT INTO tasks
        (project_id, name, description, start_date, end_date, progress, color, parent_id, assigned_to, created_by, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      project_id, name, description || '', start_date, end_date,
      progress || 0, color || '#e94560',
      parent_id   ?? null,
      assigned_to ?? null,
      created_by,
      sort_order  || 0
    ]);
    return this.db.queryOne(`
      SELECT t.*, u.username AS assigned_to_name
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      WHERE t.id = ?
    `, [id]);
  }

  async updateTask(taskId, { name, description, start_date, end_date, progress, color, parent_id, assigned_to, status, sort_order }) {
    await this.db.execute(`
      UPDATE tasks SET
        name        = COALESCE(?, name),
        description = COALESCE(?, description),
        start_date  = COALESCE(?, start_date),
        end_date    = COALESCE(?, end_date),
        progress    = COALESCE(?, progress),
        color       = COALESCE(?, color),
        parent_id   = COALESCE(?, parent_id),
        assigned_to = COALESCE(?, assigned_to),
        status      = COALESCE(?, status),
        sort_order  = COALESCE(?, sort_order)
      WHERE id = ?
    `, [
      name        ?? null,
      description ?? null,
      start_date  ?? null,
      end_date    ?? null,
      progress    ?? null,
      color       ?? null,
      parent_id   ?? null,
      assigned_to ?? null,
      status      ?? null,
      sort_order  ?? null,
      taskId
    ]);
    return this.db.queryOne(`
      SELECT t.*, u.username AS assigned_to_name
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      WHERE t.id = ?
    `, [taskId]);
  }

  /** Deletes a task and all its child tasks atomically. */
  async deleteTask(taskId) {
    await this.db.transaction(async (tx) => {
      await tx.execute('DELETE FROM tasks WHERE parent_id = ?', [taskId]);
      await tx.execute('DELETE FROM tasks WHERE id = ?', [taskId]);
    });
  }
}

module.exports = ProjectRepository;
