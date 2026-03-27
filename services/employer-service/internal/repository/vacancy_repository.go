package repository

import (
	"employer-service/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SearchParams struct {
	Search   string
	JobType  string
	Location string
	Page     int
	PageSize int
}

type VacancyRepository interface {
	Create(vacancy *models.Vacancy) error
	Search(params SearchParams) ([]models.Vacancy, int64, error)
	GetByID(id uuid.UUID) (*models.Vacancy, error)
	GetByEmployerID(employerID uuid.UUID) ([]models.Vacancy, error)
	Update(vacancy *models.Vacancy) error
	Delete(id uuid.UUID) error
}

type vacancyRepository struct {
	db *gorm.DB
}

func NewVacancyRepository(db *gorm.DB) VacancyRepository {
	return &vacancyRepository{db: db}
}

func (r *vacancyRepository) Create(vacancy *models.Vacancy) error {
	return r.db.Create(vacancy).Error
}

func (r *vacancyRepository) Search(params SearchParams) ([]models.Vacancy, int64, error) {
	query := r.db.Model(&models.Vacancy{}).Where("status = ?", "active")

	if params.Search != "" {
		like := "%" + params.Search + "%"
		query = query.Where("title ILIKE ? OR description ILIKE ? OR skills ILIKE ?", like, like, like)
	}
	if params.JobType != "" {
		query = query.Where("job_type = ?", params.JobType)
	}
	if params.Location != "" {
		query = query.Where("location ILIKE ?", "%"+params.Location+"%")
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page := params.Page
	if page < 1 {
		page = 1
	}
	pageSize := params.PageSize
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	var vacancies []models.Vacancy
	err := query.Order("created_at desc").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&vacancies).Error

	return vacancies, total, err
}

func (r *vacancyRepository) GetByID(id uuid.UUID) (*models.Vacancy, error) {
	var vacancy models.Vacancy
	err := r.db.First(&vacancy, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &vacancy, nil
}

func (r *vacancyRepository) GetByEmployerID(employerID uuid.UUID) ([]models.Vacancy, error) {
	var vacancies []models.Vacancy
	err := r.db.Where("employer_id = ?", employerID).Order("created_at desc").Find(&vacancies).Error
	return vacancies, err
}

func (r *vacancyRepository) Update(vacancy *models.Vacancy) error {
	return r.db.Save(vacancy).Error
}

func (r *vacancyRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Vacancy{}, "id = ?", id).Error
}
