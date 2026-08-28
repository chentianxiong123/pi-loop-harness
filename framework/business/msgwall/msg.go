// Package msgwall 留言板示例业务：展示"从表单抽象业务"的写法。
// 纯函数层：只含业务规则，不碰 HTTP/DB/template。
package msgwall

import (
	"errors"
	"strings"
	"time"
)

// MaxBody 一条留言的最大长度。
const MaxBody = 500

// Message 一条留言（业务形状）。
type Message struct {
	ID     int64
	Author string
	Body   string
	At     time.Time
}

// New 校验并构造一条留言。纯函数：时间由调用方传入（数据层填时），保证本层无副作用。
func New(author, body string, at time.Time) (Message, error) {
	a := strings.TrimSpace(author)
	b := strings.TrimSpace(body)
	if a == "" {
		return Message{}, errors.New("author is required")
	}
	if b == "" {
		return Message{}, errors.New("body is required")
	}
	if len(b) > MaxBody {
		return Message{}, errors.New("body too long")
	}
	return Message{Author: a, Body: b, At: at}, nil
}

// Line 给模板的展示形状：时间已格式化好，模板不碰 time 包。
type Line struct {
	ID     int64
	Author string
	Body   string
	At     string
}

// Lines 把领域形状转成展示形状（业务负责排版规则，模板只管画）。
func Lines(ms []Message) []Line {
	out := make([]Line, 0, len(ms))
	for _, m := range ms {
		out = append(out, Line{
			ID:     m.ID,
			Author: m.Author,
			Body:   m.Body,
			At:     m.At.Format("2006-01-02 15:04"),
		})
	}
	return out
}