package service

import (
	"errors"
	"student-service/internal/dto"
	"student-service/internal/models"
	"student-service/internal/repository"

	"github.com/google/uuid"
)

var (
	ErrProfileAlreadyExists = errors.New("профиль студента уже существует")
	ErrProfileNotFound      = errors.New("профиль студента не найден")
	ErrIINAlreadyTaken      = errors.New("ИИН уже зарегистрирован")
)

type StudentService struct {
	repo repository.StudentRepository
	Repo repository.StudentRepository
}

func NewStudentService(repo repository.StudentRepository) *StudentService {
	return &StudentService{repo: repo, Repo: repo}
}

// CreateProfile создаёт профиль студента
func (s *StudentService) CreateProfile(userID uuid.UUID, req dto.CreateProfileRequest) (*models.Student, error) {
	// Проверяем что профиль ещё не существует
	exists, err := s.repo.ExistsByUserID(userID)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrProfileAlreadyExists
	}

	// Проверяем что ИИН не занят
	iinExists, err := s.repo.ExistsByIIN(req.IIN)
	if err != nil {
		return nil, err
	}
	if iinExists {
		return nil, ErrIINAlreadyTaken
	}

	// Создаём студента
	student := &models.Student{
		UserID:         userID,
		FirstName:      req.FirstName,
		LastName:       req.LastName,
		IIN:            req.IIN,
		Skills:         req.Skills,
		GPA:            req.GPA,
		Specialization: req.Specialization,
		GraduationYear: req.GraduationYear,
		Bio:            req.Bio,
		Phone:          req.Phone,
		LocationCity:   req.LocationCity,
	}

	// Если указан университет
	if req.UniversityID != "" {
		uniID, err := uuid.Parse(req.UniversityID)
		if err == nil {
			student.UniversityID = &uniID
		}
	}

	if err := s.repo.Create(student); err != nil {
		return nil, err
	}

	return student, nil
}

// GetProfile получает профиль по user_id
func (s *StudentService) GetProfile(userID uuid.UUID) (*models.Student, error) {
	return s.repo.FindByUserID(userID)
}

// GetByID получает студента по ID (для других сервисов)
func (s *StudentService) GetByID(id uuid.UUID) (*models.Student, error) {
	return s.repo.FindByID(id)
}

// UpdateProfile обновляет профиль студента
func (s *StudentService) UpdateProfile(userID uuid.UUID, req dto.UpdateProfileRequest) (*models.Student, error) {
	student, err := s.repo.FindByUserID(userID)
	if err != nil {
		return nil, err
	}

	// Обновляем только непустые поля
	if req.FirstName != "" {
		student.FirstName = req.FirstName
	}
	if req.LastName != "" {
		student.LastName = req.LastName
	}
	if req.UniversityID != "" {
		uniID, err := uuid.Parse(req.UniversityID)
		if err == nil {
			student.UniversityID = &uniID
		}
	}
	if req.Skills != "" {
		student.Skills = req.Skills
	}
	if req.GPA > 0 {
		student.GPA = req.GPA
	}
	if req.Specialization != "" {
		student.Specialization = req.Specialization
	}
	if req.GraduationYear > 0 {
		student.GraduationYear = req.GraduationYear
	}
	if req.Bio != "" {
		student.Bio = req.Bio
	}
	if req.Phone != "" {
		student.Phone = req.Phone
	}
	if req.LocationCity != "" {
		student.LocationCity = req.LocationCity
	}

	if err := s.repo.Update(student); err != nil {
		return nil, err
	}

	return student, nil
}
