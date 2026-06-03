# Build stage
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Копируем go mod файлы
COPY go.mod go.sum ./
RUN go mod download

# Копируем весь код
COPY . .

# Собираем приложение
RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/main.go

# Run stage
FROM alpine:3.21

WORKDIR /app

# Копируем скомпилированный бинарник
COPY --from=builder /app/main .

# Если есть конфигурационные файлы
# COPY --from=builder /app/config ./config

EXPOSE 8081

CMD ["./main"]