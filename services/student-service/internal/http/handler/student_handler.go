package handler

import (
	"errors"
	"net/http"
	"student-service/internal/dto"
	"student-service/internal/models"
	"student-service/internal/repository"
	"student-service/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type StudentHandler struct {
	service *service.StudentService
}

func NewStudentHandler(s *service.StudentService) *StudentHandler {
	return &StudentHandler{service: s}
}

// CreateProfile - POST /api/students/profile
func (h *StudentHandler) CreateProfile(c *gin.Context) {
	// Получаем user_id из header (передаёт API Gateway)
	userIDStr := c.GetHeader("X-User-ID")
	role := c.GetHeader("X-User-Role")
	if role != "student" {
		c.JSON(403, gin.H{"error": "Only students can create student profile"})
		return
	}
	if userIDStr == "" {
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{Error: "User ID не найден"})
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Неверный формат User ID"})
		return
	}

	// Парсим body
	var req dto.CreateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: err.Error()})
		return
	}

	// Создаём профиль
	student, err := h.service.CreateProfile(userID, req)
	if err != nil {
		if errors.Is(err, service.ErrProfileAlreadyExists) {
			c.JSON(http.StatusConflict, dto.ErrorResponse{Error: err.Error()})
			return
		}
		if errors.Is(err, service.ErrIINAlreadyTaken) {
			c.JSON(http.StatusConflict, dto.ErrorResponse{Error: err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Ошибка создания профиля"})
		return
	}

	c.JSON(http.StatusCreated, toStudentResponse(student))
}

// GetProfile - GET /api/students/profile
func (h *StudentHandler) GetProfile(c *gin.Context) {
	userIDStr := c.GetHeader("X-User-ID")
	if userIDStr == "" {
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{Error: "User ID не найден"})
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Неверный формат User ID"})
		return
	}

	student, err := h.service.GetProfile(userID)
	if err != nil {
		if errors.Is(err, repository.ErrStudentNotFound) {
			c.JSON(http.StatusNotFound, dto.ErrorResponse{Error: "Профиль не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Ошибка получения профиля"})
		return
	}

	c.JSON(http.StatusOK, toStudentResponse(student))
}

// GetByID - GET /api/students/:id (для других сервисов)
func (h *StudentHandler) GetByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Неверный формат ID"})
		return
	}

	student, err := h.service.GetByID(id)
	if err != nil {
		if errors.Is(err, repository.ErrStudentNotFound) {
			c.JSON(http.StatusNotFound, dto.ErrorResponse{Error: "Студент не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Ошибка получения данных"})
		return
	}

	c.JSON(http.StatusOK, toStudentResponse(student))
}

// UpdateProfile - PUT /api/students/profile
func (h *StudentHandler) UpdateProfile(c *gin.Context) {
	userIDStr := c.GetHeader("X-User-ID")
	if userIDStr == "" {
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{Error: "User ID не найден"})
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Неверный формат User ID"})
		return
	}

	var req dto.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: err.Error()})
		return
	}

	student, err := h.service.UpdateProfile(userID, req)
	if err != nil {
		if errors.Is(err, repository.ErrStudentNotFound) {
			c.JSON(http.StatusNotFound, dto.ErrorResponse{Error: "Профиль не найден"})
			return
		}
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Ошибка обновления профиля"})
		return
	}

	c.JSON(http.StatusOK, toStudentResponse(student))
}

// toStudentResponse конвертирует модель в DTO
func toStudentResponse(s *models.Student) dto.StudentResponse {
	resp := dto.StudentResponse{
		ID:        s.ID.String(),
		UserID:    s.UserID.String(),
		FirstName: s.FirstName,
		LastName:  s.LastName,
		IIN:       s.IIN,
		CreatedAt: s.CreatedAt,
		UpdatedAt: s.UpdatedAt,
	}
	if s.UniversityID != nil {
		resp.UniversityID = s.UniversityID.String()
	}
	return resp
}
