package service

import (
	"employer-service/internal/models"
	"employer-service/internal/repository"

	"github.com/google/uuid"
)

type EmployerProfileService interface {
	GetProfile(employerID uuid.UUID) (*models.EmployerProfile, error)
	CreateProfile(profile *models.EmployerProfile) (*models.EmployerProfile, error)
	UpdateProfile(employerID uuid.UUID, updates *models.EmployerProfile) (*models.EmployerProfile, error)
}

type employerProfileService struct {
	repo repository.EmployerProfileRepository
}

func NewEmployerProfileService(repo repository.EmployerProfileRepository) EmployerProfileService {
	return &employerProfileService{repo: repo}
}

func (s *employerProfileService) GetProfile(employerID uuid.UUID) (*models.EmployerProfile, error) {
	return s.repo.GetByEmployerID(employerID)
}

func (s *employerProfileService) CreateProfile(profile *models.EmployerProfile) (*models.EmployerProfile, error) {
	if err := s.repo.Create(profile); err != nil {
		return nil, err
	}
	return profile, nil
}

func (s *employerProfileService) UpdateProfile(employerID uuid.UUID, updates *models.EmployerProfile) (*models.EmployerProfile, error) {
	profile, err := s.repo.GetByEmployerID(employerID)
	if err != nil {
		return nil, err
	}

	if updates.CompanyName != "" {
		profile.CompanyName = updates.CompanyName
	}
	if updates.CompanyDescription != "" {
		profile.CompanyDescription = updates.CompanyDescription
	}
	if updates.Industry != "" {
		profile.Industry = updates.Industry
	}
	if updates.CompanySize != "" {
		profile.CompanySize = updates.CompanySize
	}
	if updates.Website != "" {
		profile.Website = updates.Website
	}
	if updates.Location != "" {
		profile.Location = updates.Location
	}
	if updates.ContactEmail != "" {
		profile.ContactEmail = updates.ContactEmail
	}
	if updates.ContactPhone != "" {
		profile.ContactPhone = updates.ContactPhone
	}

	if err := s.repo.Update(profile); err != nil {
		return nil, err
	}
	return profile, nil
}
