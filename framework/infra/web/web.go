// Package web 渲染工具箱：加载模板并解析成可直接使用的 *template.Template。
package web

import (
	"embed"
	"html/template"
)

//go:embed templates/*.html
var fs embed.FS

// Templates 解析全部模板。
func Templates() (*template.Template, error) {
	return template.ParseFS(fs, "templates/*.html")
}

// MustTemplates 解析模板，失败即 panic（模板是启动期资产，值得立即崩溃）。
func MustTemplates() *template.Template {
	return template.Must(Templates())
}