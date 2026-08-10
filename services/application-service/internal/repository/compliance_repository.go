package repository

import (
	"errors"

	"application-service/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ErrComplianceNotFound is returned when no compliance record exists for the key.
var ErrComplianceNotFound = errors.New("запись о комплаенсе не найдена")

// terminalStates are the "good" end states excluded from nightly evaluation.
var terminalStates = []string{"Compliant", "Exempt"}

type ComplianceRepository interface {
	Create(rec *models.ComplianceRecord) error
	GetByID(id uuid.UUID) (*models.ComplianceRecord, error)
	GetByStudentID(studentID uuid.UUID) (*models.ComplianceRecord, error)
	ListByUniversityID(universityID uuid.UUID) ([]models.ComplianceRecord, error)
	// ListNonTerminal returns records that may still transition — the working
	// set for the nightly scheduler (everything except Compliant/Exempt).
	ListNonTerminal() ([]models.ComplianceRecord, error)
	// ListAll returns every compliance record across all universities — admin only.
	ListAll() ([]models.ComplianceRecord, error)
	Update(rec *models.ComplianceRecord) error
}

type complianceRepository struct {
	db *gorm.DB
}

func NewComplianceRepository(db *gorm.DB) ComplianceRepository {
	return &complianceRepository{db: db}
}

func (r *complianceRepository) Create(rec *models.ComplianceRecord) error {
	return r.db.Create(rec).Error
}

func (r *complianceRepository) GetByID(id uuid.UUID) (*models.ComplianceRecord, error) {
	var rec models.ComplianceRecord
	err := r.db.First(&rec, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrComplianceNotFound
	}
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *complianceRepository) GetByStudentID(studentID uuid.UUID) (*models.ComplianceRecord, error) {
	var rec models.ComplianceRecord
	err := r.db.First(&rec, "student_id = ?", studentID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrComplianceNotFound
	}
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *complianceRepository) ListByUniversityID(universityID uuid.UUID) ([]models.ComplianceRecord, error) {
	var recs []models.ComplianceRecord
	err := r.db.Where("university_id = ?", universityID).Order("updated_at desc").Find(&recs).Error
	return recs, err
}

func (r *complianceRepository) ListNonTerminal() ([]models.ComplianceRecord, error) {
	var recs []models.ComplianceRecord
	err := r.db.Where("state NOT IN ?", terminalStates).Find(&recs).Error
	return recs, err
}

func (r *complianceRepository) ListAll() ([]models.ComplianceRecord, error) {
	var recs []models.ComplianceRecord
	err := r.db.Order("university_id, updated_at desc").Find(&recs).Error
	return recs, err
}

func (r *complianceRepository) Update(rec *models.ComplianceRecord) error {
	return r.db.Save(rec).Error
}
