package dto

type CreateVacancyRequest struct {
	Title       string `json:"title" binding:"required"`
	Description string `json:"description" binding:"required"`
	Location    string `json:"location"`
	SalaryMin   int    `json:"salary_min"`
	SalaryMax   int    `json:"salary_max"`
	JobType     string `json:"job_type" binding:"required"`
	Skills      string `json:"skills"`
}

type UpdateVacancyRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Location    string `json:"location"`
	SalaryMin   int    `json:"salary_min"`
	SalaryMax   int    `json:"salary_max"`
	JobType     string `json:"job_type"`
	Skills      string `json:"skills"`
	Status      string `json:"status"`
}

type VacancyResponse struct {
	ID          string `json:"id"`
	EmployerID  string `json:"employer_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Location    string `json:"location"`
	SalaryMin   int    `json:"salary_min"`
	SalaryMax   int    `json:"salary_max"`
	JobType     string `json:"job_type"`
	Skills      string `json:"skills"`
	Status      string `json:"status"`
	CreatedAt   string `json:"created_at"`
}
