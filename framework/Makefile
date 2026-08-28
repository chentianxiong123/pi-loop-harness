BIN := bin/harnessd
GO  := go

.PHONY: build run clean

build:
	$(GO) build -o $(BIN) ./glue/assembly

run: build
	./$(BIN)

clean:
	rm -rf bin