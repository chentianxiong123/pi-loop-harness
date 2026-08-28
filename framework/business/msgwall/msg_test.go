package msgwall

import (
	"strings"
	"testing"
	"time"
)

func TestNewValid(t *testing.T) {
	at := time.Unix(0, 0)
	got, err := New(" 张三 ", "  你好世界  ", at)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Author != "张三" || got.Body != "你好世界" {
		t.Fatalf("trim not applied: %+v", got)
	}
	if !got.At.Equal(at) {
		t.Fatalf("time not carried: %v", got.At)
	}
}

func TestNewValidation(t *testing.T) {
	cases := []struct {
		name   string
		author string
		body   string
	}{
		{"empty author", "  ", "hello"},
		{"empty body", "a", "   "},
		{"both empty", "", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if _, err := New(c.author, c.body, time.Now()); err == nil {
				t.Fatal("expected error, got nil")
			}
		})
	}
}

func TestNewTooLong(t *testing.T) {
	if _, err := New("a", strings.Repeat("x", MaxBody+1), time.Now()); err == nil {
		t.Fatal("expected too-long error")
	}
}

func TestLines(t *testing.T) {
	loc := time.FixedZone("T", 0)
	ms := []Message{
		{ID: 2, Author: "b", Body: "second", At: time.Unix(200, 0).In(loc)},
		{ID: 1, Author: "a", Body: "first", At: time.Unix(100, 0).In(loc)},
	}
	lines := Lines(ms)
	if len(lines) != 2 {
		t.Fatalf("want 2 lines, got %d", len(lines))
	}
	if lines[0].ID != 2 || lines[0].At != "1970-01-01 00:03" {
		t.Fatalf("bad first line: %+v", lines[0])
	}
	if lines[1].ID != 1 || lines[1].At != "1970-01-01 00:01" {
		t.Fatalf("bad second line: %+v", lines[1])
	}
}