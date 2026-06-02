package facts

import (
	"errors"
	"testing"
	"time"

	"application-service/internal/models"
	"application-service/internal/repository"

	"github.com/google/uuid"
)

// fakeEmploymentRepo implements repository.EmploymentRepository for tests; only
// GetByStudentID carries behaviour.
type fakeEmploymentRepo struct {
	byStudent map[uuid.UUID][]models.EmploymentRecord
	err       error
}

var _ repository.EmploymentRepository = (*fakeEmploymentRepo)(nil)

func (f *fakeEmploymentRepo) GetByStudentID(studentID uuid.UUID) ([]models.EmploymentRecord, error) {
	return f.byStudent[studentID], f.err
}
func (f *fakeEmploymentRepo) Create(*models.EmploymentRecord) error { return nil }
func (f *fakeEmploymentRepo) GetByID(uuid.UUID) (*models.EmploymentRecord, error) {
	return nil, nil
}
func (f *fakeEmploymentRepo) GetByApplicationID(uuid.UUID) (*models.EmploymentRecord, error) {
	return nil, nil
}
func (f *fakeEmploymentRepo) GetByEmployerID(uuid.UUID) ([]models.EmploymentRecord, error) {
	return nil, nil
}
func (f *fakeEmploymentRepo) GetAll() ([]models.EmploymentRecord, error) { return nil, nil }
func (f *fakeEmploymentRepo) GetAllByUniversity([]uuid.UUID) ([]models.EmploymentRecord, error) {
	return nil, nil
}
func (f *fakeEmploymentRepo) GetByUniversityID(uuid.UUID) ([]models.EmploymentRecord, error) {
	return nil, nil
}
func (f *fakeEmploymentRepo) UpdateStatus(uuid.UUID, string) error { return nil }
func (f *fakeEmploymentRepo) End(uuid.UUID) error                  { return nil }

func recWithDeadline(d *time.Time) *models.ComplianceRecord {
	return &models.ComplianceRecord{StudentID: uuid.New(), Deadline: d}
}

func TestHasQualifyingOffer(t *testing.T) {
	deadline := time.Date(2028, time.June, 1, 0, 0, 0, 0, time.UTC)
	beforeDeadline := deadline.AddDate(0, -1, 0)
	afterDeadline := deadline.AddDate(0, 1, 0)

	tests := []struct {
		name     string
		records  []models.EmploymentRecord
		deadline *time.Time
		policy   Policy
		want     bool
	}{
		{
			name:    "no employment records",
			records: nil,
			want:    false,
		},
		{
			name:     "active, no deadline -> qualifying",
			records:  []models.EmploymentRecord{{Status: "active", StartedAt: beforeDeadline}},
			deadline: nil,
			want:     true,
		},
		{
			name:     "active, started before deadline -> qualifying",
			records:  []models.EmploymentRecord{{Status: "active", StartedAt: beforeDeadline}},
			deadline: &deadline,
			want:     true,
		},
		{
			name:     "active, started after deadline -> not qualifying",
			records:  []models.EmploymentRecord{{Status: "active", StartedAt: afterDeadline}},
			deadline: &deadline,
			want:     false,
		},
		{
			name:     "completed/terminated only -> not qualifying",
			records:  []models.EmploymentRecord{{Status: "completed", StartedAt: beforeDeadline}, {Status: "terminated_early", StartedAt: beforeDeadline}},
			deadline: &deadline,
			want:     false,
		},
		{
			name:     "one qualifying among several -> qualifying",
			records:  []models.EmploymentRecord{{Status: "terminated_early", StartedAt: beforeDeadline}, {Status: "active", StartedAt: beforeDeadline}},
			deadline: &deadline,
			want:     true,
		},
		{
			name:     "policy requires employer verification (no source) -> not qualifying",
			records:  []models.EmploymentRecord{{Status: "active", StartedAt: beforeDeadline}},
			deadline: &deadline,
			policy:   Policy{RequireEmployerVerified: true},
			want:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := recWithDeadline(tt.deadline)
			repo := &fakeEmploymentRepo{byStudent: map[uuid.UUID][]models.EmploymentRecord{rec.StudentID: tt.records}}
			p := NewEmploymentFactProvider(repo, tt.policy)

			got, err := p.HasQualifyingOffer(rec)
			if err != nil {
				t.Fatalf("HasQualifyingOffer: %v", err)
			}
			if got != tt.want {
				t.Errorf("got %v, want %v", got, tt.want)
			}
		})
	}
}

func TestHasQualifyingOffer_RepoErrorPropagates(t *testing.T) {
	rec := recWithDeadline(nil)
	repo := &fakeEmploymentRepo{err: errors.New("db down")}
	p := NewEmploymentFactProvider(repo, Policy{})

	if _, err := p.HasQualifyingOffer(rec); err == nil {
		t.Fatal("expected error to propagate")
	}
}
