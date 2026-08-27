package main

import (
	"embed"
	"html/template"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strconv"
)

//go:embed web/templates
var templatesFS embed.FS

type Greeting struct {
	Title   string
	Message string
}

func main() {
	addr := ":8100"
	if v := os.Getenv("HARNESSD_ADDR"); v != "" {
		addr = v
	}

	tplFS, err := fs.Sub(templatesFS, "web/templates")
	if err != nil {
		log.Fatal(err)
	}
	tmpl := template.Must(template.ParseFS(tplFS, "*.html"))
	count := 0

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		data := Greeting{Title: "Hello, Framework", Message: "loop harness 工程骨架"}
		if err := tmpl.ExecuteTemplate(w, "hello.html", data); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	})

	http.HandleFunc("/api/greet", func(w http.ResponseWriter, r *http.Request) {
		count++
		data := Greeting{Title: "循环问候", Message: "第 " + strconv.Itoa(count) + " 次循环"}
		if err := tmpl.ExecuteTemplate(w, "greeting.html", data); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	})

	log.Printf("harnessd listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}