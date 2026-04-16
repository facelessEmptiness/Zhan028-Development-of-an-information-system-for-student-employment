package repository

import (
	"application-service/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ChatRepository interface {
	Save(msg *models.ChatMessage) error
	GetByApplicationID(applicationID uuid.UUID) ([]models.ChatMessage, error)
}

type chatRepository struct {
	db *gorm.DB
}

func NewChatRepository(db *gorm.DB) ChatRepository {
	return &chatRepository{db: db}
}

func (r *chatRepository) Save(msg *models.ChatMessage) error {
	return r.db.Create(msg).Error
}

func (r *chatRepository) GetByApplicationID(applicationID uuid.UUID) ([]models.ChatMessage, error) {
	var messages []models.ChatMessage
	err := r.db.Where("application_id = ?", applicationID).
		Order("created_at ASC").
		Find(&messages).Error
	return messages, err
}
