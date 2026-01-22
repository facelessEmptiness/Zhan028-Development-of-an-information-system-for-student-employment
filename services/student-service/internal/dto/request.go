package dto

// CreateProfileRequest - запрос на создание профиля студента
type CreateProfileRequest struct {
	FirstName    string `json:"first_name" binding:"required"`
	LastName     string `json:"last_name" binding:"required"`
	IIN          string `json:"iin" binding:"required,len=12"`
	UniversityID string `json:"university_id,omitempty"`
}

// UpdateProfileRequest - запрос на обновление профиля
type UpdateProfileRequest struct {
	FirstName    string `json:"first_name,omitempty"`
	LastName     string `json:"last_name,omitempty"`
	UniversityID string `json:"university_id,omitempty"`
}
