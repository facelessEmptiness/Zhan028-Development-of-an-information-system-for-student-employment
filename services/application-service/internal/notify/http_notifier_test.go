package notify

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
)

func TestNotifyAtRisk_PostsToStudentService(t *testing.T) {
	var gotPath string
	var gotBody map[string]string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		w.WriteHeader(http.StatusCreated)
	}))
	defer srv.Close()

	sid := uuid.New()
	NewHTTPNotifier(srv.URL).NotifyAtRisk(sid)

	if gotPath != "/api/notifications/internal" {
		t.Errorf("path: got %q, want /api/notifications/internal", gotPath)
	}
	if gotBody["user_id"] != sid.String() {
		t.Errorf("user_id: got %q, want %q", gotBody["user_id"], sid.String())
	}
	if gotBody["type"] != atRiskNotificationType {
		t.Errorf("type: got %q, want %q", gotBody["type"], atRiskNotificationType)
	}
	if gotBody["title"] == "" || gotBody["body"] == "" {
		t.Error("title and body must be set")
	}
}

func TestNotifyAtRisk_ServerErrorIsSwallowed(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	// Must not panic despite the 5xx response (fire-and-forget).
	NewHTTPNotifier(srv.URL).NotifyAtRisk(uuid.New())
}

func TestNotifyAtRisk_UnreachableIsSwallowed(t *testing.T) {
	// Closed server -> connection refused; must be swallowed, not panic.
	srv := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	url := srv.URL
	srv.Close()

	NewHTTPNotifier(url).NotifyAtRisk(uuid.New())
}
