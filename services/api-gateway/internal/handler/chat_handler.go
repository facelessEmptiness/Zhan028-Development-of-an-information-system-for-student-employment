package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"api-gateway/internal/grpc/studentpb"
	"api-gateway/internal/grpc/vacancypb"

	"github.com/gin-gonic/gin"
)

type ChatHandler struct {
	appHTTPURL string
	notif      *NotificationClient
	vacancyCli vacancypb.VacancyServiceClient
	studentCli studentpb.StudentServiceClient
	httpClient *http.Client
}

func NewChatHandler(appHTTPURL string, notif *NotificationClient, vacancyCli vacancypb.VacancyServiceClient, studentCli studentpb.StudentServiceClient) *ChatHandler {
	return &ChatHandler{
		appHTTPURL: appHTTPURL,
		notif:      notif,
		vacancyCli: vacancyCli,
		studentCli: studentCli,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (h *ChatHandler) GetMessages(c *gin.Context) {
	applicationID := c.Param("application_id")
	h.proxy(c, "GET", fmt.Sprintf("/api/chat/%s", applicationID), nil)
}

func (h *ChatHandler) SendMessage(c *gin.Context) {
	applicationID := c.Param("application_id")
	senderID := c.GetHeader("X-User-ID")
	senderRole := c.GetHeader("X-User-Role")

	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
		return
	}

	url := fmt.Sprintf("%s/api/chat/%s", h.appHTTPURL, applicationID)
	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "proxy error"})
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-User-ID", senderID)
	req.Header.Set("X-User-Role", senderRole)

	resp, err := h.httpClient.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "application service unavailable"})
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", respBody)

	// Fire notification asynchronously after successful send
	if resp.StatusCode == http.StatusCreated {
		var payload struct {
			Content string `json:"content"`
		}
		_ = json.Unmarshal(body, &payload)
		go h.NotifyRecipient(applicationID, senderID, senderRole, payload.Content)
	}
}

// NotifyRecipient fetches the application to find the other party and sends a notification.
// The notification title is the sender's name and the body is a preview of the message
// text. Exported so ws_proxy can reuse it for WebSocket messages.
func (h *ChatHandler) NotifyRecipient(applicationID, senderID, senderRole, messageText string) {
	type appDetails struct {
		StudentID string `json:"student_id"`
		VacancyID string `json:"vacancy_id"`
	}

	r, err := h.httpClient.Get(fmt.Sprintf("%s/api/applications/%s", h.appHTTPURL, applicationID))
	if err != nil || r.StatusCode != http.StatusOK {
		return
	}
	defer r.Body.Close()

	var app appDetails
	if err := json.NewDecoder(r.Body).Decode(&app); err != nil {
		return
	}

	relatedID := applicationID + ":" + app.VacancyID
	var recipientID, senderName string

	if senderRole == "employer" {
		// recipientID is always known — don't block on vacancy fetch
		recipientID = app.StudentID
		senderName = "Работодатель"
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		if v, verr := h.vacancyCli.GetVacancyByID(ctx, &vacancypb.GetByIDRequest{Id: app.VacancyID}); verr == nil && v != nil {
			if cn := v.GetCompanyName(); cn != "" {
				senderName = cn
			}
		}
	} else {
		// Must fetch vacancy to get employer_id
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		v, verr := h.vacancyCli.GetVacancyByID(ctx, &vacancypb.GetByIDRequest{Id: app.VacancyID})
		if verr != nil || v == nil {
			return
		}
		recipientID = v.GetEmployerId()

		// Try to get student name — fallback to generic if it fails
		senderName = "Студент"
		if sp, serr := h.studentCli.GetProfile(ctx, &studentpb.GetProfileRequest{UserId: senderID}); serr == nil && sp != nil {
			if first, last := sp.GetFirstName(), sp.GetLastName(); first != "" || last != "" {
				senderName = strings.TrimSpace(fmt.Sprintf("%s %s", first, last))
			}
		}
	}

	// Title = sender name, body = message preview (fall back to a generic line).
	title := senderName
	body := strings.TrimSpace(messageText)
	if body == "" {
		body = "Отправил(а) вам сообщение"
	} else if r := []rune(body); len(r) > 120 {
		body = string(r[:120]) + "…"
	}

	if recipientID != "" && recipientID != senderID {
		h.notif.Send(recipientID, "chat_message", title, body, relatedID)
	}
}

func (h *ChatHandler) proxy(c *gin.Context, method, path string, body []byte) {
	url := fmt.Sprintf("%s%s", h.appHTTPURL, path)

	var bodyReader io.Reader
	if body != nil {
		bodyReader = bytes.NewReader(body)
	}

	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "proxy error"})
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-User-ID", c.GetHeader("X-User-ID"))
	req.Header.Set("X-User-Role", c.GetHeader("X-User-Role"))

	resp, err := h.httpClient.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "application service unavailable"})
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", respBody)
}
