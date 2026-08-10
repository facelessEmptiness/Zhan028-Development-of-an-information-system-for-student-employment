package service

import (
	"errors"
	"university-service/internal/models"
	"university-service/internal/repository"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
)

var (
	ErrUniversityNotFound = errors.New("university not found")
	ErrNameAlreadyTaken   = errors.New("university name already taken")
)

type UniversityService interface {
	CreateUniversity(name, city, country, website string) (*models.University, error)
	GetAllUniversities() ([]models.University, error)
	GetUniversityByID(id uuid.UUID) (*models.University, error)
	UpdateUniversity(id uuid.UUID, name, city, country, website string) (*models.University, error)
	DeleteUniversity(id uuid.UUID) error
}

type universityService struct {
	repo repository.UniversityRepository
}

func NewUniversityService(repo repository.UniversityRepository) UniversityService {
	return &universityService{repo: repo}
}

func (s *universityService) CreateUniversity(name, city, country, website string) (*models.University, error) {
	university := &models.University{
		Name:    name,
		City:    city,
		Country: country,
		Website: website,
	}

	if err := s.repo.Create(university); err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) || isDuplicateKeyError(err) {
			return nil, ErrNameAlreadyTaken
		}
		return nil, err
	}
	return university, nil
}

func (s *universityService) GetAllUniversities() ([]models.University, error) {
	return s.repo.GetAll()
}

func (s *universityService) GetUniversityByID(id uuid.UUID) (*models.University, error) {
	university, err := s.repo.GetByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUniversityNotFound
		}
		return nil, err
	}
	return university, nil
}

func (s *universityService) UpdateUniversity(id uuid.UUID, name, city, country, website string) (*models.University, error) {
	university, err := s.repo.GetByID(id)
	if err != nil {
		return nil, ErrUniversityNotFound
	}

	if name != "" {
		university.Name = name
	}
	if city != "" {
		university.City = city
	}
	if country != "" {
		university.Country = country
	}
	if website != "" {
		university.Website = website
	}

	if err := s.repo.Update(university); err != nil {
		return nil, err
	}
	return university, nil
}

// isDuplicateKeyError detects Postgres unique-constraint violations (code 23505).
// gorm.ErrDuplicatedKey is only set by some GORM dialects; pgconn covers Postgres.
func isDuplicateKeyError(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func (s *universityService) DeleteUniversity(id uuid.UUID) error {
	_, err := s.repo.GetByID(id)
	if err != nil {
		return ErrUniversityNotFound
	}
	return s.repo.Delete(id)
}
