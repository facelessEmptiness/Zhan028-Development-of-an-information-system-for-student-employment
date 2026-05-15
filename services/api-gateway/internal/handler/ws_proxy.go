package handler

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"api-gateway/internal/config"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
)

var wsUpgrader = websocket.Upgrader{
	CheckOrigin:     func(r *http.Request) bool { return true },
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
}

// WSChatProxy proxies WebSocket connections from the client to the application-service.
type WSChatProxy struct {
	appWSURL  string // e.g. ws://application-service:8083
	jwtSecret string
}

func NewWSChatProxy(cfg *config.Config) *WSChatProxy {
	// Convert http:// to ws://
	wsURL := strings.Replace(cfg.ApplicationServiceHttpUrl, "http://", "ws://", 1)
	wsURL = strings.Replace(wsURL, "https://", "wss://", 1)
	return &WSChatProxy{appWSURL: wsURL, jwtSecret: cfg.JWTSecret}
}

// ProxyChat — GET /ws/chat/:application_id?token=<jwt>
func (p *WSChatProxy) ProxyChat(c *gin.Context) {
	appID := c.Param("application_id")

	// Extract JWT from query parameter (browsers cannot set custom headers on WS)
	tokenStr := c.Query("token")
	if tokenStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "token required"})
		return
	}

	userID, userRole, err := parseJWT(tokenStr, p.jwtSecret)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return
	}

	// Upgrade the client connection
	clientConn, err := wsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer clientConn.Close()

	// Dial the backend WebSocket with user info as query params
	backendURL := fmt.Sprintf("%s/ws/chat/%s?user_id=%s&user_role=%s",
		p.appWSURL, appID, userID, userRole)
	backendConn, _, err := websocket.DefaultDialer.Dial(backendURL, nil)
	if err != nil {
		clientConn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseInternalServerErr, "backend unavailable"))
		return
	}
	defer backendConn.Close()

	done := make(chan struct{})

	// client → backend
	go func() {
		defer close(done)
		for {
			mt, msg, err := clientConn.ReadMessage()
			if err != nil {
				return
			}
			backendConn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := backendConn.WriteMessage(mt, msg); err != nil {
				return
			}
		}
	}()

	// backend → client
	for {
		mt, msg, err := backendConn.ReadMessage()
		if err != nil {
			return
		}
		clientConn.SetWriteDeadline(time.Now().Add(10 * time.Second))
		if err := clientConn.WriteMessage(mt, msg); err != nil {
			return
		}
	}
}

func parseJWT(tokenStr, secret string) (userID, role string, err error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return "", "", fmt.Errorf("invalid token")
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", "", fmt.Errorf("invalid claims")
	}
	userID, _ = claims["user_id"].(string)
	role, _ = claims["role"].(string)
	if userID == "" {
		// fallback: some tokens use "sub"
		userID, _ = claims["sub"].(string)
	}
	return userID, role, nil
}

