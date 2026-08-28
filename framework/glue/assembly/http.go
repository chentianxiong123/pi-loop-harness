package main

import (
	"database/sql"
	"html/template"
	"net/http"
	"strconv"
	"time"

	"pi-loop-harness/framework/business/hello"
	"pi-loop-harness/framework/business/msgwall"
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

// msgwallHandler 留言板：表单 POST → 业务校验 → 持久化 → htmx 局部刷新列表。
type msgwallHandler struct {
	tmpl *template.Template
	s    infra.Store
}

func (h *msgwallHandler) MsgwallPage(w http.ResponseWriter, r *http.Request) {
	msgs, err := h.s.ListMessages(r.Context(), 50)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	data := struct {
		Title string
		Lines []msgwall.Line
	}{Title: "留言板 · 全栈 Hello World", Lines: msgwall.Lines(msgs)}
	if err := h.tmpl.ExecuteTemplate(w, "msgwall.html", data); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// MsgwallSubmit 处理表单提交：POST → 业务 New（校验）→ 持久化 → 渲染列表片段。
// htmx 端 hx-post + hx-target => 返回的片段原地替换列表。
func (h *msgwallHandler) MsgwallSubmit(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad form", http.StatusBadRequest)
		return
	}
	m, err := msgwall.New(r.FormValue("author"), r.FormValue("body"), time.Now())
	if err != nil {
		// htmx 对 4xx/5xx 默认不 swap 片段，故用 200 + HX-Retarget 把错误就地渲染。
		w.Header().Set("HX-Retarget", "#msg-error")
		_ = h.tmpl.ExecuteTemplate(w, "msg-error.html", struct {
			Error string
		}{err.Error()})
		return
	}
	if _, err := h.s.CreateMessage(r.Context(), m.Author, m.Body); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	msgs, err := h.s.ListMessages(r.Context(), 50)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	_ = h.tmpl.ExecuteTemplate(w, "msg-list.html", struct{ Lines []msgwall.Line }{Lines: msgwall.Lines(msgs)})
}

// registerRoutes 组装 Http 接口：把业务能力暴露成端点。
func registerRoutes(mux *http.ServeMux, db *sql.DB) {
	h := &greetHandler{tmpl: web.MustTemplates(), s: &processor{db: db}}
	mw := &msgwallHandler{tmpl: web.MustTemplates(), s: &processor{db: db}}
	mux.HandleFunc("/", h.home)
	mux.HandleFunc("/api/greet", h.greetOnce)
	mux.HandleFunc("/api/count", h.count)

	mux.HandleFunc("/msgwall", mw.MsgwallPage)
	mux.HandleFunc("/msgwall/new", mw.MsgwallSubmit)
}