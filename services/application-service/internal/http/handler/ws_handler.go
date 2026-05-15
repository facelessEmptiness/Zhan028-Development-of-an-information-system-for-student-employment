package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"application-service/internal/models"
	"application-service/internal/repository"
	"application-service/internal/ws"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin:     func(r *http.Request) bool { return true },
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// WSChatHandler handles WebSocket connections for application chat rooms.
type WSChatHandler struct {
	hub             *ws.Hub
	chatRepo        repository.ChatRepository
	applicationRepo repository.ApplicationRepository
}

func NewWSChatHandler(hub *ws.Hub, chatRepo repository.ChatRepository, appRepo repository.ApplicationRepository) *WSChatHandler {
	return &WSChatHandler{hub: hub, chatRepo: chatRepo, applicationRepo: appRepo}
}

// ServeWS — GET /ws/chat/:application_id?user_id=...&user_role=...
// The api-gateway validates the JWT and injects user_id + user_role as query params.
func (h *WSChatHandler) ServeWS(c *gin.Context) {
	appID, err := uuid.Parse(c.Param("application_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid application_id"})
		return
	}

	userID, err := uuid.Parse(c.Query("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing or invalid user_id"})
		return
	}
	userRole := c.Query("user_role")
	if userRole != "student" && userRole != "employer" {
		c.JSON(http.StatusForbidden, gin.H{"error": "invalid role"})
		return
	}

	// Verify the user is a participant in this application
	app, err := h.applicationRepo.GetByID(appID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "application not found"})
		return
	}
	switch userRole {
	case "student":
		if app.StudentID != userID {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
	case "employer":
		if app.EmployerID != userID {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	cl := &ws.Client{AppID: appID, Send: make(chan []byte, 32)}
	h.hub.Register(cl)
	defer h.hub.Unregister(cl)

	// Writer goroutine — drains cl.Send and writes to WebSocket
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case data, ok := <-cl.Send:
				conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
				if !ok {
					conn.WriteMessage(websocket.CloseMessage, []byte{})
					return
				}
				if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
					return
				}
			case <-ticker.C:
				conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
				if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
					return
				}
			}
		}
	}()

	// Reader loop — blocks until client disconnects
	conn.SetReadLimit(4096)
	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			break
		}
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))

		var req struct {
			Content string `json:"content"`
		}
		if err := json.Unmarshal(raw, &req); err != nil || req.Content == "" {
			continue
		}

		msg := &models.ChatMessage{
			ApplicationID: appID,
			SenderID:      userID,
			SenderRole:    userRole,
			Content:       req.Content,
		}
		if err := h.chatRepo.Save(msg); err != nil {
			continue
		}

		data, _ := json.Marshal(msg)
		h.hub.Broadcast(appID, data)
	}
}
