package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port                        string
	AuthServiceUrl              string
	DocumentServiceUrl          string
	ApplicationServiceHttpUrl   string
	StudentServiceGRPCUrl       string
	EmployerServiceGRPCUrl      string
	UniversityServiceGRPCUrl    string
	ApplicationServiceGRPCUrl   string
	JWTSecret                   string
	AllowedOrigins              []string
}

func LoadConfig() (*Config, error) {
	// Load .env (ignore error if file not found)
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: .env file not found, using environment variables")
	}

	config := &Config{
		Port:                       getEnvOrDefault("PORT", "8080"),
		AuthServiceUrl:             getEnvOrDefault("AUTH_SERVICE_URL", "http://localhost:8081"),
		DocumentServiceUrl:         getEnvOrDefault("DOCUMENT_SERVICE_URL", "http://localhost:8082"),
		ApplicationServiceHttpUrl:  getEnvOrDefault("APPLICATION_HTTP_URL", "http://localhost:8083"),
		StudentServiceGRPCUrl:      getEnvOrDefault("STUDENT_GRPC_URL", "localhost:50051"),
		EmployerServiceGRPCUrl:     getEnvOrDefault("EMPLOYER_GRPC_URL", "localhost:50052"),
		UniversityServiceGRPCUrl:   getEnvOrDefault("UNIVERSITY_GRPC_URL", "localhost:50053"),
		ApplicationServiceGRPCUrl:  getEnvOrDefault("APPLICATION_GRPC_URL", "localhost:50054"),
		JWTSecret:      getEnvOrDefault("JWT_SECRET", "your_super_secret_jwt_key_change_in_production"),
		AllowedOrigins: strings.Split(getEnvOrDefault("ALLOWED_ORIGINS", "http://localhost:3000"), ","),
	}

	if config.JWTSecret == "your_super_secret_jwt_key_change_in_production" {
		log.Println("WARNING: JWT_SECRET is set to the default value. Set JWT_SECRET env variable before deploying to production.")
	}

	return config, nil
}

// getEnvOrDefault returns the value of the environment variable or defaultValue
func getEnvOrDefault(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
