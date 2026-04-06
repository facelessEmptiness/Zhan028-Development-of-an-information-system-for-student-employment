package service

import (
	"employer-service/internal/models"
	"employer-service/internal/repository"
	"errors"
	"unicode"

	"github.com/google/uuid"
)

var (
	ErrBINInvalidFormat = errors.New("БИН должен содержать ровно 12 цифр")
	ErrBINInvalidValue  = errors.New("БИН не прошёл проверку контрольной суммы")
	ErrBINTaken         = errors.New("БИН уже зарегистрирован другим работодателем")
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

// validateBIN проверяет формат и контрольную сумму казахстанского БИН.
// БИН — 12 цифр. Контрольная сумма аналогична алгоритму ИИН.
func validateBIN(bin string) error {
	if len(bin) != 12 {
		return ErrBINInvalidFormat
	}
	digits := make([]int, 12)
	for i, ch := range bin {
		if !unicode.IsDigit(ch) {
			return ErrBINInvalidFormat
		}
		digits[i] = int(ch - '0')
	}

	weights1 := []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11}
	sum := 0
	for i := 0; i < 11; i++ {
		sum += digits[i] * weights1[i]
	}
	check := sum % 11
	if check == 10 {
		weights2 := []int{3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2}
		sum = 0
		for i := 0; i < 11; i++ {
			sum += digits[i] * weights2[i]
		}
		check = sum % 11
	}
	if check == 10 {
		return ErrBINInvalidValue
	}
	if check != digits[11] {
		return ErrBINInvalidValue
	}
	return nil
}

func (s *employerProfileService) GetProfile(employerID uuid.UUID) (*models.EmployerProfile, error) {
	return s.repo.GetByEmployerID(employerID)
}

func (s *employerProfileService) CreateProfile(profile *models.EmployerProfile) (*models.EmployerProfile, error) {
	if profile.BIN != "" {
		if err := validateBIN(profile.BIN); err != nil {
			return nil, err
		}
		taken, err := s.repo.ExistsByBIN(profile.BIN, uuid.Nil)
		if err != nil {
			return nil, err
		}
		if taken {
			return nil, ErrBINTaken
		}
		profile.BINStatus = models.BINStatusVerified
	} else {
		profile.BINStatus = models.BINStatusPending
	}

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

	if updates.BIN != "" && updates.BIN != profile.BIN {
		if err := validateBIN(updates.BIN); err != nil {
			return nil, err
		}
		taken, err := s.repo.ExistsByBIN(updates.BIN, employerID)
		if err != nil {
			return nil, err
		}
		if taken {
			return nil, ErrBINTaken
		}
		profile.BIN = updates.BIN
		profile.BINStatus = models.BINStatusVerified
	}

	if err := s.repo.Update(profile); err != nil {
		return nil, err
	}
	return profile, nil
}
