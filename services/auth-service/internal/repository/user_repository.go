package repository

import (
	"auth-service/internal/models"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Ошибки репозитория
var (
	ErrUserNotFound      = errors.New("пользователь не найден")
	ErrUserAlreadyExists = errors.New("пользователь с таким email уже существует")
)

// UserRepository определяет интерфейс для работы с пользователями в БД
type UserRepository interface {
	Create(user *models.User) error
	FindByID(id uuid.UUID) (*models.User, error)
	FindByEmail(email string) (*models.User, error)
	Update(user *models.User) error
	Delete(id uuid.UUID) error
	ExistsByEmail(email string) (bool, error)
	ListAll(role string) ([]models.User, error)
}

// userRepository реализует UserRepository
type userRepository struct {
	db *gorm.DB
}

// NewUserRepository создаёт новый экземпляр репозитория пользователей
func NewUserRepository(db *gorm.DB) UserRepository {
	return &userRepository{db: db}
}

// Create создаёт нового пользователя в базе данных
func (r *userRepository) Create(user *models.User) error {
	// Проверка на существование пользователя с таким email
	exists, err := r.ExistsByEmail(user.Email)
	if err != nil {
		return err
	}
	if exists {
		return ErrUserAlreadyExists
	}

	// Создание записи в БД
	if err := r.db.Create(user).Error; err != nil {
		return err
	}

	return nil
}

// FindByID находит пользователя по UUID
func (r *userRepository) FindByID(id uuid.UUID) (*models.User, error) {
	var user models.User
	if err := r.db.Where("id = ?", id).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &user, nil
}

// FindByEmail находит пользователя по email
func (r *userRepository) FindByEmail(email string) (*models.User, error) {
	var user models.User
	if err := r.db.Where("email = ?", email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &user, nil
}

// Update обновляет данные пользователя
func (r *userRepository) Update(user *models.User) error {
	result := r.db.Save(user)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrUserNotFound
	}
	return nil
}

// Delete удаляет пользователя по UUID
func (r *userRepository) Delete(id uuid.UUID) error {
	result := r.db.Delete(&models.User{}, "id = ?", id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrUserNotFound
	}
	return nil
}

// ListAll возвращает всех пользователей, опционально фильтрует по роли
func (r *userRepository) ListAll(role string) ([]models.User, error) {
	var users []models.User
	q := r.db.Order("created_at DESC")
	if role != "" {
		q = q.Where("role = ?", role)
	}
	if err := q.Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}

// ExistsByEmail проверяет существование пользователя с указанным email
func (r *userRepository) ExistsByEmail(email string) (bool, error) {
	var count int64
	if err := r.db.Model(&models.User{}).Where("email = ?", email).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}
