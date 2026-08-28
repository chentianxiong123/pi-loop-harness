// Package infra 基础设施契约：只声明形状，不写实现。
// 实现方在基础设施目录（如 infra/data）；本层不写实现。
package infra

import (
	"context"

	"pi-loop-harness/framework/business/msgwall"
)

// Store 基础设施承诺的能力：计数（hello 演示） + 留言持久化（msgwall 演示）。
type Store interface {
	// Count 返回累计访问次数。
	Count(ctx context.Context) (int, error)
	// Incr 访问次数加一，返回新值。
	Incr(ctx context.Context) (int, error)
	// CreateMessage 插入一条留言，返回带 ID 的完整消息。
	CreateMessage(ctx context.Context, author, body string) (msgwall.Message, error)
	// ListMessages 返回最新 limit 条留言（新→旧）。
	ListMessages(ctx context.Context, limit int) ([]msgwall.Message, error)
}