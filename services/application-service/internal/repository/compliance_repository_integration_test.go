//go:build integration

// Integration tests for the GORM-backed ComplianceRepository. They run only
// with the "integration" build tag and a working Docker daemon: Testcontainers
// starts a throwaway PostgreSQL, the service's real migrations are applied, and
// the repository is exercised against it. This verifies the model<->table
// mapping and DB-level constraints that fake-based unit tests cannot.
package repository

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"application-service/internal/config"
	"application-service/internal/models"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib" // registers the "pgx" database/sql driver for the readiness probe
	"github.com/testcontainers/testcontainers-go"
	tcpg "github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
	gormpg "gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// startPostgres spins a throwaway PostgreSQL via Testcontainers, applies the
// service's real migrations, and returns a connected *gorm.DB. The container is
// torn down automatically when the test ends.
func startPostgres(t *testing.T) *gorm.DB {
	t.Helper()
	ctx := context.Background()

	container, err := tcpg.Run(ctx, "postgres:17-alpine",
		tcpg.WithDatabase("application_db"),
		tcpg.WithUsername("postgres"),
		tcpg.WithPassword("admin"),
		// Probe with a real SQL connection so we don't race the init/restart
		// window where Postgres briefly accepts then drops connections.
		testcontainers.WithWaitStrategy(
			wait.ForSQL("5432/tcp", "pgx", func(host, port string) string {
				port = strings.TrimSuffix(port, "/tcp") // v0.42 passes the proto-qualified port
				return fmt.Sprintf("postgres://postgres:admin@%s:%s/application_db?sslmode=disable", host, port)
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
		DBName: "application_db", DBSSLMode: "disable",
	}
	if err := config.RunMigrations(cfg); err != nil {
		t.Fatalf("run migrations: %v", err)
	}

	dsn := fmt.Sprintf("host=%s port=%s user=postgres password=admin dbname=application_db sslmode=disable", host, port.Port())
	db, err := gorm.Open(gormpg.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("gorm open: %v", err)
	}
	return db
}

func TestComplianceRepository_Integration(t *testing.T) {
	db := startPostgres(t)
	repo := NewComplianceRepository(db)

	uni := uuid.New()
	student := uuid.New()
	grad := time.Date(2025, time.June, 1, 0, 0, 0, 0, time.UTC)

	rec := &models.ComplianceRecord{
		StudentID:      student,
		UniversityID:   &uni,
		State:          "NotYetDue",
		GrantYears:     3,
		GraduationDate: &grad,
	}
	if err := repo.Create(rec); err != nil {
		t.Fatalf("Create: %v", err)
	}

	got, err := repo.GetByStudentID(student)
	if err != nil {
		t.Fatalf("GetByStudentID: %v", err)
	}
	if got.State != "NotYetDue" || got.GrantYears != 3 || got.GraduationDate == nil {
		t.Fatalf("round-trip mismatch: %+v", got)
	}

	got.State = "AtRisk"
	if err := repo.Update(got); err != nil {
		t.Fatalf("Update: %v", err)
	}

	list, err := repo.ListByUniversityID(uni)
	if err != nil || len(list) != 1 || list[0].State != "AtRisk" {
		t.Fatalf("ListByUniversityID: err=%v list=%+v", err, list)
	}

	nonTerminal, err := repo.ListNonTerminal()
	if err != nil {
		t.Fatalf("ListNonTerminal: %v", err)
	}
	if len(nonTerminal) != 1 {
		t.Errorf("expected 1 non-terminal record, got %d", len(nonTerminal))
	}

	if _, err := repo.GetByStudentID(uuid.New()); err != ErrComplianceNotFound {
		t.Errorf("expected ErrComplianceNotFound for a missing student, got %v", err)
	}
}

// TestComplianceRepository_StateCheckConstraint proves the DB CHECK constraint
// rejects an unknown state — exactly the kind of thing a fake repository can
// never catch.
func TestComplianceRepository_StateCheckConstraint(t *testing.T) {
	db := startPostgres(t)

	err := db.Exec(
		`INSERT INTO compliance_records (student_id, state, grant_years) VALUES (?, 'Bogus', 3)`,
		uuid.New(),
	).Error
	if err == nil {
		t.Fatal("expected the state CHECK constraint to reject 'Bogus'")
	}
}
