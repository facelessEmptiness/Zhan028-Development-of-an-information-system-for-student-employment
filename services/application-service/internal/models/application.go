package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Application struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key" json:"id"`
	StudentID   uuid.UUID `gorm:"type:uuid;not null;index;uniqueIndex:idx_student_vacancy" json:"student_id"`
	VacancyID   uuid.UUID `gorm:"type:uuid;not null;index;uniqueIndex:idx_student_vacancy" json:"vacancy_id"`
	Status      string    `gorm:"type:varchar(50);not null;default:'applied'" json:"status"`
	CoverLetter string    `gorm:"type:text" json:"cover_letter"`
	MatchScore  int32     `gorm:"default:0" json:"match_score"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (a *Application) BeforeCreate(_ *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}
