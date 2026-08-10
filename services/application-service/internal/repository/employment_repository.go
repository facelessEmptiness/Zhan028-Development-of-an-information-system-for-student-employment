package repository

import (
	"time"
	"application-service/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type EmploymentRepository interface {
	Create(rec *models.EmploymentRecord) error
	GetByID(id uuid.UUID) (*models.EmploymentRecord, error)
	GetByStudentID(studentID uuid.UUID) ([]models.EmploymentRecord, error)
	GetByApplicationID(applicationID uuid.UUID) (*models.EmploymentRecord, error)
	GetByEmployerID(employerID uuid.UUID) ([]models.EmploymentRecord, error)
	GetAll() ([]models.EmploymentRecord, error)
	GetAllByUniversity(studentIDs []uuid.UUID) ([]models.EmploymentRecord, error)
	GetByUniversityID(universityID uuid.UUID) ([]models.EmploymentRecord, error)
	UpdateStatus(id uuid.UUID, status string) error
	End(id uuid.UUID) error
	EndByApplicationID(applicationID uuid.UUID) error
}

type employmentRepository struct {
	db *gorm.DB
}

func NewEmploymentRepository(db *gorm.DB) EmploymentRepository {
	return &employmentRepository{db: db}
}

func (r *employmentRepository) Create(rec *models.EmploymentRecord) error {
	return r.db.Create(rec).Error
}

func (r *employmentRepository) GetByID(id uuid.UUID) (*models.EmploymentRecord, error) {
	var rec models.EmploymentRecord
	err := r.db.First(&rec, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *employmentRepository) GetByStudentID(studentID uuid.UUID) ([]models.EmploymentRecord, error) {
	var recs []models.EmploymentRecord
	err := r.db.Where("student_id = ?", studentID).Order("started_at desc").Find(&recs).Error
	return recs, err
}

func (r *employmentRepository) GetByApplicationID(applicationID uuid.UUID) (*models.EmploymentRecord, error) {
	var rec models.EmploymentRecord
	err := r.db.First(&rec, "application_id = ?", applicationID).Error
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *employmentRepository) GetByEmployerID(employerID uuid.UUID) ([]models.EmploymentRecord, error) {
	var recs []models.EmploymentRecord
	err := r.db.Where("employer_id = ?", employerID).Order("started_at desc").Find(&recs).Error
	return recs, err
}

func (r *employmentRepository) GetAll() ([]models.EmploymentRecord, error) {
	var recs []models.EmploymentRecord
	err := r.db.Order("started_at desc").Find(&recs).Error
	return recs, err
}

func (r *employmentRepository) GetAllByUniversity(studentIDs []uuid.UUID) ([]models.EmploymentRecord, error) {
	var recs []models.EmploymentRecord
	err := r.db.Where("student_id IN ?", studentIDs).Order("started_at desc").Find(&recs).Error
	return recs, err
}

func (r *employmentRepository) GetByUniversityID(universityID uuid.UUID) ([]models.EmploymentRecord, error) {
	var recs []models.EmploymentRecord
	err := r.db.Where("university_id = ?", universityID).Order("started_at desc").Find(&recs).Error
	return recs, err
}

func (r *employmentRepository) UpdateStatus(id uuid.UUID, status string) error {
	return r.db.Model(&models.EmploymentRecord{}).Where("id = ?", id).Update("status", status).Error
}

func (r *employmentRepository) End(id uuid.UUID) error {
	now := time.Now()
	return r.db.Model(&models.EmploymentRecord{}).Where("id = ?", id).Updates(map[string]interface{}{
		"ended_at": now,
		"status":   "terminated_early",
	}).Error
}

func (r *employmentRepository) EndByApplicationID(applicationID uuid.UUID) error {
	now := time.Now()
	return r.db.Model(&models.EmploymentRecord{}).
		Where("application_id = ? AND status = 'active'", applicationID).
		Updates(map[string]interface{}{
			"ended_at": now,
			"status":   "terminated_early",
		}).Error
}
