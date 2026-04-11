package handler

import (
	"net/http"
	"time"

	"application-service/internal/models"
	"application-service/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type InterviewHandler struct {
	interviewRepo  repository.InterviewRepository
	applicationRepo repository.ApplicationRepository
}

func NewInterviewHandler(interviewRepo repository.InterviewRepository, applicationRepo repository.ApplicationRepository) *InterviewHandler {
	return &InterviewHandler{
		interviewRepo:  interviewRepo,
		applicationRepo: applicationRepo,
	}
}

// POST /api/interviews - employer schedules an interview
// Body: { application_id, student_id, vacancy_id, scheduled_at (RFC3339), location, notes }
func (h *InterviewHandler) Schedule(c *gin.Context) {
	employerID := c.GetHeader("X-User-ID")
	role := c.GetHeader("X-User-Role")
	if role != "employer" {
		c.JSON(http.StatusForbidden, gin.H{"error": "only employers can schedule interviews"})
		return
	}

	var req struct {
		ApplicationID string `json:"application_id" binding:"required"`
		StudentID     string `json:"student_id" binding:"required"`
		VacancyID     string `json:"vacancy_id" binding:"required"`
		ScheduledAt   string `json:"scheduled_at" binding:"required"`
		Location      string `json:"location"`
		Notes         string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	appID, err := uuid.Parse(req.ApplicationID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid application_id"})
		return
	}
	studentID, err := uuid.Parse(req.StudentID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid student_id"})
		return
	}
	vacancyID, err := uuid.Parse(req.VacancyID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid vacancy_id"})
		return
	}
	empID, err := uuid.Parse(employerID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid employer_id"})
		return
	}

	scheduledAt, err := time.Parse(time.RFC3339, req.ScheduledAt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid scheduled_at format, use RFC3339"})
		return
	}

	interview := &models.Interview{
		ApplicationID: appID,
		StudentID:     studentID,
		EmployerID:    empID,
		VacancyID:     vacancyID,
		ScheduledAt:   scheduledAt,
		Location:      req.Location,
		Notes:         req.Notes,
		Status:        "scheduled",
	}

	if err := h.interviewRepo.Create(interview); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to schedule interview"})
		return
	}

	c.JSON(http.StatusCreated, interview)
}

// GET /api/interviews/employer - employer views their scheduled interviews
func (h *InterviewHandler) GetForEmployer(c *gin.Context) {
	employerID := c.GetHeader("X-User-ID")
	role := c.GetHeader("X-User-Role")
	if role != "employer" {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	empID, err := uuid.Parse(employerID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid employer_id"})
		return
	}

	interviews, err := h.interviewRepo.GetByEmployerID(empID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch interviews"})
		return
	}
	if interviews == nil {
		interviews = []models.Interview{}
	}
	c.JSON(http.StatusOK, gin.H{"interviews": interviews})
}

// GET /api/interviews/student - student views their scheduled interviews
func (h *InterviewHandler) GetForStudent(c *gin.Context) {
	studentID := c.GetHeader("X-User-ID")
	role := c.GetHeader("X-User-Role")
	if role != "student" {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	sID, err := uuid.Parse(studentID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid student_id"})
		return
	}

	interviews, err := h.interviewRepo.GetByStudentID(sID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch interviews"})
		return
	}
	if interviews == nil {
		interviews = []models.Interview{}
	}
	c.JSON(http.StatusOK, gin.H{"interviews": interviews})
}

// GET /api/interviews/application/:application_id - get interview for specific application
func (h *InterviewHandler) GetByApplication(c *gin.Context) {
	appIDStr := c.Param("application_id")
	appID, err := uuid.Parse(appIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid application_id"})
		return
	}

	interview, err := h.interviewRepo.GetByApplicationID(appID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "interview not found"})
		return
	}

	c.JSON(http.StatusOK, interview)
}

// DELETE /api/interviews/:id - employer cancels an interview
func (h *InterviewHandler) Cancel(c *gin.Context) {
	employerID := c.GetHeader("X-User-ID")
	role := c.GetHeader("X-User-Role")
	if role != "employer" {
		c.JSON(http.StatusForbidden, gin.H{"error": "only employers can cancel interviews"})
		return
	}

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	interview, err := h.interviewRepo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "interview not found"})
		return
	}

	empID, _ := uuid.Parse(employerID)
	if interview.EmployerID != empID {
		c.JSON(http.StatusForbidden, gin.H{"error": "you can only cancel your own interviews"})
		return
	}

	if err := h.interviewRepo.UpdateStatus(id, "cancelled"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to cancel interview"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "interview cancelled"})
}
