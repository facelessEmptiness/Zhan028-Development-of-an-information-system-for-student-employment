package handler

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"student-service/internal/models"
	"student-service/internal/repository"
	"student-service/internal/storage"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type stubDocRepo struct {
	doc     *models.Document
	findErr error
	updated *models.Document
	deleted bool
}

func (s *stubDocRepo) Create(*models.Document) error { return nil }
func (s *stubDocRepo) FindByID(uuid.UUID) (*models.Document, error) {
	if s.findErr != nil {
		return nil, s.findErr
	}
	return s.doc, nil
}
func (s *stubDocRepo) FindByUserID(uuid.UUID) ([]*models.Document, error) {
	if s.doc != nil {
		return []*models.Document{s.doc}, nil
	}
	return nil, nil
}
func (s *stubDocRepo) Update(d *models.Document) error { s.updated = d; return nil }
func (s *stubDocRepo) Delete(uuid.UUID) error          { s.deleted = true; return nil }
func (s *stubDocRepo) VerifyAllPendingByUserID(uuid.UUID, uuid.UUID) ([]*models.Document, error) {
	return nil, nil
}
func (s *stubDocRepo) CountPendingDiplomaByUniversityID(uuid.UUID) (int64, error) { return 0, nil }

type stubNotifRepo struct{ created []*models.Notification }

func (s *stubNotifRepo) Create(n *models.Notification) error {
	s.created = append(s.created, n)
	return nil
}
func (s *stubNotifRepo) FindByUserID(uuid.UUID) ([]*models.Notification, error) { return nil, nil }
func (s *stubNotifRepo) CountUnread(uuid.UUID) (int64, error)                   { return 0, nil }
func (s *stubNotifRepo) MarkRead(uuid.UUID, uuid.UUID) error                    { return nil }
func (s *stubNotifRepo) MarkAllRead(uuid.UUID) error                            { return nil }

type stubStorage struct{ deleted bool }

var _ storage.Storage = (*stubStorage)(nil)

func (s *stubStorage) Upload(context.Context, string, string, io.Reader, int64) error { return nil }
func (s *stubStorage) Download(context.Context, string) (io.ReadCloser, error) {
	return io.NopCloser(strings.NewReader("file-bytes")), nil
}
func (s *stubStorage) Delete(context.Context, string) error { s.deleted = true; return nil }

func docRouter(h *DocumentHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.PUT("/api/documents/:id/verify", h.Verify)
	r.PUT("/api/documents/:id/reject", h.Reject)
	r.DELETE("/api/documents/:id", h.Delete)
	r.POST("/api/documents/upload", h.Upload)
	r.GET("/api/documents/my", h.ListMy)
	return r
}

func doReq(r *gin.Engine, method, path, body string, headers map[string]string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	rq := httptest.NewRequest(method, path, strings.NewReader(body))
	for k, v := range headers {
		rq.Header.Set(k, v)
	}
	r.ServeHTTP(w, rq)
	return w
}

func TestVerify_SetsVerifiedAndNotifiesOwner(t *testing.T) {
	owner := uuid.New()
	doc := &models.Document{ID: uuid.New(), UserID: owner, Type: models.DocTypeDiploma, Status: models.DocStatusPending}
	repo := &stubDocRepo{doc: doc}
	notif := &stubNotifRepo{}
	r := docRouter(NewDocumentHandler(repo, notif, &stubStorage{}))

	w := doReq(r, "PUT", "/api/documents/"+doc.ID.String()+"/verify", "",
		map[string]string{"X-User-ID": uuid.NewString()})

	if w.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200", w.Code)
	}
	if repo.updated == nil || repo.updated.Status != models.DocStatusVerified {
		t.Errorf("status not set to verified: %+v", repo.updated)
	}
	if repo.updated.VerifiedBy == nil || repo.updated.VerifiedAt == nil {
		t.Error("verified_by / verified_at audit fields not set")
	}
	if len(notif.created) != 1 || notif.created[0].UserID != owner {
		t.Errorf("expected one notification to the owner, got %v", notif.created)
	}
}

func TestReject_SetsRejectedWithComment(t *testing.T) {
	owner := uuid.New()
	doc := &models.Document{ID: uuid.New(), UserID: owner, Type: models.DocTypeDiploma, Status: models.DocStatusPending}
	repo := &stubDocRepo{doc: doc}
	notif := &stubNotifRepo{}
	r := docRouter(NewDocumentHandler(repo, notif, &stubStorage{}))

	w := doReq(r, "PUT", "/api/documents/"+doc.ID.String()+"/reject", `{"comment":"blurry scan"}`,
		map[string]string{"X-User-ID": uuid.NewString(), "Content-Type": "application/json"})

	if w.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200", w.Code)
	}
	if repo.updated.Status != models.DocStatusRejected {
		t.Errorf("status: got %q, want rejected", repo.updated.Status)
	}
	if repo.updated.Comment != "blurry scan" {
		t.Errorf("comment not saved: %q", repo.updated.Comment)
	}
	if len(notif.created) != 1 {
		t.Error("expected a rejection notification")
	}
}

func TestSetStatus_InvalidID(t *testing.T) {
	r := docRouter(NewDocumentHandler(&stubDocRepo{}, &stubNotifRepo{}, &stubStorage{}))
	w := doReq(r, "PUT", "/api/documents/not-a-uuid/verify", "", map[string]string{"X-User-ID": uuid.NewString()})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("invalid id: got %d, want 400", w.Code)
	}
}

func TestSetStatus_BadUserID(t *testing.T) {
	doc := &models.Document{ID: uuid.New()}
	r := docRouter(NewDocumentHandler(&stubDocRepo{doc: doc}, &stubNotifRepo{}, &stubStorage{}))
	w := doReq(r, "PUT", "/api/documents/"+doc.ID.String()+"/verify", "", map[string]string{"X-User-ID": "garbage"})
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("bad user id: got %d, want 401", w.Code)
	}
}

func TestSetStatus_DocumentNotFound(t *testing.T) {
	r := docRouter(NewDocumentHandler(&stubDocRepo{findErr: repository.ErrDocumentNotFound}, &stubNotifRepo{}, &stubStorage{}))
	w := doReq(r, "PUT", "/api/documents/"+uuid.NewString()+"/verify", "", map[string]string{"X-User-ID": uuid.NewString()})
	if w.Code != http.StatusNotFound {
		t.Fatalf("missing doc: got %d, want 404", w.Code)
	}
}

func TestDelete_NotOwnerForbidden(t *testing.T) {
	doc := &models.Document{ID: uuid.New(), UserID: uuid.New(), StorageKey: "k"}
	stor := &stubStorage{}
	r := docRouter(NewDocumentHandler(&stubDocRepo{doc: doc}, &stubNotifRepo{}, stor))

	w := doReq(r, "DELETE", "/api/documents/"+doc.ID.String(), "", map[string]string{"X-User-ID": uuid.NewString()})
	if w.Code != http.StatusForbidden {
		t.Fatalf("non-owner delete: got %d, want 403", w.Code)
	}
	if stor.deleted {
		t.Error("must not delete the stored object for a non-owner")
	}
}

func TestDelete_OwnerSucceeds(t *testing.T) {
	owner := uuid.New()
	doc := &models.Document{ID: uuid.New(), UserID: owner, StorageKey: "k"}
	repo := &stubDocRepo{doc: doc}
	stor := &stubStorage{}
	r := docRouter(NewDocumentHandler(repo, &stubNotifRepo{}, stor))

	w := doReq(r, "DELETE", "/api/documents/"+doc.ID.String(), "", map[string]string{"X-User-ID": owner.String()})
	if w.Code != http.StatusOK {
		t.Fatalf("owner delete: got %d, want 200", w.Code)
	}
	if !stor.deleted || !repo.deleted {
		t.Error("expected both storage object and DB record to be deleted")
	}
}

func TestUpload_InvalidType(t *testing.T) {
	r := docRouter(NewDocumentHandler(&stubDocRepo{}, &stubNotifRepo{}, &stubStorage{}))
	w := doReq(r, "POST", "/api/documents/upload", "type=passport",
		map[string]string{"X-User-ID": uuid.NewString(), "Content-Type": "application/x-www-form-urlencoded"})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("invalid type: got %d, want 400", w.Code)
	}
}

func TestListMy_BadUserID(t *testing.T) {
	r := docRouter(NewDocumentHandler(&stubDocRepo{}, &stubNotifRepo{}, &stubStorage{}))
	w := doReq(r, "GET", "/api/documents/my", "", map[string]string{"X-User-ID": "nope"})
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("bad user id: got %d, want 401", w.Code)
	}
}

func TestListMy_ReturnsDocuments(t *testing.T) {
	uid := uuid.New()
	doc := &models.Document{ID: uuid.New(), UserID: uid, Type: models.DocTypeCV, Status: models.DocStatusPending}
	r := docRouter(NewDocumentHandler(&stubDocRepo{doc: doc}, &stubNotifRepo{}, &stubStorage{}))

	w := doReq(r, "GET", "/api/documents/my", "", map[string]string{"X-User-ID": uid.String()})
	if w.Code != http.StatusOK {
		t.Fatalf("list my: got %d, want 200", w.Code)
	}
	if !strings.Contains(w.Body.String(), "documents") {
		t.Errorf("expected documents in body, got %s", w.Body.String())
	}
}
