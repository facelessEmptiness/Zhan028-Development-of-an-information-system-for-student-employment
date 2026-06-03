package router

import (
	"application-service/internal/http/handler"

	"github.com/gin-gonic/gin"
)

func SetupRouter(ih *handler.InterviewHandler, eh *handler.EmploymentHandler, ch *handler.ChatHandler, wsh *handler.WSChatHandler, coh *handler.ComplianceHandler) *gin.Engine {
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
		employment.GET("/employer", eh.GetForEmployer)
		employment.PUT("/:id/end", eh.End)
	}

	compliance := r.Group("/api/compliance")
	{
		compliance.POST("/enroll", coh.Enroll)
		compliance.GET("/student/:student_id", coh.GetForStudent)
		compliance.POST("/student/:student_id/evidence", coh.ApplyEvidence)
		compliance.GET("/university", coh.GetForUniversity)
	}

	// Internal endpoint: get application by ID (used by api-gateway for chat notifications)
	r.GET("/api/applications/:id", ch.GetApplication)

	chat := r.Group("/api/chat")
	{
		chat.GET("/:application_id", ch.GetMessages)
		chat.POST("/:application_id", ch.SendMessage)
	}

	// WebSocket chat endpoint
	r.GET("/ws/chat/:application_id", wsh.ServeWS)

	return r
}
