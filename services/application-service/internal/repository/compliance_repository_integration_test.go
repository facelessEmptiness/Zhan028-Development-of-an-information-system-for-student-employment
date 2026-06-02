//go:build integration

// Integration test for the GORM-backed ComplianceRepository. Runs only with the
// "integration" build tag against a real Postgres given by TEST_DATABASE_DSN
// (the schema must already be migrated). It verifies the model<->table mapping
// that fake-based unit tests cannot.
package repository

import (
	"os"
	"testing"
	"time"

	"application-service/internal/models"

	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func openTestDB(t *testing.T) *gorm.DB {
	dsn := os.Getenv("TEST_DATABASE_DSN")
	if dsn == "" {
		t.Skip("TEST_DATABASE_DSN not set; skipping integration test")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	return db
}

func TestComplianceRepository_Integration(t *testing.T) {
	db := openTestDB(t)
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

	// State change persists and shows up in the university list and non-terminal set.
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
	found := false
	for _, r := range nonTerminal {
		if r.StudentID == student {
			found = true
		}
	}
	if !found {
		t.Error("AtRisk record must appear in the non-terminal set")
	}

	if _, err := repo.GetByStudentID(uuid.New()); err != ErrComplianceNotFound {
		t.Errorf("expected ErrComplianceNotFound for missing student, got %v", err)
	}
}
