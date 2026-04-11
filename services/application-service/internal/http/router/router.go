package router

import (
	"application-service/internal/http/handler"

	"github.com/gin-gonic/gin"
)

func SetupRouter(ih *handler.InterviewHandler) *gin.Engine {
	r := gin.Default()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "application-service"})
	})

	interviews := r.Group("/api/interviews")
	{
		interviews.POST("", ih.Schedule)
		interviews.GET("/employer", ih.GetForEmployer)
		interviews.GET("/student", ih.GetForStudent)
		interviews.GET("/application/:application_id", ih.GetByApplication)
		interviews.DELETE("/:id", ih.Cancel)
	}

	return r
}
