-- Copyright (C) 2026 Zekrost <tech@zekrost.com>
-- SPDX-License-Identifier: AGPL-3.0-only
-- name: CreateUser :exec
INSERT INTO users (id, email, password_hash, display_name)
VALUES (?, ?, ?, ?);

-- name: GetUserByEmail :one
SELECT id, email, password_hash, display_name, created_at
FROM users
WHERE email = ?;

-- name: GetUserByID :one
SELECT id, email, password_hash, display_name, created_at
FROM users
WHERE id = ?;
