package main

import (
	"auth-service/internal/config"
	"auth-service/internal/handler"
	"auth-service/internal/repository"
	"auth-service/internal/router"
	"auth-service/internal/service"
	"auth-service/pkg/email"
	"auth-service/pkg/jwt"
	"log"
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

	// Инициализация слоёв приложения
	userRepo := repository.NewUserRepository(db)
	codeRepo := repository.NewVerificationCodeRepository(db)
	authService := service.NewAuthService(userRepo, codeRepo, jwtManager, emailService)
	authHandler := handler.NewAuthHandler(authService)

	// Создание и настройка роутера
	r := router.SetupRouter(authHandler, jwtManager)

	// Запуск HTTP сервера
	log.Printf("Auth Service запущен на порту %s", cfg.ServerPort)
	if err := r.Run(":" + cfg.ServerPort); err != nil {
		log.Fatalf("Ошибка запуска сервера: %v", err)
	}
}
