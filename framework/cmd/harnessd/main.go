package main

import (
	"context"
	"embed"
	"html/template"
	"log"
	"net/http"
	"os"
	"strconv"

	"pi-loop-harness/framework/internal/db"
)

//go:embed web/templates
var templatesFS embed.FS

type Greeting struct {
	Title   string
	Message string
}

var store struct {
	count int
}

func main() {
	addr := ":8100"
	if v := os.Getenv("HARNESSD_ADDR"); v != "" {
		addr = v
	}
	dbPath := "data/harnessd.db"
	if v := os.Getenv("HARNESSD_DB"); v != "" {
		dbPath = v
	}

	handle, err := db.Open(context.Background(), dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer handle.Close()

	if err := handle.QueryRow("SELECT count FROM greeting_visits WHERE id = 1").Scan(&store.count); err != nil {
		log.Fatalf("读取计数失败: %v", err)
	}

	tmpl := template.Must(template.Must(
		template.New("hello.html").ParseFS(templatesFS, "web/templates/hello.html"),
	).ParseFS(templatesFS, "web/templates/greeting.html"))

	mux := http.NewServeMux()

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		data := Greeting{Title: "Hello, Framework", Message: "loop harness 工程骨架"}
		if err := tmpl.ExecuteTemplate(w, "hello.html", data); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	})

	mux.HandleFunc("/api/greet", func(w http.ResponseWriter, r *http.Request) {
		store.count++
		if _, err := handle.Exec("UPDATE greeting_visits SET count = ? WHERE id = 1", store.count); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		data := Greeting{Title: "循环问候", Message: "第 " + strconv.Itoa(store.count) + " 次循环"}
		if err := tmpl.ExecuteTemplate(w, "greeting.html", data); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	})

	mux.HandleFunc("/api/count", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte(strconv.Itoa(store.count)))
	})

	log.Printf("harnessd listening on %s (db=%s)", addr, dbPath)
	log.Fatal(http.ListenAndServe(addr, mux))
}