package data

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

// Open 打开（必要时创建）SQLite 数据库，并执行建表迁移。
// path 形如 "data/harnessd.db"；文件不存在会自动创建，父目录缺失会自动创建。
func Open(ctx context.Context, path string) (*sql.DB, error) {
	if dir := filepath.Dir(path); dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, fmt.Errorf("mkdir %s: %w", dir, err)
		}
	}
	dsn := "file:" + path + "?cache=shared&_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)"
	handle, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	handle.SetMaxOpenConns(1) // SQLite 单写者：限制连接，避免锁竞争
	handle.SetConnMaxLifetime(time.Hour)

	if err := handle.PingContext(ctx); err != nil {
		handle.Close()
		return nil, fmt.Errorf("ping sqlite: %w", err)
	}
	if err := migrate(ctx, handle); err != nil {
		handle.Close()
		return nil, fmt.Errorf("migrate sqlite: %w", err)
	}
	return handle, nil
}