package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port               string
	AuthServiceUrl     string
	StudentServiceUrl  string
	EmployerServiceUrl string
	JWTSecret          string
}

func LoadConfig() (*Config, error) {
	// Загружаем .env (игнорируем ошибку если файла нет)
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: .env file not found, using environment variables")
	}

	// Читаем с значениями по умолчанию
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" // Значение по умолчанию
	}

	config := &Config{
		Port:               getEnvOrDefault("PORT", "http://localhost:8080"),
		AuthServiceUrl:     getEnvOrDefault("AUTH_SERVICE_URL", "http://localhost:8081"),
		StudentServiceUrl:  getEnvOrDefault("STUDENT_SERVICE_URL", "http://localhost:8082"),
		EmployerServiceUrl: getEnvOrDefault("EMPLOYER_SERVICE_URL", "http://localhost:8083"),
		JWTSecret:          os.Getenv("JWT_SECRET"),
	}

	return config, nil
}

// Вспомогательная функция
func getEnvOrDefault(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
