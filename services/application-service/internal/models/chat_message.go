package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ChatMessage struct {
	ID            uuid.UUID `gorm:"type:uuid;primary_key" json:"id"`
	ApplicationID uuid.UUID `gorm:"type:uuid;not null;index" json:"application_id"`
	SenderID      uuid.UUID `gorm:"type:uuid;not null" json:"sender_id"`
	SenderRole    string    `gorm:"type:varchar(20);not null" json:"sender_role"` // student | employer
	Content       string    `gorm:"type:text;not null" json:"content"`
	CreatedAt     time.Time `json:"created_at"`
}

func (m *ChatMessage) BeforeCreate(_ *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}
