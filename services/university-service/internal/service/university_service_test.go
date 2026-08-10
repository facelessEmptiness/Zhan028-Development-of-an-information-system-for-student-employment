package service

import (
	"errors"
	"testing"

	"university-service/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type stubUniRepo struct {
	uni       *models.University
	createErr error
	getErr    error
	updated   *models.University
	deletedID uuid.UUID
}

func (s *stubUniRepo) Create(*models.University) error      { return s.createErr }
func (s *stubUniRepo) GetAll() ([]models.University, error) { return []models.University{}, nil }
func (s *stubUniRepo) GetByID(uuid.UUID) (*models.University, error) {
	if s.getErr != nil {
		return nil, s.getErr
	}
	return s.uni, nil
}
func (s *stubUniRepo) Update(u *models.University) error { s.updated = u; return nil }
func (s *stubUniRepo) Delete(id uuid.UUID) error         { s.deletedID = id; return nil }

func TestCreateUniversity_Success(t *testing.T) {
	svc := NewUniversityService(&stubUniRepo{})
	u, err := svc.CreateUniversity("KBTU", "Almaty", "KZ", "kbtu.kz")
	if err != nil {
		t.Fatalf("CreateUniversity: %v", err)
	}
	if u.Name != "KBTU" || u.City != "Almaty" || u.Country != "KZ" || u.Website != "kbtu.kz" {
		t.Errorf("fields not set: %+v", u)
	}
}

func TestCreateUniversity_DuplicateName(t *testing.T) {
	svc := NewUniversityService(&stubUniRepo{createErr: gorm.ErrDuplicatedKey})
	_, err := svc.CreateUniversity("KBTU", "", "", "")
	if !errors.Is(err, ErrNameAlreadyTaken) {
		t.Fatalf("expected ErrNameAlreadyTaken, got %v", err)
	}
}

func TestGetUniversityByID_Found(t *testing.T) {
	id := uuid.New()
	svc := NewUniversityService(&stubUniRepo{uni: &models.University{ID: id, Name: "X"}})
	u, err := svc.GetUniversityByID(id)
	if err != nil {
		t.Fatalf("GetUniversityByID: %v", err)
	}
	if u.ID != id {
		t.Errorf("wrong university returned")
	}
}

func TestGetUniversityByID_NotFound(t *testing.T) {
	svc := NewUniversityService(&stubUniRepo{getErr: gorm.ErrRecordNotFound})
	_, err := svc.GetUniversityByID(uuid.New())
	if !errors.Is(err, ErrUniversityNotFound) {
		t.Fatalf("expected ErrUniversityNotFound, got %v", err)
	}
}

func TestUpdateUniversity_OnlyNonEmptyFields(t *testing.T) {
	existing := &models.University{ID: uuid.New(), Name: "Old", City: "Almaty", Country: "KZ", Website: "old.kz"}
	repo := &stubUniRepo{uni: existing}
	svc := NewUniversityService(repo)

	u, err := svc.UpdateUniversity(existing.ID, "New", "", "", "new.kz")
	if err != nil {
		t.Fatalf("UpdateUniversity: %v", err)
	}
	if u.Name != "New" {
		t.Errorf("name should update, got %q", u.Name)
	}
	if u.City != "Almaty" {
		t.Errorf("empty city must not overwrite, got %q", u.City)
	}
	if u.Website != "new.kz" {
		t.Errorf("website should update, got %q", u.Website)
	}
	if repo.updated == nil {
		t.Error("repo.Update was not called")
	}
}

func TestUpdateUniversity_NotFound(t *testing.T) {
	svc := NewUniversityService(&stubUniRepo{getErr: gorm.ErrRecordNotFound})
	_, err := svc.UpdateUniversity(uuid.New(), "X", "", "", "")
	if !errors.Is(err, ErrUniversityNotFound) {
		t.Fatalf("expected ErrUniversityNotFound, got %v", err)
	}
}

func TestDeleteUniversity_Success(t *testing.T) {
	id := uuid.New()
	repo := &stubUniRepo{uni: &models.University{ID: id}}
	svc := NewUniversityService(repo)

	if err := svc.DeleteUniversity(id); err != nil {
		t.Fatalf("DeleteUniversity: %v", err)
	}
	if repo.deletedID != id {
		t.Errorf("expected delete of %s, got %s", id, repo.deletedID)
	}
}

func TestDeleteUniversity_NotFound(t *testing.T) {
	svc := NewUniversityService(&stubUniRepo{getErr: gorm.ErrRecordNotFound})
	if err := svc.DeleteUniversity(uuid.New()); !errors.Is(err, ErrUniversityNotFound) {
		t.Fatalf("expected ErrUniversityNotFound, got %v", err)
	}
}
