package handler

import (
	"net/http"

	"application-service/internal/models"
	"application-service/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ChatHandler struct {
	chatRepo        repository.ChatRepository
	applicationRepo repository.ApplicationRepository
}

func NewChatHandler(chatRepo repository.ChatRepository, applicationRepo repository.ApplicationRepository) *ChatHandler {
	return &ChatHandler{chatRepo: chatRepo, applicationRepo: applicationRepo}
}

// GET /api/chat/:application_id
func (h *ChatHandler) GetMessages(c *gin.Context) {
	userID := c.GetHeader("X-User-ID")
	role := c.GetHeader("X-User-Role")
	if userID == "" || (role != "student" && role != "employer") {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	appID, err := uuid.Parse(c.Param("application_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid application_id"})
		return
	}

	uid, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user id"})
		return
	}

	// Verify the user is part of this application
	app, err := h.applicationRepo.GetByID(appID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "application not found"})
		return
	}
	if role == "student" && app.StudentID != uid {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	messages, err := h.chatRepo.GetByApplicationID(appID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch messages"})
		return
	}
	if messages == nil {
		messages = []models.ChatMessage{}
	}
	c.JSON(http.StatusOK, gin.H{"messages": messages})
}

// GET /api/applications/:id — internal endpoint used by api-gateway for chat notifications
func (h *ChatHandler) GetApplication(c *gin.Context) {
	appID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	app, err := h.applicationRepo.GetByID(appID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "application not found"})
		return
	}
	c.JSON(http.StatusOK, app)
}

// POST /api/chat/:application_id
func (h *ChatHandler) SendMessage(c *gin.Context) {
	userID := c.GetHeader("X-User-ID")
	role := c.GetHeader("X-User-Role")
	if userID == "" || (role != "student" && role != "employer") {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	appID, err := uuid.Parse(c.Param("application_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid application_id"})
		return
	}

	uid, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user id"})
		return
	}

	// Verify the user is part of this application
	app, err := h.applicationRepo.GetByID(appID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "application not found"})
		return
	}
	if role == "student" && app.StudentID != uid {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	var req struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "content is required"})
		return
	}

	msg := &models.ChatMessage{
		ApplicationID: appID,
		SenderID:      uid,
		SenderRole:    role,
		Content:       req.Content,
	}

	if err := h.chatRepo.Save(msg); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send message"})
		return
	}

	c.JSON(http.StatusCreated, msg)
}
