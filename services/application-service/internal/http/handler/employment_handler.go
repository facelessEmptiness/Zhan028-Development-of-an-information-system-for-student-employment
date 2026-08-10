package handler

import (
	"net/http"
	"strings"
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
		StudentID      string `json:"student_id" binding:"required"`
		EmployerID     string `json:"employer_id" binding:"required"`
		ApplicationID  string `json:"application_id" binding:"required"`
		VacancyID      string `json:"vacancy_id" binding:"required"`
		CompanyName    string `json:"company_name"`
		JobTitle       string `json:"job_title"`
		UniversityID   string `json:"university_id"`
		GraduationYear int    `json:"graduation_year"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	studentID, err := uuid.Parse(req.StudentID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid student_id"})
		return
	}
	employerID, err := uuid.Parse(req.EmployerID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid employer_id"})
		return
	}
	appID, err := uuid.Parse(req.ApplicationID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid application_id"})
		return
	}
	vacancyID, err := uuid.Parse(req.VacancyID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid vacancy_id"})
		return
	}

	var universityID *uuid.UUID
	if req.UniversityID != "" {
		if uid, parseErr := uuid.Parse(req.UniversityID); parseErr == nil {
			universityID = &uid
		}
	}

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
		UniversityID:  universityID,
		CompanyName:   req.CompanyName,
		JobTitle:      req.JobTitle,
		StartedAt:     grantStartDate(req.GraduationYear),
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

// GET /api/employment/university — university views their students' employment records
// University role is scoped by X-University-ID header; admin sees all.
func (h *EmploymentHandler) GetForUniversity(c *gin.Context) {
	role := c.GetHeader("X-User-Role")
	if role != "university" && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	var recs []models.EmploymentRecord
	var err error

	universityIDStr := c.GetHeader("X-University-ID")
	studentIDsStr := c.Query("student_ids")

	if role == "university" && universityIDStr != "" {
		universityID, parseErr := uuid.Parse(universityIDStr)
		if parseErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid university_id"})
			return
		}
		recs, err = h.repo.GetByUniversityID(universityID)
	} else if studentIDsStr != "" {
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

// GET /api/employment/employer — employer views their own employment records
func (h *EmploymentHandler) GetForEmployer(c *gin.Context) {
	employerID, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user"})
		return
	}

	recs, err := h.repo.GetByEmployerID(employerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch records"})
		return
	}
	if recs == nil {
		recs = []models.EmploymentRecord{}
	}
	c.JSON(http.StatusOK, gin.H{"records": enrichWithDuration(recs)})
}

// PUT /api/employment/internal/end-by-application/:application_id
// Called by api-gateway: either from internal goroutine (no role header) or user-facing proxy (role header present).
// When X-User-Role is present, ownership is enforced. When absent (internal goroutine call), no check needed.
func (h *EmploymentHandler) EndByApplicationID(c *gin.Context) {
	applicationID, err := uuid.Parse(c.Param("application_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid application_id"})
		return
	}

	// Ownership check only when a user role is present (user-facing call via proxy).
	// Internal goroutine calls (auto-terminate on rejection) carry no role header.
	role := c.GetHeader("X-User-Role")
	if role != "" {
		rec, fetchErr := h.repo.GetByApplicationID(applicationID)
		if fetchErr != nil {
			// No active record — nothing to terminate, return success.
			c.JSON(http.StatusOK, gin.H{"message": "no active employment record"})
			return
		}
		switch role {
		case "employer":
			callerID, parseErr := uuid.Parse(c.GetHeader("X-User-ID"))
			if parseErr != nil || rec.EmployerID != callerID {
				c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
				return
			}
		case "university":
			callerUniID, parseErr := uuid.Parse(c.GetHeader("X-University-ID"))
			if parseErr != nil || rec.UniversityID == nil || *rec.UniversityID != callerUniID {
				c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
				return
			}
		case "admin":
			// admin may terminate any record
		default:
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
	}

	if err := h.repo.EndByApplicationID(applicationID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to end employment"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "employment terminated"})
}

// PUT /api/employment/:id/end — mark employment as ended
func (h *EmploymentHandler) End(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	rec, err := h.repo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "employment record not found"})
		return
	}

	role := c.GetHeader("X-User-Role")
	switch role {
	case "employer":
		callerID, parseErr := uuid.Parse(c.GetHeader("X-User-ID"))
		if parseErr != nil || rec.EmployerID != callerID {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
	case "university":
		callerUniID, parseErr := uuid.Parse(c.GetHeader("X-University-ID"))
		if parseErr != nil || rec.UniversityID == nil || *rec.UniversityID != callerUniID {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
	case "admin":
		// admin may end any record
	default:
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
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
	DaysWorked     int  `json:"days_worked"`
	MonthsWorked   int  `json:"months_worked"`
	GrantFulfilled bool `json:"grant_fulfilled"`
	RemainingDays  int  `json:"remaining_days"`
	Progress       int  `json:"progress"`    // 0-100%
	NotStarted     bool `json:"not_started"` // true if grant period hasn't begun yet
}

func enrichWithDuration(recs []models.EmploymentRecord) []EmploymentRecordWithDuration {
	result := make([]EmploymentRecordWithDuration, 0, len(recs))
	grantDays := models.GrantYears * 365
	now := time.Now()

	for _, r := range recs {
		// Grant period hasn't started yet (e.g. graduation year is in the future)
		if r.StartedAt.After(now) {
			result = append(result, EmploymentRecordWithDuration{
				EmploymentRecord: r,
				DaysWorked:       0,
				MonthsWorked:     0,
				GrantFulfilled:   false,
				RemainingDays:    grantDays,
				Progress:         0,
				NotStarted:       true,
			})
			continue
		}

		end := now
		if r.EndedAt != nil {
			end = *r.EndedAt
		}

		days := int(end.Sub(r.StartedAt).Hours() / 24)
		months := int(end.Sub(r.StartedAt).Hours() / 24 / 30)
		fulfilled := days >= grantDays
		remaining := max(grantDays-days, 0)
		progress := min((days*100)/grantDays, 100)

		if fulfilled && r.Status == "active" {
			r.Status = "completed"
		}

		result = append(result, EmploymentRecordWithDuration{
			EmploymentRecord: r,
			DaysWorked:       days,
			MonthsWorked:     months,
			GrantFulfilled:   fulfilled,
			RemainingDays:    remaining,
			Progress:         progress,
			NotStarted:       false,
		})
	}
	return result
}

func splitCSV(s string) []string {
	return strings.Split(s, ",")
}

// grantStartDate returns September 1 of the student's graduation year.
// If graduation_year is 0 or unknown, falls back to the nearest past September 1.
func grantStartDate(graduationYear int) time.Time {
	if graduationYear > 0 {
		return time.Date(graduationYear, time.September, 1, 0, 0, 0, 0, time.UTC)
	}
	now := time.Now()
	sep1 := time.Date(now.Year(), time.September, 1, 0, 0, 0, 0, time.UTC)
	if now.Before(sep1) {
		sep1 = sep1.AddDate(-1, 0, 0)
	}
	return sep1
}
