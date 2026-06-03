//go:build integration

// Integration test for MinIOStorage. Runs only with the "integration" build tag
// and a working Docker daemon: Testcontainers starts a throwaway MinIO and the
// storage layer is exercised against real object storage — an upload/download
// round-trip plus deletion, which fake-based unit tests cannot validate.
package storage

import (
	"bytes"
	"context"
	"io"
	"strings"
	"testing"

	tcminio "github.com/testcontainers/testcontainers-go/modules/minio"
)

func startMinIO(t *testing.T) (endpoint, access, secret string) {
	t.Helper()
	ctx := context.Background()
	const user, pass = "minioadmin", "minioadmin"

	container, err := tcminio.Run(ctx, "minio/minio:RELEASE.2024-01-16T16-07-38Z",
		tcminio.WithUsername(user),
		tcminio.WithPassword(pass),
	)
	if err != nil {
		t.Fatalf("start minio container: %v", err)
	}
	t.Cleanup(func() { _ = container.Terminate(ctx) })

	ep, err := container.ConnectionString(ctx)
	if err != nil {
		t.Fatalf("connection string: %v", err)
	}
	// minio.New expects a bare host:port (no scheme).
	ep = strings.TrimPrefix(ep, "http://")
	ep = strings.TrimPrefix(ep, "https://")
	return ep, user, pass
}

func TestMinIOStorage_RoundTrip(t *testing.T) {
	endpoint, access, secret := startMinIO(t)

	s, err := NewMinIOStorage(endpoint, access, secret, "test-documents", false)
	if err != nil {
		t.Fatalf("NewMinIOStorage: %v", err)
	}

	ctx := context.Background()
	key := "documents/student-1/cv.pdf"
	content := []byte("hello minio — integration round-trip")

	if err := s.Upload(ctx, key, "application/pdf", bytes.NewReader(content), int64(len(content))); err != nil {
		t.Fatalf("Upload: %v", err)
	}

	rc, err := s.Download(ctx, key)
	if err != nil {
		t.Fatalf("Download: %v", err)
	}
	got, err := io.ReadAll(rc)
	_ = rc.Close()
	if err != nil {
		t.Fatalf("read downloaded object: %v", err)
	}
	if !bytes.Equal(got, content) {
		t.Errorf("round-trip mismatch: got %q, want %q", got, content)
	}

	if err := s.Delete(ctx, key); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	// After deletion the object must be gone.
	rc2, err := s.Download(ctx, key)
	if err == nil {
		_, rerr := io.ReadAll(rc2)
		_ = rc2.Close()
		if rerr == nil {
			t.Error("expected an error reading a deleted object")
		}
	}
}
