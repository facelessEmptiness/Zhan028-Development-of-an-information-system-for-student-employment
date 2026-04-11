package repository

import (
	"application-service/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type InterviewRepository interface {
	Create(interview *models.Interview) error
	GetByID(id uuid.UUID) (*models.Interview, error)
	GetByApplicationID(applicationID uuid.UUID) (*models.Interview, error)
	GetByEmployerID(employerID uuid.UUID) ([]models.Interview, error)
	GetByStudentID(studentID uuid.UUID) ([]models.Interview, error)
	UpdateStatus(id uuid.UUID, status string) error
	Delete(id uuid.UUID) error
}

type interviewRepository struct {
	db *gorm.DB
}

func NewInterviewRepository(db *gorm.DB) InterviewRepository {
	return &interviewRepository{db: db}
}

func (r *interviewRepository) Create(interview *models.Interview) error {
	return r.db.Create(interview).Error
}

func (r *interviewRepository) GetByID(id uuid.UUID) (*models.Interview, error) {
	var interview models.Interview
	err := r.db.First(&interview, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &interview, nil
}

func (r *interviewRepository) GetByApplicationID(applicationID uuid.UUID) (*models.Interview, error) {
	var interview models.Interview
	err := r.db.Where("application_id = ? AND status != 'cancelled'", applicationID).
		Order("created_at desc").First(&interview).Error
	if err != nil {
		return nil, err
	}
	return &interview, nil
}

func (r *interviewRepository) GetByEmployerID(employerID uuid.UUID) ([]models.Interview, error) {
	var interviews []models.Interview
	err := r.db.Where("employer_id = ?", employerID).
		Order("scheduled_at asc").Find(&interviews).Error
	return interviews, err
}

func (r *interviewRepository) GetByStudentID(studentID uuid.UUID) ([]models.Interview, error) {
	var interviews []models.Interview
	err := r.db.Where("student_id = ?", studentID).
		Order("scheduled_at asc").Find(&interviews).Error
	return interviews, err
}

func (r *interviewRepository) UpdateStatus(id uuid.UUID, status string) error {
	return r.db.Model(&models.Interview{}).Where("id = ?", id).Update("status", status).Error
}

func (r *interviewRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Interview{}, "id = ?", id).Error
}
