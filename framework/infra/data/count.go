package data

import (
	"context"
	"database/sql"
)

// LoadCount 读单行计数（产品已保证 id=1 存在）。
func LoadCount(ctx context.Context, h *sql.DB) (int, error) {
	var count int
	err := h.QueryRowContext(ctx, "SELECT count FROM greeting_visits WHERE id = 1").Scan(&count)
	return count, err
}

// IncrCount 计数加一，返回新值。
func IncrCount(ctx context.Context, h *sql.DB) (int, error) {
	var newCount int
	err := h.QueryRowContext(ctx, `
UPDATE greeting_visits SET count = count + 1 WHERE id = 1
RETURNING count`).Scan(&newCount)
	return newCount, err
}