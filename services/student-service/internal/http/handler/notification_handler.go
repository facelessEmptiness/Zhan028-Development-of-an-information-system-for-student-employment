package handler

import (
	"fmt"
	"net/http"
	"student-service/internal/models"
	"student-service/internal/repository"
	"student-service/internal/sse"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type NotificationHandler struct {
	repo repository.NotificationRepository
	hub  *sse.Hub
}

func NewNotificationHandler(repo repository.NotificationRepository, hub *sse.Hub) *NotificationHandler {
	return &NotificationHandler{repo: repo, hub: hub}
}

// GET /api/notifications
func (h *NotificationHandler) ListMy(c *gin.Context) {
	uid, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid X-User-ID"})
		return
	}

	notifs, err := h.repo.FindByUserID(uid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch notifications"})
		return
	}
	if notifs == nil {
		notifs = []*models.Notification{}
	}
	c.JSON(http.StatusOK, gin.H{"notifications": notifs})
}

// GET /api/notifications/unread-count
func (h *NotificationHandler) UnreadCount(c *gin.Context) {
	uid, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid X-User-ID"})
		return
	}

	count, err := h.repo.CountUnread(uid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to count"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// PUT /api/notifications/read-all
func (h *NotificationHandler) MarkAllRead(c *gin.Context) {
	uid, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid X-User-ID"})
		return
	}

	if err := h.repo.MarkAllRead(uid); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "all notifications marked as read"})
}

// PUT /api/notifications/:id/read
func (h *NotificationHandler) MarkRead(c *gin.Context) {
	uid, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid X-User-ID"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if err := h.repo.MarkRead(id, uid); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "notification marked as read"})
}

// POST /api/notifications/internal — called by API Gateway (no JWT check)
func (h *NotificationHandler) CreateInternal(c *gin.Context) {
	var req struct {
		UserID    string `json:"user_id" binding:"required"`
		Type      string `json:"type" binding:"required"`
		Title     string `json:"title" binding:"required"`
		Body      string `json:"body"`
		RelatedID string `json:"related_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	uid, err := uuid.Parse(req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user_id"})
		return
	}

	n := &models.Notification{
		UserID:    uid,
		Type:      req.Type,
		Title:     req.Title,
		Body:      req.Body,
		RelatedID: req.RelatedID,
	}
	if err := h.repo.Create(n); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create notification"})
		return
	}

	// Push to any active SSE subscribers for this user
	h.hub.Push(uid, req.Type, n)

	c.JSON(http.StatusCreated, n)
}

// GET /api/notifications/stream — Server-Sent Events endpoint
func (h *NotificationHandler) Stream(c *gin.Context) {
	uid, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid X-User-ID"})
		return
	}

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	ch, unsub := h.hub.Subscribe(uid)
	defer unsub()

	// Send a keep-alive comment immediately so the browser knows the stream started
	fmt.Fprint(c.Writer, ": connected\n\n")
	c.Writer.Flush()

	clientGone := c.Request.Context().Done()
	for {
		select {
		case <-clientGone:
			return
		case ev, ok := <-ch:
			if !ok {
				return
			}
			data, err := ev.Marshal()
			if err != nil {
				continue
			}
			c.Writer.Write(data)
			c.Writer.Flush()
		}
	}
}
