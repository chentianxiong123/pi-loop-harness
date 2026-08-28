package data

import (
	"context"
	"database/sql"
)

// migrate 顺序执行建表脚本；后续结构变更可引入带版本号的迁移。
func migrate(ctx context.Context, h *sql.DB) error {
	const schema = `
CREATE TABLE IF NOT EXISTS greeting_visits (
    id    INTEGER PRIMARY KEY CHECK (id = 1), -- 单行：全局计数
    count INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO greeting_visits (id, count) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    author     TEXT NOT NULL,
    body       TEXT NOT NULL,
    created_at TEXT NOT NULL
);
`
	_, err := h.ExecContext(ctx, schema)
	return err
}