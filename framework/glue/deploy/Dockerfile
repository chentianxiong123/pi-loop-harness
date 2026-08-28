# 构建
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/harnessd ./glue/assembly

# 运行
FROM alpine:latest
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=build /out/harnessd .
ENV HARNESSD_ADDR=:8100
EXPOSE 8100
CMD ["./harnessd"]