package service

import (
	"errors"
	"testing"

	"application-service/internal/models"
	"application-service/internal/repository"

	"github.com/google/uuid"
)

// stubAppRepo is a minimal hand-written test double for ApplicationRepository.
type stubAppRepo struct {
	exists    bool
	existsErr error
	createErr error
	getApp    *models.Application
	getErr    error
	updateErr error
	deleteErr error
}

func (s *stubAppRepo) Create(app *models.Application) error  { return s.createErr }
func (s *stubAppRepo) GetByStudentID(_ uuid.UUID) ([]models.Application, error) { return nil, nil }
func (s *stubAppRepo) GetByVacancyID(_ uuid.UUID) ([]models.Application, error) { return nil, nil }
func (s *stubAppRepo) GetByID(_ uuid.UUID) (*models.Application, error) {
	return s.getApp, s.getErr
}
func (s *stubAppRepo) UpdateStatus(_ uuid.UUID, _ string) error { return s.updateErr }
func (s *stubAppRepo) Delete(_ uuid.UUID) error                 { return s.deleteErr }
func (s *stubAppRepo) ExistsByStudentAndVacancy(_, _ uuid.UUID) (bool, error) {
	return s.exists, s.existsErr
}
func (s *stubAppRepo) CountAll() (int64, error)                        { return 0, nil }
func (s *stubAppRepo) CountByStatus() ([]repository.StatusCount, error) { return nil, nil }

func TestApply_Success(t *testing.T) {
	svc := NewApplicationService(&stubAppRepo{exists: false})

	studentID := uuid.New()
	vacancyID := uuid.New()
	employerID := uuid.New()

	app, err := svc.Apply(studentID, vacancyID, employerID, "Мотивационное письмо", 85)
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}
	if app.StudentID != studentID {
		t.Errorf("student ID mismatch: got %v, want %v", app.StudentID, studentID)
	}
	if app.MatchScore != 85 {
		t.Errorf("match score: got %d, want 85", app.MatchScore)
	}
	if app.Status != "applied" {
		t.Errorf("status: got %q, want %q", app.Status, "applied")
	}
}

func TestApply_AlreadyApplied(t *testing.T) {
	svc := NewApplicationService(&stubAppRepo{exists: true})

	_, err := svc.Apply(uuid.New(), uuid.New(), uuid.New(), "", 0)
	if !errors.Is(err, ErrAlreadyApplied) {
		t.Fatalf("expected ErrAlreadyApplied, got: %v", err)
	}
}

func TestUpdateStatus_Forbidden(t *testing.T) {
	ownerID := uuid.New()
	attackerID := uuid.New()

	svc := NewApplicationService(&stubAppRepo{
		getApp: &models.Application{
			ID:         uuid.New(),
			EmployerID: ownerID,
			Status:     "applied",
		},
	})

	_, err := svc.UpdateStatus(uuid.New(), attackerID, "accepted")
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected ErrForbidden, got: %v", err)
	}
}

func TestWithdraw_Forbidden(t *testing.T) {
	ownerID := uuid.New()
	attackerID := uuid.New()

	svc := NewApplicationService(&stubAppRepo{
		getApp: &models.Application{
			ID:        uuid.New(),
			StudentID: ownerID,
			Status:    "applied",
		},
	})

	err := svc.Withdraw(uuid.New(), attackerID)
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected ErrForbidden, got: %v", err)
	}
}
