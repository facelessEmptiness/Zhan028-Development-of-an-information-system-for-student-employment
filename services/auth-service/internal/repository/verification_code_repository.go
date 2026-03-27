package repository

import (
	"auth-service/internal/models"
	"errors"
	"time"

	"gorm.io/gorm"
)

// Ошибки репозитория кодов подтверждения
var (
	ErrCodeNotFound = errors.New("код подтверждения не найден или уже использован")
	ErrCodeExpired  = errors.New("срок действия кода истёк")
)

// VerificationCodeRepository интерфейс для работы с кодами подтверждения
type VerificationCodeRepository interface {
	Create(code *models.VerificationCode) error
	FindValidCode(email string, code string, codeType models.CodeType) (*models.VerificationCode, error)
	MarkAsUsed(id interface{}) error
	DeleteExpired() error
	InvalidateAll(email string, codeType models.CodeType) error
}

// verificationCodeRepository реализует VerificationCodeRepository
type verificationCodeRepository struct {
	db *gorm.DB
}

// NewVerificationCodeRepository создаёт новый экземпляр репозитория
func NewVerificationCodeRepository(db *gorm.DB) VerificationCodeRepository {
	return &verificationCodeRepository{db: db}
}

// Create создаёт новый код подтверждения
func (r *verificationCodeRepository) Create(code *models.VerificationCode) error {
	return r.db.Create(code).Error
}

// FindValidCode ищет действительный (не использованный, не просроченный) код
func (r *verificationCodeRepository) FindValidCode(email string, code string, codeType models.CodeType) (*models.VerificationCode, error) {
	var vc models.VerificationCode
	err := r.db.Where(
		"email = ? AND code = ? AND type = ? AND is_used = false AND expires_at > ?",
		email, code, codeType, time.Now(),
	).First(&vc).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrCodeNotFound
		}
		return nil, err
	}
	return &vc, nil
}

// MarkAsUsed помечает код как использованный
func (r *verificationCodeRepository) MarkAsUsed(id interface{}) error {
	return r.db.Model(&models.VerificationCode{}).Where("id = ?", id).Update("is_used", true).Error
}

// DeleteExpired удаляет просроченные коды
func (r *verificationCodeRepository) DeleteExpired() error {
	return r.db.Where("expires_at < ?", time.Now()).Delete(&models.VerificationCode{}).Error
}

// InvalidateAll инвалидирует все активные коды для email и типа
func (r *verificationCodeRepository) InvalidateAll(email string, codeType models.CodeType) error {
	return r.db.Model(&models.VerificationCode{}).
		Where("email = ? AND type = ? AND is_used = false", email, codeType).
		Update("is_used", true).Error
}
