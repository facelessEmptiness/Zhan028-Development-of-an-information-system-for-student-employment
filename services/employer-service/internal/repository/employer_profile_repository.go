package repository

import (
	"errors"
	"employer-service/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrProfileNotFound = errors.New("employer profile not found")
	ErrBINTaken        = errors.New("БИН уже зарегистрирован другим работодателем")
)

type EmployerProfileRepository interface {
	GetByEmployerID(employerID uuid.UUID) (*models.EmployerProfile, error)
	Create(profile *models.EmployerProfile) error
	Update(profile *models.EmployerProfile) error
	ExistsByBIN(bin string, excludeEmployerID uuid.UUID) (bool, error)
}

type employerProfileRepository struct {
	db *gorm.DB
}

func NewEmployerProfileRepository(db *gorm.DB) EmployerProfileRepository {
	return &employerProfileRepository{db: db}
}

func (r *employerProfileRepository) GetByEmployerID(employerID uuid.UUID) (*models.EmployerProfile, error) {
	var profile models.EmployerProfile
	err := r.db.First(&profile, "employer_id = ?", employerID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrProfileNotFound
	}
	return &profile, err
}

func (r *employerProfileRepository) Create(profile *models.EmployerProfile) error {
	return r.db.Create(profile).Error
}

func (r *employerProfileRepository) Update(profile *models.EmployerProfile) error {
	return r.db.Save(profile).Error
}

func (r *employerProfileRepository) ExistsByBIN(bin string, excludeEmployerID uuid.UUID) (bool, error) {
	if bin == "" {
		return false, nil
	}
	var count int64
	err := r.db.Model(&models.EmployerProfile{}).
		Where("bin = ? AND employer_id != ?", bin, excludeEmployerID).
		Count(&count).Error
	return count > 0, err
}
