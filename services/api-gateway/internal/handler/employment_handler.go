package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// EmploymentHandler proxies employment requests to application-service HTTP.
type EmploymentHandler struct {
	appServiceURL string
	httpClient    *http.Client
}

func NewEmploymentHandler(appServiceHTTPURL string) *EmploymentHandler {
	return &EmploymentHandler{
		appServiceURL: appServiceHTTPURL,
		httpClient:    &http.Client{Timeout: 10 * time.Second},
	}
}

// GET /api/employment/student - student views own employment records
func (h *EmploymentHandler) GetForStudent(c *gin.Context) {
	h.proxy(c, "GET", "/api/employment/student", nil)
}

// GET /api/employment/university - university views all employment records
func (h *EmploymentHandler) GetForUniversity(c *gin.Context) {
	role := c.GetHeader("X-User-Role")
	if role != "university" && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}
	path := "/api/employment/university"
	if qs := c.Request.URL.RawQuery; qs != "" {
		path += "?" + qs
	}
	h.proxy(c, "GET", path, nil)
}

// GET /api/employment/employer - employer views employment records they created
func (h *EmploymentHandler) GetForEmployer(c *gin.Context) {
	role := c.GetHeader("X-User-Role")
	if role != "employer" && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}
	h.proxy(c, "GET", "/api/employment/employer", nil)
}

// PUT /api/employment/:id/end - mark employment as ended (employer or university/admin)
func (h *EmploymentHandler) End(c *gin.Context) {
	role := c.GetHeader("X-User-Role")
	if role != "employer" && role != "university" && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}
	id := c.Param("id")
	h.proxy(c, "PUT", fmt.Sprintf("/api/employment/%s/end", id), nil)
}

// CreateInternal is called internally by UpdateStatus when status → "offered".
// It is NOT exposed as a public route — called directly from UpdateStatus handler.
func CreateEmploymentRecord(appServiceURL string, payload map[string]any) {
	client := &http.Client{Timeout: 5 * time.Second}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", appServiceURL+"/api/employment/internal", bytes.NewReader(body))
	if err != nil {
		log.Printf("[employment] failed to create request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[employment] failed to create record for student %v: %v", payload["student_id"], err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		log.Printf("[employment] unexpected status %d for student %v", resp.StatusCode, payload["student_id"])
	}
}

func (h *EmploymentHandler) proxy(c *gin.Context, method, path string, extraBody []byte) {
	url := fmt.Sprintf("%s%s", h.appServiceURL, path)

	var bodyReader io.Reader
	if method != "GET" && method != "DELETE" {
		if extraBody != nil {
			bodyReader = bytes.NewReader(extraBody)
		} else {
			body, err := io.ReadAll(c.Request.Body)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read request body"})
				return
			}
			bodyReader = bytes.NewReader(body)
		}
	}

	proxyReq, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "proxy request error"})
		return
	}
	proxyReq.Header.Set("Content-Type", "application/json")
	proxyReq.Header.Set("X-User-ID", c.GetHeader("X-User-ID"))
	proxyReq.Header.Set("X-User-Role", c.GetHeader("X-User-Role"))
	if uid := c.GetHeader("X-University-ID"); uid != "" {
		proxyReq.Header.Set("X-University-ID", uid)
	}

	resp, err := h.httpClient.Do(proxyReq)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "application service unavailable"})
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", respBody)
}
