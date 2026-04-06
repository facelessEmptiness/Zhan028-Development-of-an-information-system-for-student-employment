package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	DocStatusPending  = "pending"
	DocStatusVerified = "verified"
	DocStatusRejected = "rejected"

	DocTypeCV          = "cv"
	DocTypeCertificate = "certificate"
)

type Document struct {
	ID         uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	UserID     uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	Type       string     `gorm:"type:varchar(50);not null" json:"type"`
	FileName   string     `gorm:"type:varchar(255);not null" json:"file_name"`
	FileSize   int64      `gorm:"not null" json:"file_size"`
	MimeType   string     `gorm:"type:varchar(100)" json:"mime_type"`
	FileData   []byte     `gorm:"type:bytea;not null" json:"-"`
	Status     string     `gorm:"type:varchar(20);default:'pending'" json:"status"`
	VerifiedBy *uuid.UUID `gorm:"type:uuid" json:"verified_by,omitempty"`
	VerifiedAt *time.Time `json:"verified_at,omitempty"`
	Comment    string     `gorm:"type:text" json:"comment,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

func (d *Document) BeforeCreate(tx *gorm.DB) error {
	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
	return nil
}
