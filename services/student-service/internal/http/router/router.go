package router

import (
	"student-service/internal/http/handler"

	"github.com/gin-gonic/gin"
)

func SetupRouter(h *handler.StudentHandler) *gin.Engine {
	r := gin.Default()

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "student-service",
		})
	})

	// API routes
	api := r.Group("/api/students")
	{
		api.POST("/profile", h.CreateProfile)
		api.GET("/profile", h.GetProfile)
		api.PUT("/profile", h.UpdateProfile)
		api.GET("/:id", h.GetByID)
	}

	return r
}
