package hello

import "testing"

func TestGreet(t *testing.T) {
	got := Greet(GreetInput{Name: "Hello, Framework", Count: 3})
	if got.Title != "Hello, Framework" {
		t.Errorf("Title = %q, want %q", got.Title, "Hello, Framework")
	}
	if got.Message != "第 3 次循环" {
		t.Errorf("Message = %q, want %q", got.Message, "第 3 次循环")
	}
}

func TestGreetZeroCount(t *testing.T) {
	got := Greet(GreetInput{Name: "循环", Count: 0})
	if got.Message != "第 0 次循环" {
		t.Errorf("Message = %q, want %q", got.Message, "第 0 次循环")
	}
}