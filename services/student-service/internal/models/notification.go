package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	NotifTypeApplicationSubmitted = "application_submitted"
	NotifTypeApplicationStatus    = "application_status"
	NotifTypeDocumentVerified     = "document_verified"
	NotifTypeDocumentRejected     = "document_rejected"
)

type Notification struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	Type      string    `gorm:"type:varchar(50);not null" json:"type"`
	Title     string    `gorm:"type:varchar(255);not null" json:"title"`
	Body      string    `gorm:"type:text" json:"body"`
	RelatedID string    `gorm:"type:varchar(255)" json:"related_id,omitempty"`
	IsRead    bool      `gorm:"default:false" json:"is_read"`
	CreatedAt time.Time `json:"created_at"`
}

func (n *Notification) BeforeCreate(tx *gorm.DB) error {
	if n.ID == uuid.Nil {
		n.ID = uuid.New()
	}
	return nil
}
