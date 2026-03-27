package router

import (
	"employer-service/internal/handler"

	"github.com/gin-gonic/gin"
)

func SetupRouter(h *handler.VacancyHandler) *gin.Engine {
	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-ID, X-User-Role")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "employer-service"})
	})

	v := r.Group("/api/vacancies")
	{
		v.POST("", h.CreateVacancy)
		v.POST("/", h.CreateVacancy)
		v.GET("", h.GetAllVacancies)
		v.GET("/", h.GetAllVacancies)
		v.GET("/my", h.GetMyVacancies)
		v.GET("/:id", h.GetVacancyByID)
		v.PUT("/:id", h.UpdateVacancy)
		v.DELETE("/:id", h.DeleteVacancy)
	}

	return r
}
