package dto

import (
	"auth-service/internal/models"
	"time"

	"github.com/google/uuid"
)

// UserResponse представляет ответ с данными пользователя
type UserResponse struct {
	ID              uuid.UUID       `json:"id" example:"550e8400-e29b-41d4-a716-446655440000"`
	Email           string          `json:"email" example:"user@example.com"`
	Role            models.UserRole `json:"role" example:"student"`
	UniversityID    string          `json:"university_id,omitempty"`
	IsActive        bool            `json:"is_active" example:"true"`
	IsEmailVerified bool            `json:"is_email_verified" example:"true"`
	CreatedAt       time.Time       `json:"created_at" example:"2024-01-15T10:30:00Z"`
	UpdatedAt       time.Time       `json:"updated_at" example:"2024-01-15T10:30:00Z"`
}

// TokenResponse представляет ответ с JWT токенами
type TokenResponse struct {
	AccessToken  string `json:"access_token" example:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`
	RefreshToken string `json:"refresh_token" example:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`
	TokenType    string `json:"token_type" example:"Bearer"`
	ExpiresIn    int64  `json:"expires_in" example:"86400"`
}

// AuthResponse представляет полный ответ после аутентификации
type AuthResponse struct {
	User   UserResponse  `json:"user"`
	Tokens TokenResponse `json:"tokens"`
}

// ErrorResponse представляет ответ с ошибкой
type ErrorResponse struct {
	Error   string            `json:"error" example:"Ошибка валидации"`
	Message string            `json:"message" example:"Email уже используется"`
	Details map[string]string `json:"details,omitempty"`
}

// SuccessResponse представляет успешный ответ без данных
type SuccessResponse struct {
	Message string `json:"message" example:"Операция выполнена успешно"`
}

// MessageResponse представляет ответ с сообщением и email
type MessageResponse struct {
	Message string `json:"message"`
	Email   string `json:"email,omitempty"`
}

// ToUserResponse преобразует модель User в UserResponse
func ToUserResponse(user *models.User) UserResponse {
	uniIDStr := ""
	if user.UniversityID != nil {
		uniIDStr = user.UniversityID.String()
	}
	return UserResponse{
		ID:              user.ID,
		Email:           user.Email,
		Role:            user.Role,
		UniversityID:    uniIDStr,
		IsActive:        user.IsActive,
		IsEmailVerified: user.IsEmailVerified,
		CreatedAt:       user.CreatedAt,
		UpdatedAt:       user.UpdatedAt,
	}
}
