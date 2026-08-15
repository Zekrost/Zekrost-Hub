-- name: ListDocsForGraph :many
SELECT id, title FROM docs
WHERE workspace_id = ? AND deleted_at IS NULL;

-- name: ListBacklinksForGraph :many
SELECT src_doc_id, dst_doc_id, anchor_text
FROM backlinks
WHERE src_doc_id IN (SELECT id FROM docs WHERE workspace_id = ? AND deleted_at IS NULL);
