package config

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type Config struct {
	GRPCPort   string
	HTTPPort   string
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string

	// ComplianceSchedulerEnabled gates the nightly compliance job. Off by
	// default so production is unaffected until fact sourcing (step 5) is ready.
	ComplianceSchedulerEnabled  bool
	ComplianceSchedulerInterval time.Duration

	// StudentServiceURL is the base URL of student-service HTTP, used to deliver
	// student notifications (e.g. the AtRisk warning).
	StudentServiceURL string
}

func LoadConfig() (*Config, error) {
	_ = godotenv.Load()

	return &Config{
		GRPCPort:   getEnv("GRPC_PORT", "50054"),
		HTTPPort:   getEnv("HTTP_PORT", "8083"),
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5436"),
		DBUser:     getEnv("DB_USER", "postgres"),
		DBPassword: getEnv("DB_PASSWORD", "admin"),
		DBName:     getEnv("DB_NAME", "application_db"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),

		ComplianceSchedulerEnabled:  getEnv("COMPLIANCE_SCHEDULER_ENABLED", "false") == "true",
		ComplianceSchedulerInterval: getDurationEnv("COMPLIANCE_SCHEDULER_INTERVAL", 24*time.Hour),
		StudentServiceURL:           getEnv("STUDENT_SERVICE_URL", "http://student-service:8082"),
	}, nil
}

// getDurationEnv reads a Go duration string (e.g. "24h", "1m"); falls back to def.
func getDurationEnv(key string, def time.Duration) time.Duration {
	if value, exists := os.LookupEnv(key); exists {
		if d, err := time.ParseDuration(value); err == nil {
			return d
		}
		log.Printf("[config] invalid %s=%q, using default %s", key, value, def)
	}
	return def
}

func ConnectDatabase(cfg *Config) (*gorm.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode,
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("ошибка подключения к БД: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("ошибка получения SQL DB: %w", err)
	}
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	log.Println("Подключение к базе данных установлено")
	return db, nil
}

func (c *Config) GetMigrateURL() string {
	return fmt.Sprintf(
		"pgx5://%s:%s@%s:%s/%s?sslmode=%s",
		c.DBUser, c.DBPassword, c.DBHost, c.DBPort, c.DBName, c.DBSSLMode,
	)
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}
