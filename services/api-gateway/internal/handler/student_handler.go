package handler

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	"api-gateway/internal/grpc/studentpb"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

type StudentHandler struct {
	client         studentpb.StudentServiceClient
	studentHTTPURL string
	httpClient     *http.Client
}

func NewStudentHandler(client studentpb.StudentServiceClient, studentHTTPURL string) *StudentHandler {
	return &StudentHandler{
		client:         client,
		studentHTTPURL: studentHTTPURL,
		httpClient:     &http.Client{Timeout: 10 * time.Second},
	}
}

func (h *StudentHandler) CreateProfile(c *gin.Context) {
	userID := c.GetHeader("X-User-ID")

	var req struct {
		FirstName      string  `json:"first_name"`
		LastName       string  `json:"last_name"`
		IIN            string  `json:"iin"`
		UniversityID   string  `json:"university_id"`
		Skills         string  `json:"skills"`
		GPA            float64 `json:"gpa"`
		Specialization string  `json:"specialization"`
		GraduationYear int32   `json:"graduation_year"`
		Bio            string  `json:"bio"`
		Phone          string  `json:"phone"`
		LocationCity   string  `json:"location_city"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := h.client.CreateProfile(ctx, &studentpb.CreateProfileRequest{
		UserId:         userID,
		FirstName:      req.FirstName,
		LastName:       req.LastName,
		Iin:            req.IIN,
		UniversityId:   req.UniversityID,
		Skills:         req.Skills,
		Gpa:            req.GPA,
		Specialization: req.Specialization,
		GraduationYear: req.GraduationYear,
		Bio:            req.Bio,
		Phone:          req.Phone,
		LocationCity:   req.LocationCity,
	})
	if err != nil {
		handleGRPCError(c, err)
		return
	}

	c.JSON(http.StatusCreated, resp)
}

// GET /api/students/profile — student views own profile (proxied to student-service HTTP)
func (h *StudentHandler) GetProfile(c *gin.Context) {
	h.proxyToStudentHTTP(c, "GET", "/api/students/profile", nil)
}

// GET /api/students/:id — employer views student profile (proxied to student-service HTTP)
func (h *StudentHandler) GetStudentByID(c *gin.Context) {
	userID := c.Param("id")
	h.proxyToStudentHTTP(c, "GET", fmt.Sprintf("/api/students/%s", userID), nil)
}

// PUT /api/students/profile — student updates own profile (proxied to student-service HTTP)
func (h *StudentHandler) UpdateProfile(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
		return
	}
	h.proxyToStudentHTTP(c, "PUT", "/api/students/profile", body)
}

// proxyToStudentHTTP forwards a request to student-service HTTP and returns the response.
func (h *StudentHandler) proxyToStudentHTTP(c *gin.Context, method, path string, body []byte) {
	url := fmt.Sprintf("%s%s", h.studentHTTPURL, path)

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
		c.JSON(http.StatusBadGateway, gin.H{"error": "student service unavailable"})
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", respBody)
}

// GET /api/students — university users see their own students only
func (h *StudentHandler) ListStudentsByUniversity(c *gin.Context) {
	universityID := c.GetHeader("X-University-ID")
	if universityID == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "university_id required"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	md := metadata.New(map[string]string{"university-id": universityID})
	ctx = metadata.NewOutgoingContext(ctx, md)

	stream, err := h.client.GetStudentsByUniversity(ctx, &studentpb.StatsEmpty{})
	if err != nil {
		handleGRPCError(c, err)
		return
	}

	var students []interface{}
	for {
		student, err := stream.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			handleGRPCError(c, err)
			return
		}
		students = append(students, student)
	}

	if students == nil {
		students = []interface{}{}
	}
	c.JSON(http.StatusOK, gin.H{"students": students, "total": len(students)})
}

func handleGRPCError(c *gin.Context, err error) {
	st, ok := status.FromError(err)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	switch st.Code() {
	case codes.NotFound:
		c.JSON(http.StatusNotFound, gin.H{"error": st.Message()})
	case codes.AlreadyExists:
		c.JSON(http.StatusConflict, gin.H{"error": st.Message()})
	case codes.InvalidArgument:
		c.JSON(http.StatusBadRequest, gin.H{"error": st.Message()})
	case codes.PermissionDenied:
		c.JSON(http.StatusForbidden, gin.H{"error": st.Message()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": st.Message()})
	}
}
