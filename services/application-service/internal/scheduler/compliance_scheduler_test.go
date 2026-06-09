package scheduler

import (
	"context"
	"testing"
	"time"

	"application-service/internal/compliance"
	"application-service/internal/models"
	"application-service/internal/service"

	"github.com/google/uuid"
)

// fakeSvc implements service.ComplianceService; only EvaluateAll is exercised.
type fakeSvc struct {
	calls chan time.Time
	rep   service.EvaluationReport
	err   error
}

func (f *fakeSvc) EvaluateAll(now time.Time, _ service.FactProvider) (service.EvaluationReport, error) {
	if f.calls != nil {
		f.calls <- now
	}
	return f.rep, f.err
}
func (f *fakeSvc) GetByStudent(uuid.UUID) (*models.ComplianceRecord, error) { return nil, nil }
func (f *fakeSvc) ListByUniversity(uuid.UUID) ([]models.ComplianceRecord, error) {
	return nil, nil
}
func (f *fakeSvc) StartTracking(uuid.UUID, *uuid.UUID, int, *time.Time, *time.Time) (*models.ComplianceRecord, error) {
	return nil, nil
}
func (f *fakeSvc) Evaluate(*models.ComplianceRecord, time.Time, bool) (bool, error) {
	return false, nil
}
func (f *fakeSvc) ApplyEvidence(uuid.UUID, compliance.State, string, uuid.UUID, *uuid.UUID, string, bool) (*models.ComplianceRecord, error) {
	return nil, nil
}
func (f *fakeSvc) ListAll() ([]models.ComplianceRecord, error) { return nil, nil }

type stubFacts struct{}

func (stubFacts) HasQualifyingOffer(*models.ComplianceRecord) (bool, error) { return false, nil }

func TestRunOnce_CallsEvaluateAllWithClock(t *testing.T) {
	calls := make(chan time.Time, 1)
	svc := &fakeSvc{calls: calls}
	s := NewComplianceScheduler(svc, stubFacts{}, time.Hour)
	fixed := time.Date(2026, time.January, 1, 3, 0, 0, 0, time.UTC)
	s.clock = func() time.Time { return fixed }

	s.RunOnce()

	select {
	case got := <-calls:
		if !got.Equal(fixed) {
			t.Errorf("EvaluateAll called with %v, want %v", got, fixed)
		}
	case <-time.After(time.Second):
		t.Fatal("EvaluateAll was not called")
	}
}

func TestDefaultInterval(t *testing.T) {
	s := NewComplianceScheduler(&fakeSvc{}, stubFacts{}, 0)
	if s.interval != 24*time.Hour {
		t.Errorf("non-positive interval should default to 24h, got %v", s.interval)
	}
}

func TestStart_RunsImmediatelyAndOnTickThenStops(t *testing.T) {
	calls := make(chan time.Time, 16)
	svc := &fakeSvc{calls: calls}
	s := NewComplianceScheduler(svc, stubFacts{}, 15*time.Millisecond)

	ctx, cancel := context.WithCancel(context.Background())
	go s.Start(ctx)

	// Immediate pass + at least one ticked pass.
	for i := 0; i < 2; i++ {
		select {
		case <-calls:
		case <-time.After(2 * time.Second):
			t.Fatalf("expected scheduler pass #%d", i+1)
		}
	}
	cancel()
}
