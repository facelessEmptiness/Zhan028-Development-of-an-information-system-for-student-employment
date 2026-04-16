package router

import (
	"application-service/internal/http/handler"

	"github.com/gin-gonic/gin"
)

func SetupRouter(ih *handler.InterviewHandler, eh *handler.EmploymentHandler, ch *handler.ChatHandler) *gin.Engine {
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

	employment := r.Group("/api/employment")
	{
		employment.POST("/internal", eh.CreateInternal)
		employment.GET("/student", eh.GetForStudent)
		employment.GET("/university", eh.GetForUniversity)
		employment.PUT("/:id/end", eh.End)
	}

	// Internal endpoint: get application by ID (used by api-gateway for chat notifications)
	r.GET("/api/applications/:id", ch.GetApplication)

	chat := r.Group("/api/chat")
	{
		chat.GET("/:application_id", ch.GetMessages)
		chat.POST("/:application_id", ch.SendMessage)
	}

	return r
}
