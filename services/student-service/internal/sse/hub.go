package sse

import (
	"encoding/json"
	"sync"

	"github.com/google/uuid"
)

// Event is a server-sent event payload.
type Event struct {
	Type string `json:"type"`
	Data any    `json:"data"`
}

// Hub manages SSE client channels keyed by user ID.
type Hub struct {
	mu      sync.RWMutex
	clients map[uuid.UUID][]chan Event
}

func NewHub() *Hub {
	return &Hub{clients: make(map[uuid.UUID][]chan Event)}
}

// Subscribe returns a channel for the given user and a function to unsubscribe.
func (h *Hub) Subscribe(userID uuid.UUID) (<-chan Event, func()) {
	ch := make(chan Event, 8)
	h.mu.Lock()
	h.clients[userID] = append(h.clients[userID], ch)
	h.mu.Unlock()

	unsub := func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		list := h.clients[userID]
		for i, c := range list {
			if c == ch {
				h.clients[userID] = append(list[:i], list[i+1:]...)
				break
			}
		}
		close(ch)
	}
	return ch, unsub
}

// Push sends an event to all subscribers of a user.
func (h *Hub) Push(userID uuid.UUID, eventType string, data any) {
	h.mu.RLock()
	chans := h.clients[userID]
	h.mu.RUnlock()

	ev := Event{Type: eventType, Data: data}
	for _, ch := range chans {
		select {
		case ch <- ev:
		default: // drop if channel is full (slow client)
		}
	}
}

// Marshal serialises the event to SSE wire format.
func (ev Event) Marshal() ([]byte, error) {
	payload, err := json.Marshal(ev.Data)
	if err != nil {
		return nil, err
	}
	return []byte("event: " + ev.Type + "\ndata: " + string(payload) + "\n\n"), nil
}
