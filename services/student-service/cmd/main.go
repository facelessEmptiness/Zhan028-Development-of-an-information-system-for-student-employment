package main

import (
	"log"

	"student-service/internal/config"
	"student-service/internal/http/handler"
	"student-service/internal/http/router"
	"student-service/internal/repository"
	"student-service/internal/service"
)

func main() {
	// 1. Загрузка конфигурации
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Ошибка загрузки конфигурации: %v", err)
	}

	// 2. Подключение к базе данных
	db, err := config.ConnectDatabase(cfg)
	if err != nil {
		log.Fatalf("Ошибка подключения к базе данных: %v", err)
	}

	// 3. Инициализация слоёв
	studentRepo := repository.NewStudentRepository(db)
	studentService := service.NewStudentService(studentRepo)
	studentHandler := handler.NewStudentHandler(studentService)

	// 4. Создание роутера
	r := router.SetupRouter(studentHandler)

	// 5. Запуск сервера
	log.Printf("🚀 Student Service запущен на порту %s", cfg.ServerPort)
	if err := r.Run(":" + cfg.ServerPort); err != nil {
		log.Fatalf("Ошибка запуска сервера: %v", err)
	}
}
