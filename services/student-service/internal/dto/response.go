package dto

import "time"

// StudentResponse - ответ с данными студента
type StudentResponse struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	FirstName    string    `json:"first_name"`
	LastName     string    `json:"last_name"`
	IIN          string    `json:"iin"`
	UniversityID string    `json:"university_id,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// ErrorResponse - ответ с ошибкой
type ErrorResponse struct {
	Error string `json:"error"`
}

// SuccessResponse - успешный ответ
type SuccessResponse struct {
	Message string `json:"message"`
}
