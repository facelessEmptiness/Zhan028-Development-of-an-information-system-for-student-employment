# Build stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

COPY . .

RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/main.go

# Run stage
FROM alpine:3.21

WORKDIR /app

COPY --from=builder /app/main .

EXPOSE 50053

CMD ["./main"]
