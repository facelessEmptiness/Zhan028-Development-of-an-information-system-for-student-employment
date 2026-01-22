package models

import (
	"time"

	"github.com/google/uuid"
)

type Student struct {
	ID           uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	UserID       uuid.UUID  `gorm:"type:uuid;unique;not null"`
	FirstName    string     `gorm:"type:varchar(100);not null"`
	LastName     string     `gorm:"type:varchar(100);not null"`
	IIN          string     `gorm:"type:varchar(12);unique;not null"`
	UniversityID *uuid.UUID `gorm:"type:uuid"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
}
