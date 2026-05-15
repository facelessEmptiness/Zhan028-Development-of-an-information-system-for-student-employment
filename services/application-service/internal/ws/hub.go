package ws

import (
	"sync"

	"github.com/google/uuid"
)

// Client represents a single WebSocket connection in a chat room.
type Client struct {
	AppID uuid.UUID
	Send  chan []byte
}

// Hub manages chat room participants.
type Hub struct {
	mu    sync.RWMutex
	rooms map[uuid.UUID]map[*Client]bool
}

func NewHub() *Hub {
	return &Hub{rooms: make(map[uuid.UUID]map[*Client]bool)}
}

// Register adds a client to its application room.
func (h *Hub) Register(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[c.AppID] == nil {
		h.rooms[c.AppID] = make(map[*Client]bool)
	}
	h.rooms[c.AppID][c] = true
}

// Unregister removes a client from its room and closes its send channel.
func (h *Hub) Unregister(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	room := h.rooms[c.AppID]
	if _, ok := room[c]; ok {
		delete(room, c)
		close(c.Send)
		if len(room) == 0 {
			delete(h.rooms, c.AppID)
		}
	}
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
			// slow client — drop message to avoid blocking
		}
	}
}
