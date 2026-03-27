package dto

import "auth-service/internal/models"

// RegisterRequest представляет запрос на регистрацию нового пользователя
type RegisterRequest struct {
	Email        string          `json:"email" binding:"required,email" example:"user@example.com"`
	Password     string          `json:"password" binding:"required,min=8" example:"password123"`
	Role         models.UserRole `json:"role" binding:"required,oneof=student employer university admin" example:"student"`
	UniversityID string          `json:"university_id,omitempty" example:"550e8400-e29b-41d4-a716-446655440000"`
}

// LoginRequest представляет запрос на аутентификацию
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email" example:"user@example.com"`
	Password string `json:"password" binding:"required" example:"password123"`
}

// RefreshRequest представляет запрос на обновление токена
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required" example:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`
}

// VerifyEmailRequest представляет запрос на подтверждение email
type VerifyEmailRequest struct {
	Email string `json:"email" binding:"required,email" example:"user@example.com"`
	Code  string `json:"code" binding:"required,len=6" example:"123456"`
}

// ResendVerificationRequest представляет запрос на повторную отправку кода
type ResendVerificationRequest struct {
	Email string `json:"email" binding:"required,email" example:"user@example.com"`
}

// ForgotPasswordRequest представляет запрос на сброс пароля
type ForgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email" example:"user@example.com"`
}

// ResetPasswordRequest представляет запрос на установку нового пароля
type ResetPasswordRequest struct {
	Email       string `json:"email" binding:"required,email" example:"user@example.com"`
	Code        string `json:"code" binding:"required,len=6" example:"123456"`
	NewPassword string `json:"new_password" binding:"required,min=8" example:"newpassword123"`
}
