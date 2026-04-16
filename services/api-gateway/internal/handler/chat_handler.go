package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"api-gateway/internal/grpc/vacancypb"

	"github.com/gin-gonic/gin"
)

type ChatHandler struct {
	appHTTPURL string
	notif      *NotificationClient
	vacancyCli vacancypb.VacancyServiceClient
	httpClient *http.Client
}

func NewChatHandler(appHTTPURL string, notif *NotificationClient, vacancyCli vacancypb.VacancyServiceClient) *ChatHandler {
	return &ChatHandler{
		appHTTPURL: appHTTPURL,
		notif:      notif,
		vacancyCli: vacancyCli,
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
		go h.notifyRecipient(applicationID, senderID, senderRole)
	}
}

// notifyRecipient fetches the application to find the other party and sends a notification.
func (h *ChatHandler) notifyRecipient(applicationID, senderID, senderRole string) {
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

	var recipientID, title, body string

	if senderRole == "employer" {
		// Notify the student
		recipientID = app.StudentID
		title = "💬 Новое сообщение"
		body = "Работодатель написал вам в чате"
	} else {
		// Notify the employer — fetch vacancy to get employer_id
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		v, err := h.vacancyCli.GetVacancyByID(ctx, &vacancypb.GetByIDRequest{Id: app.VacancyID})
		if err != nil || v == nil {
			return
		}
		recipientID = v.GetEmployerId()
		title = "💬 Новое сообщение"
		body = "Студент ответил на ваше сообщение"
	}

	if recipientID != "" && recipientID != senderID {
		// related_id format: "applicationId:vacancyId" — used by frontend to deep-link into chat
		relatedID := applicationID + ":" + app.VacancyID
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
