package service

import (
	"time"

	"application-service/internal/compliance"
	"application-service/internal/models"
	"application-service/internal/repository"

	"github.com/google/uuid"
)

// Notifier is the hook used to notify a student when their record becomes AtRisk.
// It is intentionally minimal so the service can be tested without a real
// notification transport; a nil Notifier disables notifications.
type Notifier interface {
	NotifyAtRisk(studentID uuid.UUID)
}

// ComplianceService orchestrates the grant-obligation state machine over
// persisted records. It contains no transition rules of its own — those live in
// the pure compliance package; this layer only loads, applies and saves.
type ComplianceService interface {
	GetByStudent(studentID uuid.UUID) (*models.ComplianceRecord, error)
	// ListByUniversity returns all compliance records for a university — the
	// data source for the university dashboard and the at-risk panel.
	ListByUniversity(universityID uuid.UUID) ([]models.ComplianceRecord, error)
	// StartTracking creates a NotYetDue record for a grant student, or returns
	// the existing one (idempotent).
	StartTracking(studentID uuid.UUID, universityID *uuid.UUID, grantYears int, graduationDate, deadline *time.Time) (*models.ComplianceRecord, error)
	// Evaluate applies the time-driven rules (the nightly job's per-record step).
	// hasQualifyingOffer is the externally-sourced fact; graduation date and
	// deadline are read from the record. It persists only on a real change and
	// reports whether the state changed.
	Evaluate(rec *models.ComplianceRecord, now time.Time, hasQualifyingOffer bool) (bool, error)
	// ApplyEvidence performs an evidence-driven transition to Compliant or Exempt
	// (verified university staff only), recording the audit trail.
	ApplyEvidence(studentID uuid.UUID, target compliance.State, actorRole string, actorID uuid.UUID, evidenceDocID *uuid.UUID, exemptReason string, hasVerifiedDocs bool) (*models.ComplianceRecord, error)
	// EvaluateAll applies the time-driven rules to every non-terminal record —
	// the work the nightly scheduler performs on each pass.
	EvaluateAll(now time.Time, facts FactProvider) (EvaluationReport, error)
	// ListAll returns every compliance record — admin monitoring only.
	ListAll() ([]models.ComplianceRecord, error)
}

type complianceService struct {
	repo     repository.ComplianceRepository
	notifier Notifier
	clock    func() time.Time
}

func NewComplianceService(repo repository.ComplianceRepository, notifier Notifier) ComplianceService {
	return &complianceService{repo: repo, notifier: notifier, clock: time.Now}
}

func (s *complianceService) ListAll() ([]models.ComplianceRecord, error) {
	return s.repo.ListAll()
}

func (s *complianceService) GetByStudent(studentID uuid.UUID) (*models.ComplianceRecord, error) {
	return s.repo.GetByStudentID(studentID)
}

func (s *complianceService) ListByUniversity(universityID uuid.UUID) ([]models.ComplianceRecord, error) {
	return s.repo.ListByUniversityID(universityID)
}

func (s *complianceService) StartTracking(studentID uuid.UUID, universityID *uuid.UUID, grantYears int, graduationDate, deadline *time.Time) (*models.ComplianceRecord, error) {
	if existing, err := s.repo.GetByStudentID(studentID); err == nil {
		return existing, nil
	} else if err != repository.ErrComplianceNotFound {
		return nil, err
	}

	if grantYears != 2 && grantYears != 3 {
		grantYears = 3 // default obligation length
	}

	rec := &models.ComplianceRecord{
		StudentID:      studentID,
		UniversityID:   universityID,
		State:          string(compliance.NotYetDue),
		GrantYears:     grantYears,
		GraduationDate: graduationDate,
		Deadline:       deadline,
	}
	if err := s.repo.Create(rec); err != nil {
		return nil, err
	}
	return rec, nil
}

func (s *complianceService) Evaluate(rec *models.ComplianceRecord, now time.Time, hasQualifyingOffer bool) (bool, error) {
	current := compliance.State(rec.State)
	next := compliance.NextTimeDriven(current, now, compliance.Facts{
		GraduationDate:     rec.GraduationDate,
		Deadline:           rec.Deadline,
		HasQualifyingOffer: hasQualifyingOffer,
	})
	if next == current {
		return false, nil
	}

	rec.State = string(next)
	if err := s.repo.Update(rec); err != nil {
		return false, err
	}

	if next == compliance.AtRisk && s.notifier != nil {
		s.notifier.NotifyAtRisk(rec.StudentID)
	}
	return true, nil
}

func (s *complianceService) ApplyEvidence(studentID uuid.UUID, target compliance.State, actorRole string, actorID uuid.UUID, evidenceDocID *uuid.UUID, exemptReason string, hasVerifiedDocs bool) (*models.ComplianceRecord, error) {
	rec, err := s.repo.GetByStudentID(studentID)
	if err != nil {
		return nil, err
	}

	next, err := compliance.ApplyEvidence(compliance.State(rec.State), target, actorRole, hasVerifiedDocs)
	if err != nil {
		return nil, err
	}

	now := s.clock()
	rec.State = string(next)
	rec.TransitionedBy = &actorID
	rec.TransitionedAt = &now
	if evidenceDocID != nil {
		rec.EvidenceDocID = evidenceDocID
	}
	if next == compliance.Exempt {
		rec.ExemptReason = exemptReason
	}

	if err := s.repo.Update(rec); err != nil {
		return nil, err
	}
	return rec, nil
}
