package models

import (
	"time"

	"github.com/google/uuid"
)

type PushToken struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID    uuid.UUID `gorm:"type:uuid;uniqueIndex;not null"`
	Token     string    `gorm:"not null"`
	Platform  string    `gorm:"default:'ios'"`
	CreatedAt time.Time
	UpdatedAt time.Time
}
