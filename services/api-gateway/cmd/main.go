package main

import (
	"api-gateway/internal/config"
	"api-gateway/internal/router"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg, err := config.LoadConfig()
	if err != nil {
		panic(err)
	}
	r := gin.Default()
	router.SetupRoutes(r, cfg)
	log.Printf("Starting server at port %d...", cfg.Port)
	r.Run("localhost:8080")
}
