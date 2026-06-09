package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"application-service/internal/compliance"
	"application-service/internal/models"
	"application-service/internal/repository"
	"application-service/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type fakeComplianceSvc struct {
	startCalled       bool
	startUniversityID *uuid.UUID
	getRec            *models.ComplianceRecord
	getErr            error
	listRecs          []models.ComplianceRecord

	applyRec            *models.ComplianceRecord
	applyErr            error
	lastTarget          compliance.State
	lastHasVerifiedDocs bool
}

func (f *fakeComplianceSvc) StartTracking(studentID uuid.UUID, universityID *uuid.UUID, grantYears int, _, _ *time.Time) (*models.ComplianceRecord, error) {
	f.startCalled = true
	f.startUniversityID = universityID
	return &models.ComplianceRecord{StudentID: studentID, UniversityID: universityID, State: string(compliance.NotYetDue), GrantYears: grantYears}, nil
}
func (f *fakeComplianceSvc) GetByStudent(uuid.UUID) (*models.ComplianceRecord, error) {
	return f.getRec, f.getErr
}
func (f *fakeComplianceSvc) ListByUniversity(uuid.UUID) ([]models.ComplianceRecord, error) {
	return f.listRecs, nil
}
func (f *fakeComplianceSvc) Evaluate(*models.ComplianceRecord, time.Time, bool) (bool, error) {
	return false, nil
}
func (f *fakeComplianceSvc) ApplyEvidence(_ uuid.UUID, target compliance.State, _ string, _ uuid.UUID, _ *uuid.UUID, _ string, hasDocs bool) (*models.ComplianceRecord, error) {
	f.lastTarget = target
	f.lastHasVerifiedDocs = hasDocs
	if f.applyErr != nil {
		return nil, f.applyErr
	}
	if f.applyRec != nil {
		return f.applyRec, nil
	}
	return &models.ComplianceRecord{State: string(target)}, nil
}
func (f *fakeComplianceSvc) EvaluateAll(time.Time, service.FactProvider) (service.EvaluationReport, error) {
	return service.EvaluationReport{}, nil
}
func (f *fakeComplianceSvc) ListAll() ([]models.ComplianceRecord, error) {
	return nil, nil
}

type fakeFactProvider struct{}

func (fakeFactProvider) HasQualifyingOffer(*models.ComplianceRecord) (bool, error) {
	return false, nil
}

func newRouter(svc service.ComplianceService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewComplianceHandler(svc, fakeFactProvider{})
	r.POST("/api/compliance/enroll", h.Enroll)
	r.GET("/api/compliance/student/:student_id", h.GetForStudent)
	r.POST("/api/compliance/student/:student_id/evidence", h.ApplyEvidence)
	r.GET("/api/compliance/university", h.GetForUniversity)
	return r
}

func do(r *gin.Engine, method, path, body string, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestEnroll_StudentRoleForbidden(t *testing.T) {
	svc := &fakeComplianceSvc{}
	r := newRouter(svc)

	w := do(r, "POST", "/api/compliance/enroll", `{"student_id":"`+uuid.NewString()+`"}`,
		map[string]string{"X-User-Role": "student", "X-User-ID": uuid.NewString()})

	if w.Code != http.StatusForbidden {
		t.Fatalf("status: got %d, want 403", w.Code)
	}
	if svc.startCalled {
		t.Error("StartTracking must not be called for a student")
	}
}

func TestEnroll_UniversityScopesToOwnUniversity(t *testing.T) {
	svc := &fakeComplianceSvc{}
	r := newRouter(svc)
	uni := uuid.New()

	w := do(r, "POST", "/api/compliance/enroll", `{"student_id":"`+uuid.NewString()+`","grant_years":2}`,
		map[string]string{"X-User-Role": "university", "X-University-ID": uni.String()})

	if w.Code != http.StatusCreated {
		t.Fatalf("status: got %d, want 201", w.Code)
	}
	if svc.startUniversityID == nil || *svc.startUniversityID != uni {
		t.Errorf("enrolment must be scoped to caller's university %v, got %v", uni, svc.startUniversityID)
	}
}

func TestEnroll_UniversityMissingScopeForbidden(t *testing.T) {
	svc := &fakeComplianceSvc{}
	r := newRouter(svc)

	w := do(r, "POST", "/api/compliance/enroll", `{"student_id":"`+uuid.NewString()+`"}`,
		map[string]string{"X-User-Role": "university"}) // no X-University-ID

	if w.Code != http.StatusForbidden {
		t.Fatalf("status: got %d, want 403", w.Code)
	}
}

func TestEnroll_AdminWithUniversity(t *testing.T) {
	svc := &fakeComplianceSvc{}
	r := newRouter(svc)
	uni := uuid.New()

	w := do(r, "POST", "/api/compliance/enroll", `{"student_id":"`+uuid.NewString()+`","university_id":"`+uni.String()+`"}`,
		map[string]string{"X-User-Role": "admin"})

	if w.Code != http.StatusCreated {
		t.Fatalf("status: got %d, want 201", w.Code)
	}
	if svc.startUniversityID == nil || *svc.startUniversityID != uni {
		t.Errorf("admin university_id not applied")
	}
}

func TestEnroll_MissingStudentID(t *testing.T) {
	svc := &fakeComplianceSvc{}
	r := newRouter(svc)

	w := do(r, "POST", "/api/compliance/enroll", `{}`,
		map[string]string{"X-User-Role": "university", "X-University-ID": uuid.NewString()})

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d, want 400", w.Code)
	}
}

func TestGetForUniversity_StudentForbidden(t *testing.T) {
	svc := &fakeComplianceSvc{}
	r := newRouter(svc)

	w := do(r, "GET", "/api/compliance/university", "",
		map[string]string{"X-User-Role": "student", "X-User-ID": uuid.NewString()})

	if w.Code != http.StatusForbidden {
		t.Fatalf("status: got %d, want 403", w.Code)
	}
}

func TestGetForUniversity_UniversityOK(t *testing.T) {
	svc := &fakeComplianceSvc{listRecs: []models.ComplianceRecord{{State: string(compliance.AtRisk)}}}
	r := newRouter(svc)

	w := do(r, "GET", "/api/compliance/university", "",
		map[string]string{"X-User-Role": "university", "X-University-ID": uuid.NewString()})

	if w.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200", w.Code)
	}
	if !strings.Contains(w.Body.String(), "records") {
		t.Errorf("expected records in body, got %s", w.Body.String())
	}
}

func TestGetForStudent_UniversitySameUniversity(t *testing.T) {
	uni := uuid.New()
	svc := &fakeComplianceSvc{getRec: &models.ComplianceRecord{StudentID: uuid.New(), UniversityID: &uni, State: string(compliance.InProgress)}}
	r := newRouter(svc)

	w := do(r, "GET", "/api/compliance/student/"+uuid.NewString(), "",
		map[string]string{"X-User-Role": "university", "X-University-ID": uni.String()})

	if w.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200", w.Code)
	}
}

func TestGetForStudent_UniversityDifferentUniversityForbidden(t *testing.T) {
	recUni := uuid.New()
	svc := &fakeComplianceSvc{getRec: &models.ComplianceRecord{StudentID: uuid.New(), UniversityID: &recUni, State: string(compliance.InProgress)}}
	r := newRouter(svc)

	w := do(r, "GET", "/api/compliance/student/"+uuid.NewString(), "",
		map[string]string{"X-User-Role": "university", "X-University-ID": uuid.NewString()}) // different uni

	if w.Code != http.StatusForbidden {
		t.Fatalf("status: got %d, want 403", w.Code)
	}
}

func TestGetForStudent_StudentReadsOwn(t *testing.T) {
	sid := uuid.New()
	svc := &fakeComplianceSvc{getRec: &models.ComplianceRecord{StudentID: sid, State: string(compliance.NotYetDue)}}
	r := newRouter(svc)

	w := do(r, "GET", "/api/compliance/student/"+sid.String(), "",
		map[string]string{"X-User-Role": "student", "X-User-ID": sid.String()})

	if w.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200", w.Code)
	}
}

func TestGetForStudent_StudentReadsOtherForbidden(t *testing.T) {
	svc := &fakeComplianceSvc{getRec: &models.ComplianceRecord{StudentID: uuid.New(), State: string(compliance.NotYetDue)}}
	r := newRouter(svc)

	w := do(r, "GET", "/api/compliance/student/"+uuid.NewString(), "",
		map[string]string{"X-User-Role": "student", "X-User-ID": uuid.NewString()})

	if w.Code != http.StatusForbidden {
		t.Fatalf("status: got %d, want 403", w.Code)
	}
}

func TestGetForStudent_NotFound(t *testing.T) {
	svc := &fakeComplianceSvc{getErr: repository.ErrComplianceNotFound}
	r := newRouter(svc)

	w := do(r, "GET", "/api/compliance/student/"+uuid.NewString(), "",
		map[string]string{"X-User-Role": "admin"})

	if w.Code != http.StatusNotFound {
		t.Fatalf("status: got %d, want 404", w.Code)
	}
}

func evidencePath(sid uuid.UUID) string {
	return "/api/compliance/student/" + sid.String() + "/evidence"
}

func TestApplyEvidence_StudentForbidden(t *testing.T) {
	svc := &fakeComplianceSvc{}
	r := newRouter(svc)
	sid := uuid.New()

	w := do(r, "POST", evidencePath(sid), `{"target":"Compliant"}`,
		map[string]string{"X-User-Role": "student", "X-User-ID": sid.String()})

	if w.Code != http.StatusForbidden {
		t.Fatalf("status: got %d, want 403", w.Code)
	}
}

func TestApplyEvidence_AdminSuccessWithDoc(t *testing.T) {
	sid := uuid.New()
	svc := &fakeComplianceSvc{
		getRec:   &models.ComplianceRecord{StudentID: sid, State: string(compliance.AtRisk)},
		applyRec: &models.ComplianceRecord{StudentID: sid, State: string(compliance.Compliant)},
	}
	r := newRouter(svc)

	w := do(r, "POST", evidencePath(sid), `{"target":"Compliant","evidence_doc_id":"`+uuid.NewString()+`"}`,
		map[string]string{"X-User-Role": "admin", "X-User-ID": uuid.NewString()})

	if w.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200", w.Code)
	}
	if svc.lastTarget != compliance.Compliant || !svc.lastHasVerifiedDocs {
		t.Errorf("expected target=Compliant hasDocs=true, got %s/%v", svc.lastTarget, svc.lastHasVerifiedDocs)
	}
}

func TestApplyEvidence_NoDocMeansNoVerifiedDocs(t *testing.T) {
	sid := uuid.New()
	svc := &fakeComplianceSvc{
		getRec:   &models.ComplianceRecord{StudentID: sid, State: string(compliance.AtRisk)},
		applyErr: compliance.ErrEvidenceRequired,
	}
	r := newRouter(svc)

	w := do(r, "POST", evidencePath(sid), `{"target":"Compliant"}`,
		map[string]string{"X-User-Role": "admin", "X-User-ID": uuid.NewString()})

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d, want 400", w.Code)
	}
	if svc.lastHasVerifiedDocs {
		t.Error("expected hasVerifiedDocs=false when no document referenced")
	}
}

func TestApplyEvidence_ErrorMapping(t *testing.T) {
	sid := uuid.New()
	cases := []struct {
		name string
		err  error
		want int
	}{
		{"unauthorized -> 403", compliance.ErrUnauthorized, http.StatusForbidden},
		{"invalid transition -> 409", compliance.ErrInvalidTransition, http.StatusConflict},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			svc := &fakeComplianceSvc{
				getRec:   &models.ComplianceRecord{StudentID: sid, State: string(compliance.AtRisk)},
				applyErr: tc.err,
			}
			r := newRouter(svc)

			w := do(r, "POST", evidencePath(sid), `{"target":"Compliant","evidence_doc_id":"`+uuid.NewString()+`"}`,
				map[string]string{"X-User-Role": "admin", "X-User-ID": uuid.NewString()})

			if w.Code != tc.want {
				t.Fatalf("status: got %d, want %d", w.Code, tc.want)
			}
		})
	}
}

func TestApplyEvidence_NotFound(t *testing.T) {
	sid := uuid.New()
	svc := &fakeComplianceSvc{getErr: repository.ErrComplianceNotFound}
	r := newRouter(svc)

	w := do(r, "POST", evidencePath(sid), `{"target":"Compliant","evidence_doc_id":"`+uuid.NewString()+`"}`,
		map[string]string{"X-User-Role": "admin", "X-User-ID": uuid.NewString()})

	if w.Code != http.StatusNotFound {
		t.Fatalf("status: got %d, want 404", w.Code)
	}
}

func TestApplyEvidence_UniversityDifferentUniForbidden(t *testing.T) {
	sid := uuid.New()
	recUni := uuid.New()
	svc := &fakeComplianceSvc{getRec: &models.ComplianceRecord{StudentID: sid, UniversityID: &recUni, State: string(compliance.AtRisk)}}
	r := newRouter(svc)

	w := do(r, "POST", evidencePath(sid), `{"target":"Compliant","evidence_doc_id":"`+uuid.NewString()+`"}`,
		map[string]string{"X-User-Role": "university", "X-University-ID": uuid.NewString(), "X-User-ID": uuid.NewString()})

	if w.Code != http.StatusForbidden {
		t.Fatalf("status: got %d, want 403 (different university)", w.Code)
	}
}
