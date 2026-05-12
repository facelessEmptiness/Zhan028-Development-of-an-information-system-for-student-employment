package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type EmploymentRecord struct {
	ID            uuid.UUID  `gorm:"type:uuid;primary_key" json:"id"`
	StudentID     uuid.UUID  `gorm:"type:uuid;not null;index" json:"student_id"`
	EmployerID    uuid.UUID  `gorm:"type:uuid;not null;index" json:"employer_id"`
	ApplicationID uuid.UUID  `gorm:"type:uuid;not null;uniqueIndex" json:"application_id"`
	VacancyID     uuid.UUID  `gorm:"type:uuid;not null" json:"vacancy_id"`
	UniversityID  *uuid.UUID `gorm:"type:uuid;index" json:"university_id,omitempty"`
	CompanyName   string     `gorm:"type:varchar(255)" json:"company_name"`
	JobTitle      string     `gorm:"type:varchar(255)" json:"job_title"`
	StartedAt     time.Time  `gorm:"not null" json:"started_at"`
	EndedAt       *time.Time `json:"ended_at,omitempty"`
	// Status: active, completed (3+ years), terminated_early
	Status    string    `gorm:"type:varchar(50);not null;default:'active'" json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (e *EmploymentRecord) BeforeCreate(_ *gorm.DB) error {
	if e.ID == uuid.Nil {
		e.ID = uuid.New()
	}
	return nil
}

// GrantYears — required employment duration for grant obligation
const GrantYears = 3
