package handler

import (
	"context"
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
	client studentpb.StudentServiceClient
}

func NewStudentHandler(client studentpb.StudentServiceClient) *StudentHandler {
	return &StudentHandler{client: client}
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

func (h *StudentHandler) GetProfile(c *gin.Context) {
	userID := c.GetHeader("X-User-ID")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := h.client.GetProfile(ctx, &studentpb.GetProfileRequest{UserId: userID})
	if err != nil {
		handleGRPCError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

// GET /api/students/:id — employer can view a student's public profile by user_id
func (h *StudentHandler) GetStudentByID(c *gin.Context) {
	userID := c.Param("id")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := h.client.GetProfile(ctx, &studentpb.GetProfileRequest{UserId: userID})
	if err != nil {
		handleGRPCError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *StudentHandler) UpdateProfile(c *gin.Context) {
	userID := c.GetHeader("X-User-ID")

	var req struct {
		FirstName      string  `json:"first_name"`
		LastName       string  `json:"last_name"`
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

	resp, err := h.client.UpdateProfile(ctx, &studentpb.UpdateProfileRequest{
		UserId:         userID,
		FirstName:      req.FirstName,
		LastName:       req.LastName,
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

	c.JSON(http.StatusOK, resp)
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
