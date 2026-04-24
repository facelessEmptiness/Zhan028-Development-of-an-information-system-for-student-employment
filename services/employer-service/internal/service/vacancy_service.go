package service

import (
	"errors"
	"employer-service/internal/dto"
	"employer-service/internal/models"
	"employer-service/internal/repository"

	"github.com/google/uuid"
)

var ErrAccessDenied = errors.New("доступ запрещён")

type SearchParams struct {
	Search   string
	JobType  string
	Location string
	Page     int
	PageSize int
}

type VacancyService interface {
	CreateVacancy(employerID uuid.UUID, req *dto.CreateVacancyRequest) (*models.Vacancy, error)
	GetAllVacancies(params SearchParams) ([]models.Vacancy, int64, error)
	GetVacancyByID(id uuid.UUID) (*models.Vacancy, error)
	GetMyVacancies(employerID uuid.UUID) ([]models.Vacancy, error)
	UpdateVacancy(id uuid.UUID, employerID uuid.UUID, req *dto.UpdateVacancyRequest) (*models.Vacancy, error)
	DeleteVacancy(id uuid.UUID, employerID uuid.UUID) error
}

type vacancyService struct {
	repo repository.VacancyRepository
}

func NewVacancyService(repo repository.VacancyRepository) VacancyService {
	return &vacancyService{repo: repo}
}

func (s *vacancyService) CreateVacancy(employerID uuid.UUID, req *dto.CreateVacancyRequest) (*models.Vacancy, error) {
	vacancy := &models.Vacancy{
		EmployerID:  employerID,
		Title:       req.Title,
		Description: req.Description,
		Location:    req.Location,
		SalaryMin:   req.SalaryMin,
		SalaryMax:   req.SalaryMax,
		JobType:     req.JobType,
		Skills:      req.Skills,
		Status:      "active",
	}

	if err := s.repo.Create(vacancy); err != nil {
		return nil, err
	}
	return vacancy, nil
}

func (s *vacancyService) GetAllVacancies(params SearchParams) ([]models.Vacancy, int64, error) {
	return s.repo.Search(repository.SearchParams{
		Search:   params.Search,
		JobType:  params.JobType,
		Location: params.Location,
		Page:     params.Page,
		PageSize: params.PageSize,
	})
}

func (s *vacancyService) GetVacancyByID(id uuid.UUID) (*models.Vacancy, error) {
	return s.repo.GetByID(id)
}

func (s *vacancyService) GetMyVacancies(employerID uuid.UUID) ([]models.Vacancy, error) {
	return s.repo.GetByEmployerID(employerID)
}

func (s *vacancyService) UpdateVacancy(id uuid.UUID, employerID uuid.UUID, req *dto.UpdateVacancyRequest) (*models.Vacancy, error) {
	vacancy, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}

	if vacancy.EmployerID != employerID {
		return nil, ErrAccessDenied
	}

	if req.Title != "" {
		vacancy.Title = req.Title
	}
	if req.Description != "" {
		vacancy.Description = req.Description
	}
	if req.Location != "" {
		vacancy.Location = req.Location
	}
	if req.SalaryMin > 0 {
		vacancy.SalaryMin = req.SalaryMin
	}
	if req.SalaryMax > 0 {
		vacancy.SalaryMax = req.SalaryMax
	}
	if req.JobType != "" {
		vacancy.JobType = req.JobType
	}
	if req.Skills != "" {
		vacancy.Skills = req.Skills
	}
	if req.Status != "" {
		vacancy.Status = req.Status
	}

	if err := s.repo.Update(vacancy); err != nil {
		return nil, err
	}
	return vacancy, nil
}

func (s *vacancyService) DeleteVacancy(id uuid.UUID, employerID uuid.UUID) error {
	vacancy, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}

	if vacancy.EmployerID != employerID {
		return ErrAccessDenied
	}

	return s.repo.Delete(id)
}
