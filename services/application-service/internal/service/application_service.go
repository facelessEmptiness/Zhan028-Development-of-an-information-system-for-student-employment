package service

import (
	"errors"
	"application-service/internal/models"
	"application-service/internal/repository"

	"github.com/google/uuid"
)

var (
	ErrAlreadyApplied       = errors.New("вы уже подали заявку на эту вакансию")
	ErrApplicationNotFound  = errors.New("заявка не найдена")
	ErrForbidden            = errors.New("доступ запрещён")
)

type ApplicationService interface {
	Apply(studentID, vacancyID, employerID uuid.UUID, coverLetter string, matchScore int32) (*models.Application, error)
	GetMyApplications(studentID uuid.UUID) ([]models.Application, error)
	GetVacancyApplications(vacancyID uuid.UUID) ([]models.Application, error)
	UpdateStatus(id, employerID uuid.UUID, status string) (*models.Application, error)
	Withdraw(id, studentID uuid.UUID) error
}

type applicationService struct {
	repo repository.ApplicationRepository
}

func NewApplicationService(repo repository.ApplicationRepository) ApplicationService {
	return &applicationService{repo: repo}
}

func (s *applicationService) Apply(studentID, vacancyID, employerID uuid.UUID, coverLetter string, matchScore int32) (*models.Application, error) {
	exists, err := s.repo.ExistsByStudentAndVacancy(studentID, vacancyID)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrAlreadyApplied
	}

	app := &models.Application{
		StudentID:   studentID,
		VacancyID:   vacancyID,
		EmployerID:  employerID,
		CoverLetter: coverLetter,
		Status:      "applied",
		MatchScore:  matchScore,
	}

	if err := s.repo.Create(app); err != nil {
		return nil, err
	}
	return app, nil
}

func (s *applicationService) GetMyApplications(studentID uuid.UUID) ([]models.Application, error) {
	return s.repo.GetByStudentID(studentID)
}

func (s *applicationService) GetVacancyApplications(vacancyID uuid.UUID) ([]models.Application, error) {
	return s.repo.GetByVacancyID(vacancyID)
}

func (s *applicationService) UpdateStatus(id, employerID uuid.UUID, status string) (*models.Application, error) {
	app, err := s.repo.GetByID(id)
	if err != nil {
		return nil, ErrApplicationNotFound
	}

	if err := s.repo.UpdateStatus(id, status); err != nil {
		return nil, err
	}

	app.Status = status
	return app, nil
}

func (s *applicationService) Withdraw(id, studentID uuid.UUID) error {
	app, err := s.repo.GetByID(id)
	if err != nil {
		return ErrApplicationNotFound
	}

	if app.StudentID != studentID {
		return ErrForbidden
	}

	return s.repo.Delete(id)
}
