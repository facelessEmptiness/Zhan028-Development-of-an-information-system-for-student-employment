//go:build integration

// Integration tests for the GORM-backed UserRepository. They run only with the
// "integration" build tag and a working Docker daemon: Testcontainers starts a
// throwaway PostgreSQL, the service's real migrations are applied (via
// ConnectDatabase), and the repository is exercised against it — verifying the
// model<->table mapping plus the UNIQUE email index and user_role enum that a
// fake repository cannot enforce.
package repository

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"auth-service/internal/config"
	"auth-service/internal/models"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/testcontainers/testcontainers-go"
	tcpg "github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
	"gorm.io/gorm"
)

func startAuthDB(t *testing.T) *gorm.DB {
	t.Helper()
	ctx := context.Background()

	container, err := tcpg.Run(ctx, "postgres:17-alpine",
		tcpg.WithDatabase("auth_db"),
		tcpg.WithUsername("postgres"),
		tcpg.WithPassword("admin"),
		testcontainers.WithWaitStrategy(
			wait.ForSQL("5432/tcp", "pgx", func(host, port string) string {
				port = strings.TrimSuffix(port, "/tcp")
				return fmt.Sprintf("postgres://postgres:admin@%s:%s/auth_db?sslmode=disable", host, port)
			}).WithStartupTimeout(60*time.Second),
		),
	)
	if err != nil {
		t.Fatalf("start postgres container: %v", err)
	}
	t.Cleanup(func() { _ = container.Terminate(ctx) })

	host, err := container.Host(ctx)
	if err != nil {
		t.Fatalf("container host: %v", err)
	}
	port, err := container.MappedPort(ctx, "5432")
	if err != nil {
		t.Fatalf("container port: %v", err)
	}

	cfg := &config.Config{
		DBHost: host, DBPort: port.Port(),
		DBUser: "postgres", DBPassword: "admin",
		DBName: "auth_db", DBSSLMode: "disable",
	}
	db, err := config.ConnectDatabase(cfg) // opens the connection and runs migrations
	if err != nil {
		t.Fatalf("connect + migrate: %v", err)
	}
	return db
}

func TestUserRepository_Integration(t *testing.T) {
	db := startAuthDB(t)
	repo := NewUserRepository(db)

	user := &models.User{
		Email:        "student@uni.kz",
		PasswordHash: "hash",
		Role:         models.RoleStudent,
		IsActive:     true,
	}
	if err := repo.Create(user); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if user.ID == uuid.Nil {
		t.Fatal("expected an ID to be assigned on create")
	}

	got, err := repo.FindByEmail("student@uni.kz")
	if err != nil {
		t.Fatalf("FindByEmail: %v", err)
	}
	if got.Role != models.RoleStudent || got.PasswordHash != "hash" {
		t.Errorf("round-trip mismatch: %+v", got)
	}

	byID, err := repo.FindByID(user.ID)
	if err != nil || byID.Email != "student@uni.kz" {
		t.Fatalf("FindByID: err=%v rec=%+v", err, byID)
	}

	if exists, err := repo.ExistsByEmail("student@uni.kz"); err != nil || !exists {
		t.Errorf("ExistsByEmail: err=%v exists=%v", err, exists)
	}

	// Repo-level duplicate guard.
	dup := &models.User{Email: "student@uni.kz", PasswordHash: "x", Role: models.RoleEmployer}
	if err := repo.Create(dup); err != ErrUserAlreadyExists {
		t.Errorf("expected ErrUserAlreadyExists, got %v", err)
	}

	// Update persists.
	got.IsEmailVerified = true
	if err := repo.Update(got); err != nil {
		t.Fatalf("Update: %v", err)
	}
	if reloaded, _ := repo.FindByID(user.ID); !reloaded.IsEmailVerified {
		t.Error("Update did not persist is_email_verified")
	}

	// Delete, then the user is gone.
	if err := repo.Delete(user.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := repo.FindByEmail("student@uni.kz"); err != ErrUserNotFound {
		t.Errorf("expected ErrUserNotFound after delete, got %v", err)
	}
}

// TestUserRepository_DBConstraints verifies the database enforces the UNIQUE
// email index and the user_role enum — neither is catchable with a fake.
func TestUserRepository_DBConstraints(t *testing.T) {
	db := startAuthDB(t)

	if err := db.Exec(`INSERT INTO users (email, password_hash, role) VALUES ('dup@uni.kz', 'h', 'student')`).Error; err != nil {
		t.Fatalf("first insert: %v", err)
	}
	if err := db.Exec(`INSERT INTO users (email, password_hash, role) VALUES ('dup@uni.kz', 'h2', 'student')`).Error; err == nil {
		t.Error("expected the UNIQUE email constraint to reject the duplicate")
	}
	if err := db.Exec(`INSERT INTO users (email, password_hash, role) VALUES ('x@uni.kz', 'h', 'superhero')`).Error; err == nil {
		t.Error("expected the user_role enum to reject 'superhero'")
	}
}
