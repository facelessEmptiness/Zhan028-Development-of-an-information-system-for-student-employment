package router

import (
	"student-service/internal/http/handler"

	"github.com/gin-gonic/gin"
)

func SetupRouter(sh *handler.StudentHandler, dh *handler.DocumentHandler, nh *handler.NotificationHandler) *gin.Engine {
	r := gin.Default()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "student-service"})
	})

	// Student routes
	students := r.Group("/api/students")
	{
		students.POST("/profile", sh.CreateProfile)
		students.GET("/profile", sh.GetProfile)
		students.PUT("/profile", sh.UpdateProfile)
		students.GET("/:id", sh.GetByID)
	}

	// Document routes — role checks rely on X-User-Role set by API Gateway
	docs := r.Group("/api/documents")
	{
		docs.POST("/upload", dh.Upload)
		docs.GET("/my", dh.ListMy)
		docs.GET("/student/:user_id", dh.ListByStudent)
		docs.GET("/:id/download", dh.Download)
		docs.GET("/pending-count", dh.PendingCount)
		docs.PUT("/auto-verify/:user_id", dh.AutoVerify)
		docs.PUT("/:id/verify", dh.Verify)
		docs.PUT("/:id/reject", dh.Reject)
		docs.DELETE("/:id", dh.Delete)
	}

	// Notification routes
	notifs := r.Group("/api/notifications")
	{
		notifs.GET("", nh.ListMy)
		notifs.GET("/unread-count", nh.UnreadCount)
		notifs.GET("/stream", nh.Stream)
		notifs.PUT("/read-all", nh.MarkAllRead)
		notifs.PUT("/:id/read", nh.MarkRead)
		// Internal endpoint called by API Gateway — no JWT check here (gateway already validated)
		notifs.POST("/internal", nh.CreateInternal)
	}

	return r
}
