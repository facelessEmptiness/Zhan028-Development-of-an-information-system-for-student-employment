package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// InterviewHandler proxies interview requests to application-service HTTP
// and fires notifications to student-service.
type InterviewHandler struct {
	appServiceURL string
	httpClient    *http.Client
	notif         *NotificationClient
}

func NewInterviewHandler(appServiceHTTPURL string, notif *NotificationClient) *InterviewHandler {
	return &InterviewHandler{
		appServiceURL: appServiceHTTPURL,
		httpClient:    &http.Client{Timeout: 10 * time.Second},
		notif:         notif,
	}
}

// POST /api/interviews - employer schedules an interview
func (h *InterviewHandler) Schedule(c *gin.Context) {
	employerID := c.GetHeader("X-User-ID")
	role := c.GetHeader("X-User-Role")
	if role != "employer" {
		c.JSON(http.StatusForbidden, gin.H{"error": "only employers can schedule interviews"})
		return
	}

	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read request body"})
		return
	}

	// Decode to get student_id for notification
	var reqData map[string]interface{}
	if err := json.Unmarshal(body, &reqData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}

	// Forward to application-service HTTP
	url := fmt.Sprintf("%s/api/interviews", h.appServiceURL)
	proxyReq, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create proxy request"})
		return
	}
	proxyReq.Header.Set("Content-Type", "application/json")
	proxyReq.Header.Set("X-User-ID", employerID)
	proxyReq.Header.Set("X-User-Role", role)

	resp, err := h.httpClient.Do(proxyReq)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "application service unavailable"})
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	// On success, notify the student
	if resp.StatusCode == http.StatusCreated {
		studentID, _ := reqData["student_id"].(string)
		scheduledAt, _ := reqData["scheduled_at"].(string)
		location, _ := reqData["location"].(string)

		if studentID != "" {
			// Store as pipe-separated locale-neutral format: "date|location|notes"
			notifBody := formatScheduledAt(scheduledAt) + "|" + location
			notes, _ := reqData["notes"].(string)
			if notes != "" {
				notifBody += "|" + notes
			}

			// Parse the created interview ID for related_id
			var createdInterview map[string]interface{}
			relatedID := ""
			if json.Unmarshal(respBody, &createdInterview) == nil {
				if id, ok := createdInterview["id"].(string); ok {
					relatedID = id
				}
			}

			go h.notif.Send(
				studentID,
				"interview_scheduled",
				"Вас приглашают на собеседование 📅",
				notifBody,
				relatedID,
			)
		}
	}

	c.Data(resp.StatusCode, "application/json", respBody)
}

// GET /api/interviews/employer - employer views their scheduled interviews
func (h *InterviewHandler) GetForEmployer(c *gin.Context) {
	h.proxyToAppService(c, "GET", "/api/interviews/employer")
}

// GET /api/interviews/student - student views their scheduled interviews
func (h *InterviewHandler) GetForStudent(c *gin.Context) {
	h.proxyToAppService(c, "GET", "/api/interviews/student")
}

// GET /api/interviews/application/:application_id
func (h *InterviewHandler) GetByApplication(c *gin.Context) {
	appID := c.Param("application_id")
	h.proxyToAppService(c, "GET", "/api/interviews/application/"+appID)
}

// DELETE /api/interviews/:id - employer cancels an interview
func (h *InterviewHandler) Cancel(c *gin.Context) {
	id := c.Param("id")
	h.proxyToAppService(c, "DELETE", "/api/interviews/"+id)
}

// proxyToAppService forwards request to application-service HTTP and returns the response.
func (h *InterviewHandler) proxyToAppService(c *gin.Context, method, path string) {
	url := fmt.Sprintf("%s%s", h.appServiceURL, path)

	var bodyReader io.Reader
	if method != "GET" && method != "DELETE" {
		body, _ := io.ReadAll(c.Request.Body)
		bodyReader = bytes.NewReader(body)
	}

	proxyReq, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create proxy request"})
		return
	}
	proxyReq.Header.Set("Content-Type", "application/json")
	proxyReq.Header.Set("X-User-ID", c.GetHeader("X-User-ID"))
	proxyReq.Header.Set("X-User-Role", c.GetHeader("X-User-Role"))

	resp, err := h.httpClient.Do(proxyReq)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "application service unavailable"})
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", respBody)
}

// formatScheduledAt converts RFC3339 to a readable format.
func formatScheduledAt(s string) string {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return s
	}
	return t.Format("02.01.2006 15:04")
}
