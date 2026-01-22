package repository

import (
	"errors"
	"student-service/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Ошибки репозитория
var (
	ErrStudentNotFound      = errors.New("студент не найден")
	ErrStudentAlreadyExists = errors.New("студент с таким ИИН уже существует")
)

// StudentRepository интерфейс для работы со студентами
type StudentRepository interface {
	Create(student *models.Student) error
	FindByID(id uuid.UUID) (*models.Student, error)
	FindByUserID(userID uuid.UUID) (*models.Student, error)
	Update(student *models.Student) error
	Delete(id uuid.UUID) error
	ExistsByIIN(iin string) (bool, error)
	ExistsByUserID(userID uuid.UUID) (bool, error)
}

// studentRepository реализует StudentRepository
type studentRepository struct {
	db *gorm.DB
}

// NewStudentRepository создаёт новый экземпляр репозитория
func NewStudentRepository(db *gorm.DB) StudentRepository {
	return &studentRepository{db: db}
}

// Create создаёт нового студента
func (r *studentRepository) Create(student *models.Student) error {
	if err := r.db.Create(student).Error; err != nil {
		return err
	}
	return nil
}

// FindByID находит студента по ID
func (r *studentRepository) FindByID(id uuid.UUID) (*models.Student, error) {
	var student models.Student
	if err := r.db.Where("id = ?", id).First(&student).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrStudentNotFound
		}
		return nil, err
	}
	return &student, nil
}

// FindByUserID находит студента по user_id (из auth-service)
func (r *studentRepository) FindByUserID(userID uuid.UUID) (*models.Student, error) {
	var student models.Student
	if err := r.db.Where("user_id = ?", userID).First(&student).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrStudentNotFound
		}
		return nil, err
	}
	return &student, nil
}

// Update обновляет данные студента
func (r *studentRepository) Update(student *models.Student) error {
	result := r.db.Save(student)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrStudentNotFound
	}
	return nil
}

// Delete удаляет студента по ID
func (r *studentRepository) Delete(id uuid.UUID) error {
	result := r.db.Delete(&models.Student{}, "id = ?", id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrStudentNotFound
	}
	return nil
}

// ExistsByIIN проверяет существование студента с указанным ИИН
func (r *studentRepository) ExistsByIIN(iin string) (bool, error) {
	var count int64
	if err := r.db.Model(&models.Student{}).Where("iin = ?", iin).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

// ExistsByUserID проверяет существование студента с указанным user_id
func (r *studentRepository) ExistsByUserID(userID uuid.UUID) (bool, error) {
	var count int64
	if err := r.db.Model(&models.Student{}).Where("user_id = ?", userID).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}
