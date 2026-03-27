package config

import (
	"auth-service/internal/models"
	"fmt"
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ConnectDatabase устанавливает соединение с PostgreSQL и выполняет миграции
func ConnectDatabase(cfg *Config) (*gorm.DB, error) {
	// Настройка логгера GORM
	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	}

	// Подключение к базе данных
	db, err := gorm.Open(postgres.Open(cfg.GetDSN()), gormConfig)
	if err != nil {
		return nil, fmt.Errorf("ошибка подключения к базе данных: %w", err)
	}

	// Получение underlying SQL DB для настройки пула соединений
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("ошибка получения SQL DB: %w", err)
	}

	// Настройка пула соединений
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)

	// Автоматическая миграция моделей
	if err := runMigrations(db); err != nil {
		return nil, fmt.Errorf("ошибка миграции: %w", err)
	}

	log.Println("Успешное подключение к базе данных PostgreSQL")
	return db, nil
}

// runMigrations выполняет автоматическую миграцию всех моделей
func runMigrations(db *gorm.DB) error {
	// Создание типа enum для ролей, если не существует
	db.Exec(`
		DO $$ BEGIN
			CREATE TYPE user_role AS ENUM ('student', 'employer', 'university', 'admin');
		EXCEPTION
			WHEN duplicate_object THEN null;
		END $$;
	`)

	// Миграция модели User
	if err := db.AutoMigrate(&models.User{}); err != nil {
		return fmt.Errorf("ошибка миграции модели User: %w", err)
	}

	// Миграция модели VerificationCode
	if err := db.AutoMigrate(&models.VerificationCode{}); err != nil {
		return fmt.Errorf("ошибка миграции модели VerificationCode: %w", err)
	}

	log.Println("Миграции выполнены успешно")
	return nil
}
