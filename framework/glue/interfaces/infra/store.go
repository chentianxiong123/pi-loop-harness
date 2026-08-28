// Package infra 基础设施契约：只声明形状，不写实现。
// 实现方在基础设施目录（如 infra/data）；本层不写实现。
package infra

import "context"

// Store 访问计数这块基础设施承诺的能力。
type Store interface {
	// Count 返回累计访问次数。
	Count(ctx context.Context) (int, error)
	// Incr 访问次数加一，返回新值。
	Incr(ctx context.Context) (int, error)
}