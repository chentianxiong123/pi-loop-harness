// Package business 业务领域契约：只声明形状，不写实现。
// 由对齐 Agent 依据 SPEC 翻译生成；冻结后只读，业务目录据此实现。
package business

import "pi-loop-harness/framework/business/hello"

// Greeter 业务契约：声明"生成问候"这一业务能力。
// 实现方在业务函数目录；本层不写实现。
type Greeter interface {
	// Greet 返回一次问候数据。
	Greet(in hello.GreetInput) hello.Greeting
}

// _ 静态锚定：契约引用的领域模型必须存在。
var _ = hello.GreetInput{}