-- Copyright (C) 2026 Zekrost <tech@zekrost.com>
-- SPDX-License-Identifier: AGPL-3.0-only
-- name: ListTasksByWorkspace :many
SELECT id, workspace_id, doc_id, line_no, title, due_date, project,
       priority, assignee, done, created_at, updated_at
FROM tasks
WHERE workspace_id = ? AND done = ?
ORDER BY done ASC, due_date ASC;

-- name: ListTasksByProject :many
SELECT id, workspace_id, doc_id, line_no, title, due_date, project,
       priority, assignee, done, created_at, updated_at
FROM tasks
WHERE workspace_id = ? AND project = ?
ORDER BY due_date ASC;

-- name: ListTasksDueToday :many
SELECT id, workspace_id, doc_id, line_no, title, due_date, project,
       priority, assignee, done, created_at, updated_at
FROM tasks
WHERE workspace_id = ? AND assignee = ?
  AND due_date <= date('now') AND done = 0
ORDER BY due_date ASC;

-- name: UpsertTask :exec
INSERT INTO tasks (id, workspace_id, doc_id, line_no, title, due_date,
                   project, priority, assignee, done)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (doc_id, line_no) DO UPDATE SET
    title = excluded.title,
    due_date = excluded.due_date,
    project = excluded.project,
    priority = excluded.priority,
    assignee = excluded.assignee,
    done = excluded.done,
    updated_at = datetime('now');

-- name: DeleteTasksForDoc :exec
DELETE FROM tasks WHERE doc_id = ?;

-- name: SetTaskDone :exec
UPDATE tasks SET done = ?, updated_at = datetime('now')
WHERE id = ? AND workspace_id = ?;

-- name: ListTasksByDateRange :many
SELECT id, workspace_id, doc_id, line_no, title, due_date, project,
       priority, assignee, done, created_at, updated_at
FROM tasks
WHERE workspace_id = ? AND due_date >= ? AND due_date <= ?
ORDER BY due_date ASC, done ASC;

-- name: ListTasksMineToday :many
SELECT id, workspace_id, doc_id, line_no, title, due_date, project,
       priority, assignee, done, created_at, updated_at
FROM tasks
WHERE workspace_id = ? AND assignee = ? AND due_date <= date('now') AND done = 0
ORDER BY due_date ASC;
