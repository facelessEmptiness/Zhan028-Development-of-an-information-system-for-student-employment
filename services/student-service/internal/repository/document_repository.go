package repository

import (
	"errors"
	"time"
	"student-service/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var ErrDocumentNotFound = errors.New("document not found")

type DocumentRepository interface {
	Create(doc *models.Document) error
	FindByID(id uuid.UUID) (*models.Document, error)
	FindByIDWithData(id uuid.UUID) (*models.Document, error)
	FindByUserID(userID uuid.UUID) ([]*models.Document, error)
	Update(doc *models.Document) error
	Delete(id uuid.UUID) error
	VerifyAllPendingByUserID(userID uuid.UUID, verifierID uuid.UUID) ([]*models.Document, error)
}

type documentRepository struct {
	db *gorm.DB
}

func NewDocumentRepository(db *gorm.DB) DocumentRepository {
	return &documentRepository{db: db}
}

func (r *documentRepository) Create(doc *models.Document) error {
	return r.db.Create(doc).Error
}

func (r *documentRepository) FindByID(id uuid.UUID) (*models.Document, error) {
	var doc models.Document
	err := r.db.Omit("file_data").Where("id = ?", id).First(&doc).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrDocumentNotFound
	}
	return &doc, err
}

func (r *documentRepository) FindByIDWithData(id uuid.UUID) (*models.Document, error) {
	var doc models.Document
	err := r.db.Where("id = ?", id).First(&doc).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrDocumentNotFound
	}
	return &doc, err
}

func (r *documentRepository) FindByUserID(userID uuid.UUID) ([]*models.Document, error) {
	var docs []*models.Document
	err := r.db.Omit("file_data").Where("user_id = ?", userID).Order("created_at desc").Find(&docs).Error
	return docs, err
}

func (r *documentRepository) Update(doc *models.Document) error {
	return r.db.Omit("file_data").Save(doc).Error
}

func (r *documentRepository) Delete(id uuid.UUID) error {
	result := r.db.Delete(&models.Document{}, "id = ?", id)
	if result.RowsAffected == 0 {
		return ErrDocumentNotFound
	}
	return result.Error
}

// VerifyAllPendingByUserID verifies all pending non-CV documents for a student
// and returns the updated documents.
func (r *documentRepository) VerifyAllPendingByUserID(userID uuid.UUID, verifierID uuid.UUID) ([]*models.Document, error) {
	now := time.Now()

	// Find all pending non-CV documents for this user
	var docs []*models.Document
	if err := r.db.Omit("file_data").
		Where("user_id = ? AND status = ? AND type != ?", userID, models.DocStatusPending, models.DocTypeCV).
		Find(&docs).Error; err != nil {
		return nil, err
	}

	if len(docs) == 0 {
		return docs, nil
	}

	// Bulk update status
	if err := r.db.Model(&models.Document{}).
		Where("user_id = ? AND status = ? AND type != ?", userID, models.DocStatusPending, models.DocTypeCV).
		Updates(map[string]interface{}{
			"status":      models.DocStatusVerified,
			"verified_by": verifierID,
			"verified_at": now,
		}).Error; err != nil {
		return nil, err
	}

	// Return updated docs
	for _, d := range docs {
		d.Status = models.DocStatusVerified
		d.VerifiedBy = &verifierID
		d.VerifiedAt = &now
	}
	return docs, nil
}
