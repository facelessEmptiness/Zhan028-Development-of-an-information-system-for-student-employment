package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// UserRole определяет допустимые роли пользователей в системе
type UserRole string

const (
	RoleStudent    UserRole = "student"    // Студент
	RoleEmployer   UserRole = "employer"   // Работодатель
	RoleUniversity UserRole = "university" // Представитель университета
	RoleAdmin      UserRole = "admin"      // Администратор системы
)

// IsValid проверяет, является ли роль допустимой
func (r UserRole) IsValid() bool {
	switch r {
	case RoleStudent, RoleEmployer, RoleUniversity, RoleAdmin:
		return true
	}
	return false
}

// User представляет модель пользователя в системе
type User struct {
	ID           uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Email        string     `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	PasswordHash string     `gorm:"type:varchar(255);not null" json:"-"` // json:"-" скрывает поле при сериализации
	Role         UserRole   `gorm:"type:user_role;not null;default:'student'" json:"role"`
	UniversityID *uuid.UUID `gorm:"type:uuid;default:null" json:"university_id,omitempty"`
	IsActive        bool       `gorm:"default:true" json:"is_active"`
	IsEmailVerified bool       `gorm:"default:false" json:"is_email_verified"`
	CreatedAt       time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt       time.Time  `gorm:"autoUpdateTime" json:"updated_at"`
}

// TableName возвращает имя таблицы для модели User
func (User) TableName() string {
	return "users"
}

// BeforeCreate выполняется перед созданием записи
func (u *User) BeforeCreate(tx *gorm.DB) error {
	// Генерация UUID если не задан
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}
