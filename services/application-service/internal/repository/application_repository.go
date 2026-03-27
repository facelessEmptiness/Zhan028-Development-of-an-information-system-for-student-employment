package repository

import (
	"application-service/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type StatusCount struct {
	Status string
	Count  int64
}

type ApplicationRepository interface {
	Create(app *models.Application) error
	GetByStudentID(studentID uuid.UUID) ([]models.Application, error)
	GetByVacancyID(vacancyID uuid.UUID) ([]models.Application, error)
	GetByID(id uuid.UUID) (*models.Application, error)
	UpdateStatus(id uuid.UUID, status string) error
	Delete(id uuid.UUID) error
	ExistsByStudentAndVacancy(studentID, vacancyID uuid.UUID) (bool, error)
	CountAll() (int64, error)
	CountByStatus() ([]StatusCount, error)
}

type applicationRepository struct {
	db *gorm.DB
}

func NewApplicationRepository(db *gorm.DB) ApplicationRepository {
	return &applicationRepository{db: db}
}

func (r *applicationRepository) Create(app *models.Application) error {
	return r.db.Create(app).Error
}

func (r *applicationRepository) GetByStudentID(studentID uuid.UUID) ([]models.Application, error) {
	var apps []models.Application
	err := r.db.Where("student_id = ?", studentID).Order("created_at desc").Find(&apps).Error
	return apps, err
}

func (r *applicationRepository) GetByVacancyID(vacancyID uuid.UUID) ([]models.Application, error) {
	var apps []models.Application
	err := r.db.Where("vacancy_id = ?", vacancyID).Order("created_at desc").Find(&apps).Error
	return apps, err
}

func (r *applicationRepository) GetByID(id uuid.UUID) (*models.Application, error) {
	var app models.Application
	err := r.db.First(&app, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &app, nil
}

func (r *applicationRepository) UpdateStatus(id uuid.UUID, status string) error {
	return r.db.Model(&models.Application{}).Where("id = ?", id).Update("status", status).Error
}

func (r *applicationRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Application{}, "id = ?", id).Error
}

func (r *applicationRepository) ExistsByStudentAndVacancy(studentID, vacancyID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.Model(&models.Application{}).
		Where("student_id = ? AND vacancy_id = ?", studentID, vacancyID).
		Count(&count).Error
	return count > 0, err
}

func (r *applicationRepository) CountAll() (int64, error) {
	var count int64
	err := r.db.Model(&models.Application{}).Count(&count).Error
	return count, err
}

func (r *applicationRepository) CountByStatus() ([]StatusCount, error) {
	var results []StatusCount
	err := r.db.Model(&models.Application{}).
		Select("status, count(*) as count").
		Group("status").
		Order("count desc").
		Scan(&results).Error
	return results, err
}
