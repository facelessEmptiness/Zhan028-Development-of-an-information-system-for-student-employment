package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Interview struct {
	ID            uuid.UUID `gorm:"type:uuid;primary_key" json:"id"`
	ApplicationID uuid.UUID `gorm:"type:uuid;not null;index" json:"application_id"`
	StudentID     uuid.UUID `gorm:"type:uuid;not null;index" json:"student_id"`
	EmployerID    uuid.UUID `gorm:"type:uuid;not null;index" json:"employer_id"`
	VacancyID     uuid.UUID `gorm:"type:uuid;not null" json:"vacancy_id"`
	ScheduledAt   time.Time `gorm:"not null" json:"scheduled_at"`
	Location      string    `gorm:"type:varchar(500)" json:"location"`
	Notes         string    `gorm:"type:text" json:"notes"`
	Status        string    `gorm:"type:varchar(50);not null;default:'scheduled'" json:"status"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (i *Interview) BeforeCreate(_ *gorm.DB) error {
	if i.ID == uuid.Nil {
		i.ID = uuid.New()
	}
	return nil
}
