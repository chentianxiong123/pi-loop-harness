BIN := bin/harnessd
GO  := go

.PHONY: build run clean test vet

build:
	$(GO) build -o $(BIN) ./glue/assembly

run: build
	./$(BIN)

test:
	$(GO) test ./...

vet:
	$(GO) vet ./...

clean:
	rm -rf bin