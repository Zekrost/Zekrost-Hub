-- 003_in_progress.sql — Estado "en progreso" ([~]) para las columnas
-- del kanban (el parser ya lo detecta; el índice lo expone).
ALTER TABLE tasks ADD COLUMN in_progress INTEGER NOT NULL DEFAULT 0;
