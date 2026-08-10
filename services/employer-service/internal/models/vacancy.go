package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"
)

type Vacancy struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key" json:"id"`
	EmployerID  uuid.UUID      `gorm:"type:uuid;not null;index" json:"employer_id"`
	Title       string         `gorm:"not null" json:"title"`
	Description string         `gorm:"not null" json:"description"`
	Location    string         `json:"location"`
	SalaryMin   int            `json:"salary_min"`
	SalaryMax   int            `json:"salary_max"`
	JobType     string         `gorm:"not null;default:'Full-time'" json:"job_type"`
	Skills      pq.StringArray `gorm:"type:text[]" json:"skills"`
	Status      string         `gorm:"not null;default:'active'" json:"status"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

func (v *Vacancy) BeforeCreate(_ *gorm.DB) error {
	if v.ID == uuid.Nil {
		v.ID = uuid.New()
	}
	return nil
}
