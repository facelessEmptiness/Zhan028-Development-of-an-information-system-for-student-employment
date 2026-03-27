package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// NotificationClient sends fire-and-forget HTTP requests to student-service
// internal notification endpoint.
type NotificationClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewNotificationClient(studentServiceHttpURL string) *NotificationClient {
	return &NotificationClient{
		baseURL: studentServiceHttpURL,
		httpClient: &http.Client{
			Timeout: 3 * time.Second,
		},
	}
}

type createNotifRequest struct {
	UserID    string `json:"user_id"`
	Type      string `json:"type"`
	Title     string `json:"title"`
	Body      string `json:"body"`
	RelatedID string `json:"related_id,omitempty"`
}

// Send is fire-and-forget — errors are logged but do not affect the caller.
func (c *NotificationClient) Send(userID, notifType, title, body, relatedID string) {
	payload := createNotifRequest{
		UserID:    userID,
		Type:      notifType,
		Title:     title,
		Body:      body,
		RelatedID: relatedID,
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}

	url := fmt.Sprintf("%s/api/notifications/internal", c.baseURL)
	resp, err := c.httpClient.Post(url, "application/json", bytes.NewReader(data))
	if err != nil {
		return
	}
	resp.Body.Close()
}
