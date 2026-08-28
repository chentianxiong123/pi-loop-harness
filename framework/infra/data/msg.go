package data

import (
	"context"
	"database/sql"
	"time"

	"pi-loop-harness/framework/business/msgwall"
)

// CreateMessage 插入一条留言，返回带 ID 的完整消息。
func CreateMessage(ctx context.Context, h *sql.DB, author, body string) (msgwall.Message, error) {
	at := time.Now()
	var id int64
	err := h.QueryRowContext(ctx, `
INSERT INTO messages (author, body, created_at)
VALUES (?, ?, ?)
RETURNING id`, author, body, at.Format(time.RFC3339)).Scan(&id)
	if err != nil {
		return msgwall.Message{}, err
	}
	return msgwall.Message{ID: id, Author: author, Body: body, At: at}, nil
}

// ListMessages 返回最新 limit 条留言（新→旧）。limit<=0 视为不过滤。
func ListMessages(ctx context.Context, h *sql.DB, limit int) ([]msgwall.Message, error) {
	query := `SELECT id, author, body, created_at FROM messages ORDER BY id DESC`
	args := []any{}
	if limit > 0 {
		query += ` LIMIT ?`
		args = append(args, limit)
	}
	rows, err := h.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []msgwall.Message{}
	for rows.Next() {
		var (
			m   msgwall.Message
			raw string
		)
		if err := rows.Scan(&m.ID, &m.Author, &m.Body, &raw); err != nil {
			return nil, err
		}
		if t, err := time.Parse(time.RFC3339, raw); err == nil {
			m.At = t
		}
		out = append(out, m)
	}
	return out, rows.Err()
}