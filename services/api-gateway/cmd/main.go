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

	address := ":" + cfg.Port // ✅ :8080
	log.Printf("Starting server at %s...", address)
	r.Run(address)
}
