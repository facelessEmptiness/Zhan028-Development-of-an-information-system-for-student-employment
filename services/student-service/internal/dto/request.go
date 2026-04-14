package dto

// CreateProfileRequest - запрос на создание профиля студента
type CreateProfileRequest struct {
	FirstName      string  `json:"first_name" binding:"required"`
	LastName       string  `json:"last_name" binding:"required"`
	IIN            string  `json:"iin" binding:"required,len=12"`
	UniversityID   string  `json:"university_id,omitempty"`
	Skills         string  `json:"skills,omitempty"`
	GPA            float64 `json:"gpa,omitempty"`
	Specialization string  `json:"specialization,omitempty"`
	GraduationYear int     `json:"graduation_year,omitempty"`
	Bio            string  `json:"bio,omitempty"`
	Phone          string  `json:"phone,omitempty"`
	LocationCity   string  `json:"location_city,omitempty"`
	GithubUrl      string  `json:"github_url,omitempty"`
}

// UpdateProfileRequest - запрос на обновление профиля
type UpdateProfileRequest struct {
	FirstName      string  `json:"first_name,omitempty"`
	LastName       string  `json:"last_name,omitempty"`
	UniversityID   string  `json:"university_id,omitempty"`
	Skills         string  `json:"skills,omitempty"`
	GPA            float64 `json:"gpa,omitempty"`
	Specialization string  `json:"specialization,omitempty"`
	GraduationYear int     `json:"graduation_year,omitempty"`
	Bio            string  `json:"bio,omitempty"`
	Phone          string  `json:"phone,omitempty"`
	LocationCity   string  `json:"location_city,omitempty"`
	GithubUrl      string  `json:"github_url,omitempty"`
}
