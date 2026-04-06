package models

import (
	"time"

	"github.com/google/uuid"
)

const (
	BINStatusPending  = "pending"
	BINStatusVerified = "verified"
	BINStatusRejected = "rejected"
)

type EmployerProfile struct {
	EmployerID         uuid.UUID `gorm:"type:uuid;primary_key" json:"employer_id"`
	CompanyName        string    `gorm:"not null" json:"company_name"`
	CompanyDescription string    `json:"company_description"`
	Industry           string    `json:"industry"`
	CompanySize        string    `json:"company_size"`
	Website            string    `json:"website"`
	Location           string    `json:"location"`
	ContactEmail       string    `json:"contact_email"`
	ContactPhone       string    `json:"contact_phone"`
	BIN                string    `gorm:"type:varchar(12);unique" json:"bin"`
	BINStatus          string    `gorm:"type:varchar(20);default:'pending'" json:"bin_status"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}
