package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// CodeType тип кода подтверждения
type CodeType string

const (
	CodeTypeEmailVerification CodeType = "email_verification"
	CodeTypePasswordReset     CodeType = "password_reset"
)

// VerificationCode хранит коды подтверждения для email и сброса пароля
type VerificationCode struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Email     string    `gorm:"type:varchar(255);not null;index" json:"email"`
	Code      string    `gorm:"type:varchar(10);not null" json:"-"`
	Type      CodeType  `gorm:"type:varchar(50);not null" json:"type"`
	ExpiresAt time.Time `gorm:"not null" json:"expires_at"`
	IsUsed    bool      `gorm:"default:false" json:"is_used"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
}

// TableName возвращает имя таблицы
func (VerificationCode) TableName() string {
	return "verification_codes"
}

// BeforeCreate генерирует UUID перед созданием
func (v *VerificationCode) BeforeCreate(tx *gorm.DB) error {
	if v.ID == uuid.Nil {
		v.ID = uuid.New()
	}
	return nil
}

// IsExpired проверяет истёк ли срок действия кода
func (v *VerificationCode) IsExpired() bool {
	return time.Now().After(v.ExpiresAt)
}
