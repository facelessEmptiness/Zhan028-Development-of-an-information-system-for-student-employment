package repository

import (
	"errors"
	"student-service/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrPushTokenNotFound = errors.New("push token not found")

type PushTokenRepository interface {
	Upsert(userID uuid.UUID, token, platform string) error
	FindByUserID(userID uuid.UUID) (string, error)
}

type pushTokenRepository struct {
	db *gorm.DB
}

func NewPushTokenRepository(db *gorm.DB) PushTokenRepository {
	return &pushTokenRepository{db: db}
}

func (r *pushTokenRepository) Upsert(userID uuid.UUID, token, platform string) error {
	pt := models.PushToken{
		UserID:   userID,
		Token:    token,
		Platform: platform,
	}
	return r.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"token", "platform", "updated_at"}),
	}).Create(&pt).Error
}

func (r *pushTokenRepository) FindByUserID(userID uuid.UUID) (string, error) {
	var pt models.PushToken
	err := r.db.Where("user_id = ?", userID).First(&pt).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", ErrPushTokenNotFound
	}
	return pt.Token, err
}
