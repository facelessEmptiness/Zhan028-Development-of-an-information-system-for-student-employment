package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type University struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key" json:"id"`
	Name      string    `gorm:"type:varchar(255);not null;unique" json:"name"`
	City      string    `gorm:"type:varchar(100)" json:"city"`
	Country   string    `gorm:"type:varchar(100)" json:"country"`
	Website   string    `gorm:"type:varchar(255)" json:"website"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (u *University) BeforeCreate(_ *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}
