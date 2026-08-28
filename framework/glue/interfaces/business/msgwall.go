// Package business 业务领域契约：只声明形状，不写实现。
// 由对齐 Agent 依据 SPEC 翻译生成；冻结后只读，业务目录据此实现。
package business

import "pi-loop-harness/framework/business/msgwall"

// _ 静态锚定：契约引用的领域模型必须存在（留言板业务函数直接是 msgwall.New，无需额外接口）。
var _ = msgwall.Message{}

// MsgwallLine 留言展示形状契约：模板层依赖它，不直接 import business。
type MsgwallLine interface {
	// Author 留言者昵称；Body 留言内容。
	Author() string
	Body() string
}