package ws

import (
	"encoding/json"
	"sync"

	"github.com/google/uuid"
)

// Client represents a single WebSocket connection in a chat room.
type Client struct {
	AppID  uuid.UUID
	UserID uuid.UUID
	Send   chan []byte
}

// PresenceEvent is sent over WebSocket when a user connects or disconnects.
type PresenceEvent struct {
	Type   string    `json:"type"`
	UserID uuid.UUID `json:"user_id"`
	Online bool      `json:"online"`
}

// Hub manages chat room participants and user presence.
type Hub struct {
	mu        sync.RWMutex
	rooms     map[uuid.UUID]map[*Client]bool
	userConns map[uuid.UUID]int // userID → number of active connections
}

func NewHub() *Hub {
	return &Hub{
		rooms:     make(map[uuid.UUID]map[*Client]bool),
		userConns: make(map[uuid.UUID]int),
	}
}

// Register adds a client to its application room, then broadcasts presence.
func (h *Hub) Register(c *Client) {
	h.mu.Lock()
	if h.rooms[c.AppID] == nil {
		h.rooms[c.AppID] = make(map[*Client]bool)
	}
	h.rooms[c.AppID][c] = true
	h.userConns[c.UserID]++
	h.mu.Unlock()

	// Tell the new client who else is already in the room.
	h.sendRoomPresenceTo(c)
	// Tell everyone in the room that this user just came online.
	h.broadcastPresence(c.AppID, c.UserID, true)
}

// Unregister removes a client from its room and broadcasts presence if needed.
func (h *Hub) Unregister(c *Client) {
	h.mu.Lock()
	room := h.rooms[c.AppID]
	if _, ok := room[c]; ok {
		delete(room, c)
		close(c.Send)
		if len(room) == 0 {
			delete(h.rooms, c.AppID)
		}
	}
	h.userConns[c.UserID]--
	stillOnline := h.userConns[c.UserID] > 0
	if !stillOnline {
		delete(h.userConns, c.UserID)
	}
	h.mu.Unlock()

	if !stillOnline {
		h.broadcastPresence(c.AppID, c.UserID, false)
	}
}

// IsOnline returns true if the user has at least one active WS connection.
func (h *Hub) IsOnline(userID uuid.UUID) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.userConns[userID] > 0
}

// Broadcast sends data to all clients in the given room.
func (h *Hub) Broadcast(appID uuid.UUID, data []byte) {
	h.mu.RLock()
	room := h.rooms[appID]
	h.mu.RUnlock()

	for c := range room {
		select {
		case c.Send <- data:
		default:
			// slow client — drop to avoid blocking
		}
	}
}

// broadcastPresence sends a presence event to all clients in the room.
func (h *Hub) broadcastPresence(appID, userID uuid.UUID, online bool) {
	data, _ := json.Marshal(PresenceEvent{Type: "presence", UserID: userID, Online: online})
	h.Broadcast(appID, data)
}

// sendRoomPresenceTo sends the current online status of all OTHER users in the
// room directly to the newly connected client.
func (h *Hub) sendRoomPresenceTo(target *Client) {
	h.mu.RLock()
	seen := make(map[uuid.UUID]bool)
	var onlineUsers []uuid.UUID
	for c := range h.rooms[target.AppID] {
		if c.UserID != target.UserID && !seen[c.UserID] {
			seen[c.UserID] = true
			onlineUsers = append(onlineUsers, c.UserID)
		}
	}
	h.mu.RUnlock()

	for _, uid := range onlineUsers {
		data, _ := json.Marshal(PresenceEvent{Type: "presence", UserID: uid, Online: true})
		select {
		case target.Send <- data:
		default:
		}
	}
}
