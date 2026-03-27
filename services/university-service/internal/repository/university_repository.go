package repository

import (
	"university-service/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UniversityRepository interface {
	Create(university *models.University) error
	GetAll() ([]models.University, error)
	GetByID(id uuid.UUID) (*models.University, error)
	Update(university *models.University) error
	Delete(id uuid.UUID) error
}

type universityRepository struct {
	db *gorm.DB
}

func NewUniversityRepository(db *gorm.DB) UniversityRepository {
	return &universityRepository{db: db}
}

func (r *universityRepository) Create(university *models.University) error {
	return r.db.Create(university).Error
}

func (r *universityRepository) GetAll() ([]models.University, error) {
	var universities []models.University
	err := r.db.Order("name asc").Find(&universities).Error
	return universities, err
}

func (r *universityRepository) GetByID(id uuid.UUID) (*models.University, error) {
	var university models.University
	err := r.db.First(&university, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &university, nil
}

func (r *universityRepository) Update(university *models.University) error {
	return r.db.Save(university).Error
}

func (r *universityRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.University{}, "id = ?", id).Error
}
