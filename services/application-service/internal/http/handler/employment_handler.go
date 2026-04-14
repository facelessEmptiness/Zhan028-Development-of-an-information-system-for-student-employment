package handler

import (
	"net/http"
	"time"

	"application-service/internal/models"
	"application-service/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type EmploymentHandler struct {
	repo repository.EmploymentRepository
}

func NewEmploymentHandler(repo repository.EmploymentRepository) *EmploymentHandler {
	return &EmploymentHandler{repo: repo}
}

// POST /api/employment/internal — called by api-gateway when offer is made
func (h *EmploymentHandler) CreateInternal(c *gin.Context) {
	var req struct {
		StudentID     string `json:"student_id" binding:"required"`
		EmployerID    string `json:"employer_id" binding:"required"`
		ApplicationID string `json:"application_id" binding:"required"`
		VacancyID     string `json:"vacancy_id" binding:"required"`
		CompanyName   string `json:"company_name"`
		JobTitle      string `json:"job_title"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	studentID, _ := uuid.Parse(req.StudentID)
	employerID, _ := uuid.Parse(req.EmployerID)
	appID, _ := uuid.Parse(req.ApplicationID)
	vacancyID, _ := uuid.Parse(req.VacancyID)

	// Check if record already exists for this application
	existing, err := h.repo.GetByApplicationID(appID)
	if err == nil && existing != nil {
		c.JSON(http.StatusOK, existing)
		return
	}

	rec := &models.EmploymentRecord{
		StudentID:     studentID,
		EmployerID:    employerID,
		ApplicationID: appID,
		VacancyID:     vacancyID,
		CompanyName:   req.CompanyName,
		JobTitle:      req.JobTitle,
		StartedAt:     time.Now(),
		Status:        "active",
	}

	if err := h.repo.Create(rec); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create employment record"})
		return
	}

	c.JSON(http.StatusCreated, rec)
}

// GET /api/employment/student — student views own employment records
func (h *EmploymentHandler) GetForStudent(c *gin.Context) {
	studentID, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user"})
		return
	}

	recs, err := h.repo.GetByStudentID(studentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch records"})
		return
	}
	if recs == nil {
		recs = []models.EmploymentRecord{}
	}
	c.JSON(http.StatusOK, gin.H{"records": enrichWithDuration(recs)})
}

// GET /api/employment/university — university views all student employment records
// Accepts optional query: ?student_ids=uuid1,uuid2,...
func (h *EmploymentHandler) GetForUniversity(c *gin.Context) {
	role := c.GetHeader("X-User-Role")
	if role != "university" && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	studentIDsStr := c.Query("student_ids")
	var recs []models.EmploymentRecord
	var err error

	if studentIDsStr != "" {
		var ids []uuid.UUID
		for _, s := range splitCSV(studentIDsStr) {
			if id, e := uuid.Parse(s); e == nil {
				ids = append(ids, id)
			}
		}
		recs, err = h.repo.GetAllByUniversity(ids)
	} else {
		recs, err = h.repo.GetAll()
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch records"})
		return
	}
	if recs == nil {
		recs = []models.EmploymentRecord{}
	}
	c.JSON(http.StatusOK, gin.H{"records": enrichWithDuration(recs)})
}

// PUT /api/employment/:id/end — mark employment as ended
func (h *EmploymentHandler) End(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if err := h.repo.End(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to end employment"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "employment ended"})
}

// EmploymentRecordWithDuration wraps EmploymentRecord with computed fields
type EmploymentRecordWithDuration struct {
	models.EmploymentRecord
	DaysWorked     int    `json:"days_worked"`
	MonthsWorked   int    `json:"months_worked"`
	GrantFulfilled bool   `json:"grant_fulfilled"`
	RemainingDays  int    `json:"remaining_days"`
	Progress       int    `json:"progress"` // 0-100%
}

func enrichWithDuration(recs []models.EmploymentRecord) []EmploymentRecordWithDuration {
	result := make([]EmploymentRecordWithDuration, 0, len(recs))
	grantDays := models.GrantYears * 365

	for _, r := range recs {
		end := time.Now()
		if r.EndedAt != nil {
			end = *r.EndedAt
		}

		days := int(end.Sub(r.StartedAt).Hours() / 24)
		months := int(end.Sub(r.StartedAt).Hours() / 24 / 30)
		fulfilled := days >= grantDays
		remaining := grantDays - days
		if remaining < 0 {
			remaining = 0
		}
		progress := (days * 100) / grantDays
		if progress > 100 {
			progress = 100
		}

		// Auto-update status if grant fulfilled
		status := r.Status
		if fulfilled && status == "active" {
			status = "completed"
		}

		result = append(result, EmploymentRecordWithDuration{
			EmploymentRecord: r,
			DaysWorked:       days,
			MonthsWorked:     months,
			GrantFulfilled:   fulfilled,
			RemainingDays:    remaining,
			Progress:         progress,
		})
		_ = status
	}
	return result
}

func splitCSV(s string) []string {
	var result []string
	current := ""
	for _, c := range s {
		if c == ',' {
			if current != "" {
				result = append(result, current)
				current = ""
			}
		} else {
			current += string(c)
		}
	}
	if current != "" {
		result = append(result, current)
	}
	return result
}
