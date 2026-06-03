//go:build e2e

// End-to-end test for the FR-01 authentication flow, driven entirely through the
// api-gateway over HTTP. It stands up the real stack with Testcontainers —
// PostgreSQL, Redis, auth-service and api-gateway (the two services are built
// from their Dockerfiles) — wires them on a shared network, then exercises
// register -> verify-email -> login. The e-mail verification code (which a test
// can't receive by mail) is read straight from Redis, where auth-service stores it.
//
// Run with: go test -tags=e2e -timeout 600s ./...   (Docker required)
package e2e

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/testcontainers/testcontainers-go"
	tcexec "github.com/testcontainers/testcontainers-go/exec"
	"github.com/testcontainers/testcontainers-go/network"
	"github.com/testcontainers/testcontainers-go/wait"
)

const jwtSecret = "e2e-secret-key"

func TestAuthFlow_E2E(t *testing.T) {
	ctx := context.Background()

	net, err := network.New(ctx)
	if err != nil {
		t.Fatalf("create network: %v", err)
	}
	t.Cleanup(func() { _ = net.Remove(ctx) })
	netName := net.Name

	// ── PostgreSQL (auth users) ──
	pg, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			Image:          "postgres:17-alpine",
			Env:            map[string]string{"POSTGRES_USER": "postgres", "POSTGRES_PASSWORD": "admin", "POSTGRES_DB": "auth_db"},
			Networks:       []string{netName},
			NetworkAliases: map[string][]string{netName: {"authdb"}},
			WaitingFor: wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).WithStartupTimeout(60 * time.Second),
		},
		Started: true,
	})
	if err != nil {
		t.Fatalf("postgres: %v", err)
	}
	t.Cleanup(func() { _ = pg.Terminate(ctx) })

	// ── Redis (verification codes + refresh tokens) ──
	redis, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			Image:          "redis:7-alpine",
			Networks:       []string{netName},
			NetworkAliases: map[string][]string{netName: {"redis"}},
			WaitingFor:     wait.ForListeningPort("6379/tcp").WithStartupTimeout(60 * time.Second),
		},
		Started: true,
	})
	if err != nil {
		t.Fatalf("redis: %v", err)
	}
	t.Cleanup(func() { _ = redis.Terminate(ctx) })

	// ── auth-service (built from its Dockerfile) ──
	auth, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			FromDockerfile: testcontainers.FromDockerfile{Context: "../services/auth-service"},
			Env: map[string]string{
				"DB_HOST": "authdb", "DB_PORT": "5432", "DB_USER": "postgres",
				"DB_PASSWORD": "admin", "DB_NAME": "auth_db", "DB_SSLMODE": "disable",
				"REDIS_URL":       "redis://redis:6379/0",
				"JWT_SECRET":      jwtSecret,
				"SERVER_PORT":     "8081",
				"ALLOWED_ORIGINS": "*",
			},
			Networks:       []string{netName},
			NetworkAliases: map[string][]string{netName: {"auth-service"}},
			WaitingFor:     wait.ForListeningPort("8081/tcp").WithStartupTimeout(240 * time.Second),
		},
		Started: true,
	})
	if err != nil {
		t.Fatalf("auth-service: %v", err)
	}
	t.Cleanup(func() { _ = auth.Terminate(ctx) })

	// ── api-gateway (built from its Dockerfile) ──
	// gRPC backends are unused by the auth flow; grpc.NewClient is lazy, so dummy
	// targets are fine as long as they are syntactically valid host:port.
	gw, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			FromDockerfile: testcontainers.FromDockerfile{Context: "../services/api-gateway"},
			Env: map[string]string{
				"PORT":                 "8080",
				"AUTH_SERVICE_URL":     "http://auth-service:8081",
				"JWT_SECRET":           jwtSecret,
				"STUDENT_GRPC_URL":     "auth-service:50051",
				"EMPLOYER_GRPC_URL":    "auth-service:50052",
				"UNIVERSITY_GRPC_URL":  "auth-service:50053",
				"APPLICATION_GRPC_URL": "auth-service:50054",
				"DOCUMENT_SERVICE_URL": "http://auth-service:8082",
				"APPLICATION_HTTP_URL": "http://auth-service:8083",
				"ALLOWED_ORIGINS":      "*",
			},
			Networks:       []string{netName},
			NetworkAliases: map[string][]string{netName: {"gateway"}},
			ExposedPorts:   []string{"8080/tcp"},
			WaitingFor:     wait.ForListeningPort("8080/tcp").WithStartupTimeout(240 * time.Second),
		},
		Started: true,
	})
	if err != nil {
		t.Fatalf("api-gateway: %v", err)
	}
	t.Cleanup(func() { _ = gw.Terminate(ctx) })

	gwHost, _ := gw.Host(ctx)
	gwPort, _ := gw.MappedPort(ctx, "8080")
	base := fmt.Sprintf("http://%s:%s", gwHost, gwPort.Port())

	const email, password = "e2e@uni.kz", "password123"

	// 1. Register through the gateway.
	if code, body := postJSON(t, base+"/api/auth/register", map[string]string{
		"email": email, "password": password, "role": "student",
	}); code != http.StatusOK && code != http.StatusCreated {
		t.Fatalf("register: status %d, body %s", code, body)
	}

	// 2. Read the verification code from Redis (where auth-service stores it).
	vcode := fetchVerificationCode(t, ctx, redis, email)

	// 3. Verify e-mail through the gateway.
	if code, body := postJSON(t, base+"/api/auth/verify-email", map[string]string{
		"email": email, "code": vcode,
	}); code != http.StatusOK {
		t.Fatalf("verify-email: status %d, body %s", code, body)
	}

	// 4. Login through the gateway -> expect a token pair.
	code, body := postJSON(t, base+"/api/auth/login", map[string]string{
		"email": email, "password": password,
	})
	if code != http.StatusOK {
		t.Fatalf("login: status %d, body %s", code, body)
	}
	if !strings.Contains(body, "access_token") {
		t.Errorf("login returned no access token: %s", body)
	}
}

func postJSON(t *testing.T, url string, payload any) (int, string) {
	t.Helper()
	b, _ := json.Marshal(payload)
	resp, err := http.Post(url, "application/json", strings.NewReader(string(b)))
	if err != nil {
		t.Fatalf("POST %s: %v", url, err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, string(body)
}

// fetchVerificationCode reads the latest e-mail verification code for the user
// from Redis (key "verif:<email>:email_verification"), retrying briefly.
func fetchVerificationCode(t *testing.T, ctx context.Context, redis testcontainers.Container, email string) string {
	t.Helper()
	key := fmt.Sprintf("verif:%s:email_verification", email)

	var last string
	for attempt := 0; attempt < 20; attempt++ {
		_, reader, err := redis.Exec(ctx, []string{"redis-cli", "GET", key}, tcexec.Multiplexed())
		if err == nil {
			out, _ := io.ReadAll(reader)
			last = strings.TrimSpace(string(out))
			if len(last) == 6 {
				return last
			}
		}
		time.Sleep(200 * time.Millisecond)
	}
	t.Fatalf("verification code not found in Redis (key %q); last=%q", key, last)
	return ""
}
