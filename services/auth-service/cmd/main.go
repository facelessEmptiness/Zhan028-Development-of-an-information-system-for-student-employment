package main

import (
	"auth-service/internal/config"
	"auth-service/internal/handler"
	"auth-service/internal/repository"
	"auth-service/internal/router"
	"auth-service/internal/service"
	"auth-service/pkg/email"
	"auth-service/pkg/jwt"
	"context"
	"log"

	"github.com/redis/go-redis/v9"
)

// @title Auth Service API
// @version 1.0
// @description Сервис аутентификации для системы трудоустройства студентов
// @host localhost:8081
// @BasePath /api

func main() {
	// Загрузка конфигурации из переменных окружения
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Ошибка загрузки конфигурации: %v", err)
	}

	// Подключение к базе данных PostgreSQL
	db, err := config.ConnectDatabase(cfg)
	if err != nil {
		log.Fatalf("Ошибка подключения к базе данных: %v", err)
	}

	// Инициализация JWT менеджера
	jwtManager := jwt.NewJWTManager(cfg.JWTSecret, cfg.JWTExpirationHours)

	// Инициализация email сервиса
	emailService := email.NewEmailService(
		cfg.SMTPHost,
		cfg.SMTPPort,
		cfg.SMTPUser,
		cfg.SMTPPassword,
		cfg.SMTPFrom,
	)

	// Подключение к Redis
	redisOpts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatalf("Ошибка парсинга Redis URL: %v", err)
	}
	redisClient := redis.NewClient(redisOpts)
	if err := redisClient.Ping(context.Background()).Err(); err != nil {
		log.Fatalf("Ошибка подключения к Redis: %v", err)
	}
	defer redisClient.Close()
	log.Println("Подключение к Redis установлено")

	// Инициализация слоёв приложения
	userRepo := repository.NewUserRepository(db)
	codeRepo := repository.NewRedisVerificationCodeRepository(redisClient)
	tokenRepo := repository.NewRedisRefreshTokenRepository(redisClient)
	authService := service.NewAuthService(userRepo, codeRepo, tokenRepo, jwtManager, emailService)
	authHandler := handler.NewAuthHandler(authService)

	// Создание и настройка роутера
	r := router.SetupRouter(authHandler, jwtManager, cfg.AllowedOrigins)

	// Запуск HTTP сервера
	log.Printf("Auth Service запущен на порту %s", cfg.ServerPort)
	if err := r.Run(":" + cfg.ServerPort); err != nil {
		log.Fatalf("Ошибка запуска сервера: %v", err)
	}
}
