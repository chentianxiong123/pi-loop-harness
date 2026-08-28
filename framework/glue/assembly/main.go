package main

import (
	"context"
	"database/sql"
	"net/http"
	"os"

	"pi-loop-harness/framework/glue/interfaces/infra"
	"pi-loop-harness/framework/infra/data"
)

// addr 与 dbPath 由环境变量覆盖，避免改代码。
func loadEnv() (addr, dbPath string) {
	addr = ":8100"
	if v := os.Getenv("HARNESSD_ADDR"); v != "" {
		addr = v
	}
	dbPath = "data/harnessd.db"
	if v := os.Getenv("HARNESSD_DB"); v != "" {
		dbPath = v
	}
	return addr, dbPath
}

// main 组装车间：把基础设施与业务函数拼成可运行进程，不做任何业务逻辑。
func main() {
	addr, dbPath := loadEnv()

	handle, err := data.Open(context.Background(), dbPath)
	if err != nil {
		panic(err)
	}
	defer handle.Close()

	mux := http.NewServeMux()
	registerRoutes(mux, handle)

	if err := http.ListenAndServe(addr, mux); err != nil {
		panic(err)
	}
}

// processor 把基础设施（SQLite）适配成契约 Store，供业务路由使用。
// 编译期断言：processor 必须满足 infra.Store 契约。
type processor struct{ db *sql.DB }

var _ infra.Store = (*processor)(nil)

func (p *processor) Count(ctx context.Context) (int, error) {
	return data.LoadCount(ctx, p.db)
}

func (p *processor) Incr(ctx context.Context) (int, error) {
	return data.IncrCount(ctx, p.db)
}