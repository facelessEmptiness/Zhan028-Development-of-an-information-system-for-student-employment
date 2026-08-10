package handler

import (
	"errors"
	"net/http"
	"time"

	"application-service/internal/compliance"
	"application-service/internal/models"
	"application-service/internal/repository"
	"application-service/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ComplianceHandler exposes the university-facing compliance surface:
// enrolling grant students and reading their records.
type ComplianceHandler struct {
	svc   service.ComplianceService
	facts service.FactProvider
}

func NewComplianceHandler(svc service.ComplianceService, facts service.FactProvider) *ComplianceHandler {
	return &ComplianceHandler{svc: svc, facts: facts}
}

// Enroll registers a grant student for compliance tracking.
// POST /api/compliance/enroll  (university or admin)
func (h *ComplianceHandler) Enroll(c *gin.Context) {
	role := c.GetHeader("X-User-Role")
	if role != "university" && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	var req struct {
		StudentID      string     `json:"student_id" binding:"required"`
		UniversityID   string     `json:"university_id"`
		GrantYears     int        `json:"grant_years"`
		GraduationDate *time.Time `json:"graduation_date"`
		Deadline       *time.Time `json:"deadline"`
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

	universityID, ok := h.resolveUniversity(c, role, req.UniversityID)
	if !ok {
		return // resolveUniversity already wrote the error response
	}

	rec, err := h.svc.StartTracking(studentID, universityID, req.GrantYears, req.GraduationDate, req.Deadline)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to enroll student"})
		return
	}

	// Immediately evaluate the new record so the state reflects current reality
	// (e.g. AtRisk for graduates with no offer who enrolled long after graduation)
	// rather than waiting up to 24h for the nightly scheduler.
	hasOffer, factErr := h.facts.HasQualifyingOffer(rec)
	if factErr == nil {
		h.svc.Evaluate(rec, time.Now(), hasOffer) //nolint:errcheck
	}

	c.JSON(http.StatusCreated, rec)
}

// resolveUniversity determines the university scope for a write: university
// staff are pinned to their own university (X-University-ID); an admin may
// supply one in the body, or none.
func (h *ComplianceHandler) resolveUniversity(c *gin.Context, role, bodyUniversityID string) (*uuid.UUID, bool) {
	if role == "university" {
		uid, err := uuid.Parse(c.GetHeader("X-University-ID"))
		if err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "university scope required"})
			return nil, false
		}
		return &uid, true
	}
	// admin
	if bodyUniversityID == "" {
		return nil, true
	}
	uid, err := uuid.Parse(bodyUniversityID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid university_id"})
		return nil, false
	}
	return &uid, true
}

// GetForStudent returns one student's compliance record.
// GET /api/compliance/student/:student_id
func (h *ComplianceHandler) GetForStudent(c *gin.Context) {
	studentID, err := uuid.Parse(c.Param("student_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid student_id"})
		return
	}

	rec, err := h.svc.GetByStudent(studentID)
	if errors.Is(err, repository.ErrComplianceNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "compliance record not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch record"})
		return
	}

	if !h.canRead(c, rec) {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}
	c.JSON(http.StatusOK, rec)
}

// canRead enforces who may view a record: admin any; university only its own
// students; a student only their own record.
func (h *ComplianceHandler) canRead(c *gin.Context, rec *models.ComplianceRecord) bool {
	switch c.GetHeader("X-User-Role") {
	case "admin":
		return true
	case "university":
		uid, err := uuid.Parse(c.GetHeader("X-University-ID"))
		return err == nil && rec.UniversityID != nil && *rec.UniversityID == uid
	case "student":
		uid, err := uuid.Parse(c.GetHeader("X-User-ID"))
		return err == nil && rec.StudentID == uid
	default:
		return false
	}
}

// GetForUniversity lists compliance records for a university — powers the
// dashboard and at-risk panel.
// GET /api/compliance/university  (university: own; admin: ?university_id=)
func (h *ComplianceHandler) GetForUniversity(c *gin.Context) {
	role := c.GetHeader("X-User-Role")
	if role != "university" && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	var universityID uuid.UUID
	var err error
	if role == "university" {
		universityID, err = uuid.Parse(c.GetHeader("X-University-ID"))
	} else {
		universityID, err = uuid.Parse(c.Query("university_id"))
	}
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "university_id required"})
		return
	}

	recs, err := h.svc.ListByUniversity(universityID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch records"})
		return
	}
	if recs == nil {
		recs = []models.ComplianceRecord{}
	}
	c.JSON(http.StatusOK, gin.H{"records": recs})
}

// GetAllForAdmin returns all compliance records across all universities.
// GET /api/compliance/admin/all  (admin only)
func (h *ComplianceHandler) GetAllForAdmin(c *gin.Context) {
	if c.GetHeader("X-User-Role") != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}
	recs, err := h.svc.ListAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch records"})
		return
	}
	if recs == nil {
		recs = []models.ComplianceRecord{}
	}
	c.JSON(http.StatusOK, gin.H{"records": recs})
}

// ApplyEvidence performs an evidence-driven transition to Compliant or Exempt.
// POST /api/compliance/student/:student_id/evidence  (university or admin)
//
// A referenced supporting document (evidence_doc_id) is required — it is the
// "verified supporting documentation" the machine demands.
func (h *ComplianceHandler) ApplyEvidence(c *gin.Context) {
	role := c.GetHeader("X-User-Role")
	if role != "university" && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	studentID, err := uuid.Parse(c.Param("student_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid student_id"})
		return
	}

	actorID, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user id"})
		return
	}

	var req struct {
		Target        string `json:"target" binding:"required"` // "Compliant" or "Exempt"
		EvidenceDocID string `json:"evidence_doc_id"`
		ExemptReason  string `json:"exempt_reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Scope: university staff may act only on their own students (admin: any).
	existing, err := h.svc.GetByStudent(studentID)
	if errors.Is(err, repository.ErrComplianceNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "compliance record not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch record"})
		return
	}
	if !h.canRead(c, existing) {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	var evidenceDocID *uuid.UUID
	if req.EvidenceDocID != "" {
		id, parseErr := uuid.Parse(req.EvidenceDocID)
		if parseErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid evidence_doc_id"})
			return
		}
		evidenceDocID = &id
	}
	hasVerifiedDocs := evidenceDocID != nil

	rec, err := h.svc.ApplyEvidence(studentID, compliance.State(req.Target), role, actorID, evidenceDocID, req.ExemptReason, hasVerifiedDocs)
	if err != nil {
		switch {
		case errors.Is(err, repository.ErrComplianceNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "compliance record not found"})
		case errors.Is(err, compliance.ErrUnauthorized):
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		case errors.Is(err, compliance.ErrEvidenceRequired):
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		case errors.Is(err, compliance.ErrInvalidTransition):
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to apply transition"})
		}
		return
	}
	c.JSON(http.StatusOK, rec)
}
