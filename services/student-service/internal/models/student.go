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
	Skills           string     `gorm:"type:text" json:"skills"`
	GPA              float64    `gorm:"default:0" json:"gpa"`
	Specialization   string     `gorm:"type:varchar(200)" json:"specialization"`
	GraduationYear   int        `gorm:"default:0" json:"graduation_year"`
	Bio              string     `gorm:"type:text" json:"bio"`
	Phone            string     `gorm:"type:varchar(50)" json:"phone"`
	LocationCity     string     `gorm:"type:varchar(200)" json:"location_city"`
	DiplomaVerified  bool       `gorm:"default:false" json:"diploma_verified"`
	DiplomaVerifiedAt *time.Time `gorm:"" json:"diploma_verified_at,omitempty"`
	CreatedAt        time.Time
	UpdatedAt        time.Time
}
