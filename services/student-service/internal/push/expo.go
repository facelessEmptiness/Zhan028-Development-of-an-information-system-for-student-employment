package push

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const expoURL = "https://exp.host/--/api/v2/push/send"

type Message struct {
	To    string            `json:"to"`
	Title string            `json:"title"`
	Body  string            `json:"body"`
	Data  map[string]string `json:"data,omitempty"`
	Sound string            `json:"sound,omitempty"`
	Badge int               `json:"badge,omitempty"`
}

var httpClient = &http.Client{Timeout: 5 * time.Second}

func Send(token, title, body string, data map[string]string) error {
	if token == "" {
		return nil
	}

	msg := Message{
		To:    token,
		Title: title,
		Body:  body,
		Data:  data,
		Sound: "default",
	}
	payload, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", expoURL, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("expo push API returned %d", resp.StatusCode)
	}
	return nil
}
