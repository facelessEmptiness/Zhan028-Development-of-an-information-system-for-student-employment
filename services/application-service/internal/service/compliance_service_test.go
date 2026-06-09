package service

import (
	"errors"
	"testing"
	"time"

	"application-service/internal/compliance"
	"application-service/internal/models"
	"application-service/internal/repository"

	"github.com/google/uuid"
)

// fakeComplianceRepo is an in-memory ComplianceRepository for unit tests.
type fakeComplianceRepo struct {
	byStudent map[uuid.UUID]*models.ComplianceRecord
	createN   int
	updateN   int
}

func newFakeComplianceRepo() *fakeComplianceRepo {
	return &fakeComplianceRepo{byStudent: map[uuid.UUID]*models.ComplianceRecord{}}
}

func (f *fakeComplianceRepo) Create(rec *models.ComplianceRecord) error {
	f.createN++
	if rec.ID == uuid.Nil {
		rec.ID = uuid.New()
	}
	cp := *rec
	f.byStudent[rec.StudentID] = &cp
	return nil
}

func (f *fakeComplianceRepo) GetByID(id uuid.UUID) (*models.ComplianceRecord, error) {
	for _, r := range f.byStudent {
		if r.ID == id {
			cp := *r
			return &cp, nil
		}
	}
	return nil, repository.ErrComplianceNotFound
}

func (f *fakeComplianceRepo) GetByStudentID(studentID uuid.UUID) (*models.ComplianceRecord, error) {
	rec, ok := f.byStudent[studentID]
	if !ok {
		return nil, repository.ErrComplianceNotFound
	}
	cp := *rec
	return &cp, nil
}

func (f *fakeComplianceRepo) ListByUniversityID(universityID uuid.UUID) ([]models.ComplianceRecord, error) {
	var out []models.ComplianceRecord
	for _, r := range f.byStudent {
		if r.UniversityID != nil && *r.UniversityID == universityID {
			out = append(out, *r)
		}
	}
	return out, nil
}

func (f *fakeComplianceRepo) ListNonTerminal() ([]models.ComplianceRecord, error) {
	var out []models.ComplianceRecord
	for _, r := range f.byStudent {
		if r.State != string(compliance.Compliant) && r.State != string(compliance.Exempt) {
			out = append(out, *r)
		}
	}
	return out, nil
}

func (f *fakeComplianceRepo) ListAll() ([]models.ComplianceRecord, error) {
	var out []models.ComplianceRecord
	for _, r := range f.byStudent {
		out = append(out, *r)
	}
	return out, nil
}

func (f *fakeComplianceRepo) Update(rec *models.ComplianceRecord) error {
	f.updateN++
	cp := *rec
	f.byStudent[rec.StudentID] = &cp
	return nil
}

type fakeNotifier struct{ atRisk []uuid.UUID }

func (n *fakeNotifier) NotifyAtRisk(studentID uuid.UUID) { n.atRisk = append(n.atRisk, studentID) }

func ptr(t time.Time) *time.Time { return &t }

func TestStartTracking_CreatesNotYetDueAndIsIdempotent(t *testing.T) {
	repo := newFakeComplianceRepo()
	svc := NewComplianceService(repo, nil)
	sid := uuid.New()

	rec, err := svc.StartTracking(sid, nil, 2, nil, nil)
	if err != nil {
		t.Fatalf("StartTracking: %v", err)
	}
	if rec.State != string(compliance.NotYetDue) {
		t.Errorf("state: got %q, want NotYetDue", rec.State)
	}
	if rec.GrantYears != 2 {
		t.Errorf("grantYears: got %d, want 2", rec.GrantYears)
	}

	// Second call must not create a duplicate.
	if _, err := svc.StartTracking(sid, nil, 3, nil, nil); err != nil {
		t.Fatalf("StartTracking (2nd): %v", err)
	}
	if repo.createN != 1 {
		t.Errorf("expected exactly 1 create, got %d", repo.createN)
	}
}

func TestStartTracking_DefaultsInvalidGrantYears(t *testing.T) {
	repo := newFakeComplianceRepo()
	svc := NewComplianceService(repo, nil)

	rec, err := svc.StartTracking(uuid.New(), nil, 99, nil, nil)
	if err != nil {
		t.Fatalf("StartTracking: %v", err)
	}
	if rec.GrantYears != 3 {
		t.Errorf("invalid grantYears should default to 3, got %d", rec.GrantYears)
	}
}

func TestEvaluate_GraduatedWithOffer_GoesInProgress(t *testing.T) {
	repo := newFakeComplianceRepo()
	notifier := &fakeNotifier{}
	svc := NewComplianceService(repo, notifier)

	grad := time.Date(2025, time.June, 1, 0, 0, 0, 0, time.UTC)
	rec := &models.ComplianceRecord{StudentID: uuid.New(), State: string(compliance.NotYetDue), GraduationDate: ptr(grad)}

	changed, err := svc.Evaluate(rec, grad, true)
	if err != nil {
		t.Fatalf("Evaluate: %v", err)
	}
	if !changed || rec.State != string(compliance.InProgress) {
		t.Errorf("expected InProgress change, got changed=%v state=%s", changed, rec.State)
	}
	if repo.updateN != 1 {
		t.Errorf("expected 1 persist, got %d", repo.updateN)
	}
	if len(notifier.atRisk) != 0 {
		t.Errorf("InProgress must not notify at-risk")
	}
}

func TestEvaluate_GraduatedNoOfferPastGrace_GoesAtRiskAndNotifies(t *testing.T) {
	repo := newFakeComplianceRepo()
	notifier := &fakeNotifier{}
	svc := NewComplianceService(repo, notifier)

	grad := time.Date(2025, time.June, 1, 0, 0, 0, 0, time.UTC)
	sid := uuid.New()
	rec := &models.ComplianceRecord{StudentID: sid, State: string(compliance.NotYetDue), GraduationDate: ptr(grad)}

	now := grad.AddDate(0, compliance.GraceMonths, 0).AddDate(0, 0, 1) // one day past grace
	changed, err := svc.Evaluate(rec, now, false)
	if err != nil {
		t.Fatalf("Evaluate: %v", err)
	}
	if !changed || rec.State != string(compliance.AtRisk) {
		t.Errorf("expected AtRisk, got changed=%v state=%s", changed, rec.State)
	}
	if len(notifier.atRisk) != 1 || notifier.atRisk[0] != sid {
		t.Errorf("expected one at-risk notification for %v, got %v", sid, notifier.atRisk)
	}
}

func TestEvaluate_NoChange_DoesNotPersistOrNotify(t *testing.T) {
	repo := newFakeComplianceRepo()
	notifier := &fakeNotifier{}
	svc := NewComplianceService(repo, notifier)

	// Not graduated yet -> stays NotYetDue.
	rec := &models.ComplianceRecord{StudentID: uuid.New(), State: string(compliance.NotYetDue)}

	changed, err := svc.Evaluate(rec, time.Now(), false)
	if err != nil {
		t.Fatalf("Evaluate: %v", err)
	}
	if changed {
		t.Error("expected no change")
	}
	if repo.updateN != 0 {
		t.Errorf("idempotent evaluate must not persist, got %d updates", repo.updateN)
	}
	if len(notifier.atRisk) != 0 {
		t.Error("no notification expected without a change")
	}
}

func TestApplyEvidence_UniversityMarksCompliant_SetsAudit(t *testing.T) {
	repo := newFakeComplianceRepo()
	fixedNow := time.Date(2026, time.January, 15, 12, 0, 0, 0, time.UTC)
	svc := &complianceService{repo: repo, clock: func() time.Time { return fixedNow }}

	sid := uuid.New()
	repo.byStudent[sid] = &models.ComplianceRecord{ID: uuid.New(), StudentID: sid, State: string(compliance.AtRisk)}

	staffID := uuid.New()
	docID := uuid.New()
	rec, err := svc.ApplyEvidence(sid, compliance.Compliant, "university", staffID, &docID, "", true)
	if err != nil {
		t.Fatalf("ApplyEvidence: %v", err)
	}
	if rec.State != string(compliance.Compliant) {
		t.Errorf("state: got %q, want Compliant", rec.State)
	}
	if rec.TransitionedBy == nil || *rec.TransitionedBy != staffID {
		t.Errorf("transitioned_by not recorded")
	}
	if rec.TransitionedAt == nil || !rec.TransitionedAt.Equal(fixedNow) {
		t.Errorf("transitioned_at not set to clock time")
	}
	if rec.EvidenceDocID == nil || *rec.EvidenceDocID != docID {
		t.Errorf("evidence_doc_id not recorded")
	}
}

func TestApplyEvidence_Exempt_SetsReason(t *testing.T) {
	repo := newFakeComplianceRepo()
	svc := NewComplianceService(repo, nil)

	sid := uuid.New()
	repo.byStudent[sid] = &models.ComplianceRecord{ID: uuid.New(), StudentID: sid, State: string(compliance.NotYetDue)}

	rec, err := svc.ApplyEvidence(sid, compliance.Exempt, "admin", uuid.New(), nil, "maternity leave", true)
	if err != nil {
		t.Fatalf("ApplyEvidence: %v", err)
	}
	if rec.State != string(compliance.Exempt) {
		t.Errorf("state: got %q, want Exempt", rec.State)
	}
	if rec.ExemptReason != "maternity leave" {
		t.Errorf("exempt_reason: got %q", rec.ExemptReason)
	}
}

func TestApplyEvidence_StudentForbidden_NotPersisted(t *testing.T) {
	repo := newFakeComplianceRepo()
	svc := NewComplianceService(repo, nil)

	sid := uuid.New()
	repo.byStudent[sid] = &models.ComplianceRecord{ID: uuid.New(), StudentID: sid, State: string(compliance.AtRisk)}

	_, err := svc.ApplyEvidence(sid, compliance.Compliant, "student", uuid.New(), nil, "", true)
	if err != compliance.ErrUnauthorized {
		t.Fatalf("expected ErrUnauthorized, got %v", err)
	}
	if repo.updateN != 0 {
		t.Errorf("forbidden transition must not persist, got %d updates", repo.updateN)
	}
}

func TestApplyEvidence_StudentNotFound(t *testing.T) {
	repo := newFakeComplianceRepo()
	svc := NewComplianceService(repo, nil)

	_, err := svc.ApplyEvidence(uuid.New(), compliance.Compliant, "university", uuid.New(), nil, "", true)
	if err != repository.ErrComplianceNotFound {
		t.Fatalf("expected ErrComplianceNotFound, got %v", err)
	}
}

func TestGetByStudent_Passthrough(t *testing.T) {
	repo := newFakeComplianceRepo()
	svc := NewComplianceService(repo, nil)
	sid := uuid.New()
	repo.byStudent[sid] = &models.ComplianceRecord{ID: uuid.New(), StudentID: sid, State: string(compliance.InProgress)}

	got, err := svc.GetByStudent(sid)
	if err != nil || got.State != string(compliance.InProgress) {
		t.Fatalf("GetByStudent: got %v, err %v", got, err)
	}
	if _, err := svc.GetByStudent(uuid.New()); err != repository.ErrComplianceNotFound {
		t.Fatalf("expected not found, got %v", err)
	}
}

type fakeFacts struct {
	offer  map[uuid.UUID]bool
	errFor map[uuid.UUID]bool
}

func (f fakeFacts) HasQualifyingOffer(rec *models.ComplianceRecord) (bool, error) {
	if f.errFor[rec.StudentID] {
		return false, errors.New("fact lookup failed")
	}
	return f.offer[rec.StudentID], nil
}

func TestEvaluateAll_CountsTransitionsAndErrors(t *testing.T) {
	repo := newFakeComplianceRepo()
	svc := NewComplianceService(repo, &fakeNotifier{})

	grad := time.Date(2025, time.June, 1, 0, 0, 0, 0, time.UTC)
	s1 := uuid.New() // graduated + offer  -> InProgress (changed)
	s2 := uuid.New() // fact lookup error  -> counted as error
	s3 := uuid.New() // not graduated      -> no change
	repo.byStudent[s1] = &models.ComplianceRecord{ID: uuid.New(), StudentID: s1, State: string(compliance.NotYetDue), GraduationDate: ptr(grad)}
	repo.byStudent[s2] = &models.ComplianceRecord{ID: uuid.New(), StudentID: s2, State: string(compliance.NotYetDue), GraduationDate: ptr(grad)}
	repo.byStudent[s3] = &models.ComplianceRecord{ID: uuid.New(), StudentID: s3, State: string(compliance.NotYetDue)}

	facts := fakeFacts{
		offer:  map[uuid.UUID]bool{s1: true},
		errFor: map[uuid.UUID]bool{s2: true},
	}

	rep, err := svc.EvaluateAll(grad, facts)
	if err != nil {
		t.Fatalf("EvaluateAll: %v", err)
	}
	if rep.Evaluated != 3 {
		t.Errorf("evaluated: got %d, want 3", rep.Evaluated)
	}
	if rep.Changed != 1 {
		t.Errorf("changed: got %d, want 1", rep.Changed)
	}
	if rep.Errors != 1 {
		t.Errorf("errors: got %d, want 1", rep.Errors)
	}
	if got, _ := repo.GetByStudentID(s1); got.State != string(compliance.InProgress) {
		t.Errorf("s1 state: got %s, want InProgress", got.State)
	}
}
