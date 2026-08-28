package main

import (
	"database/sql"
	"html/template"
	"net/http"
	"strconv"

	"pi-loop-harness/framework/business/hello"
	"pi-loop-harness/framework/glue/interfaces/infra"
	"pi-loop-harness/framework/infra/web"
)

// greetHandler 把业务函数 Greet 暴露成 HTTP 端点。
// 纯胶水：取数（Store 契约）→ 调业务函数 → 渲染模板。
type greetHandler struct {
	tmpl *template.Template
	s    infra.Store
}

func (h *greetHandler) home(w http.ResponseWriter, r *http.Request) {
	count, err := h.s.Count(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	data := hello.Greet(hello.GreetInput{Name: "Hello, Framework", Count: count})
	if err := h.tmpl.ExecuteTemplate(w, "hello.html", data); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (h *greetHandler) greetOnce(w http.ResponseWriter, r *http.Request) {
	count, err := h.s.Incr(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	data := hello.Greet(hello.GreetInput{Name: "循环问候", Count: count})
	if err := h.tmpl.ExecuteTemplate(w, "greeting.html", data); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (h *greetHandler) count(w http.ResponseWriter, r *http.Request) {
	count, err := h.s.Count(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte(strconv.Itoa(count)))
}

// registerRoutes 组装 Http 接口：把业务能力暴露成端点。
func registerRoutes(mux *http.ServeMux, db *sql.DB) {
	h := &greetHandler{tmpl: web.MustTemplates(), s: &processor{db: db}}
	mux.HandleFunc("/", h.home)
	mux.HandleFunc("/api/greet", h.greetOnce)
	mux.HandleFunc("/api/count", h.count)
}