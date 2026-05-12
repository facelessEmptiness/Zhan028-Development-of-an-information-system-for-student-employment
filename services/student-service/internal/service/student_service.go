package service

import (
	"errors"
	"student-service/internal/dto"
	"student-service/internal/models"
	"student-service/internal/repository"
	"time"
	"unicode"

	"github.com/google/uuid"
)

const minStudentAge = 16

var (
	ErrProfileAlreadyExists = errors.New("профиль студента уже существует")
	ErrProfileNotFound      = errors.New("профиль студента не найден")
	ErrIINAlreadyTaken      = errors.New("ИИН уже зарегистрирован")
	ErrIINInvalidFormat     = errors.New("ИИН должен содержать ровно 12 цифр")
	ErrIINInvalidChecksum   = errors.New("ИИН не прошёл проверку контрольной суммы")
	ErrIINTooYoung          = errors.New("по данным ИИН вам меньше 16 лет — регистрация студентов недоступна")
)


// validateIIN проверяет казахстанский ИИН (12 цифр, контрольная сумма, возраст ≥ 16).
func validateIIN(iin string) error {
	if len(iin) != 12 {
		return ErrIINInvalidFormat
	}
	digits := make([]int, 12)
	for i, ch := range iin {
		if !unicode.IsDigit(ch) {
			return ErrIINInvalidFormat
		}
		digits[i] = int(ch - '0')
	}

	// Контрольная сумма
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
		return ErrIINInvalidChecksum
	}
	if check != digits[11] {
		return ErrIINInvalidChecksum
	}

	// Возраст: первые 6 цифр — ГГММДД, 7-я — век (3-4 → 1900-е, 5-6 → 2000-е)
	yy := digits[0]*10 + digits[1]
	mm := digits[2]*10 + digits[3]
	dd := digits[4]*10 + digits[5]
	century := digits[6]

	var fullYear int
	switch {
	case century == 1 || century == 2:
		fullYear = 1800 + yy
	case century == 3 || century == 4:
		fullYear = 1900 + yy
	case century == 5 || century == 6:
		fullYear = 2000 + yy
	default:
		return ErrIINInvalidFormat
	}

	birthDate := time.Date(fullYear, time.Month(mm), dd, 0, 0, 0, 0, time.UTC)
	age := time.Now().UTC().Year() - birthDate.Year()
	// Корректируем если день рождения ещё не наступил в этом году
	anniversary := birthDate.AddDate(age, 0, 0)
	if time.Now().UTC().Before(anniversary) {
		age--
	}

	if age < minStudentAge {
		return ErrIINTooYoung
	}

	return nil
}

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

	// Валидируем ИИН (формат + контрольная сумма)
	if err := validateIIN(req.IIN); err != nil {
		return nil, err
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
		GithubUrl:      req.GithubUrl,
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
	// github_url is always updated (allows clearing to empty)
	student.GithubUrl = req.GithubUrl

	if err := s.repo.Update(student); err != nil {
		return nil, err
	}

	return student, nil
}
