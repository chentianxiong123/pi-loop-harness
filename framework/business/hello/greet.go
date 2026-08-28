package hello

import "fmt"

// GreetInput 问候业务输入。
type GreetInput struct {
	Name  string
	Count int
}

// Greeting 问候数据形状。
type Greeting struct {
	Title   string
	Message string
}

// Greet 纯业务函数：根据名称与次数生成问候数据。
// 不碰 HTTP、不碰 DB、不 import 任何外部库。
func Greet(in GreetInput) Greeting {
	return Greeting{
		Title:   in.Name,
		Message: fmt.Sprintf("第 %d 次循环", in.Count),
	}
}