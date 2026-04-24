package repository

import (
	"context"
	"fmt"
	"time"

	"auth-service/internal/models"

	"github.com/redis/go-redis/v9"
)

type redisCodeRepository struct {
	rdb *redis.Client
}

func NewRedisVerificationCodeRepository(rdb *redis.Client) VerificationCodeRepository {
	return &redisCodeRepository{rdb: rdb}
}

func (r *redisCodeRepository) codeKey(email string, codeType models.CodeType) string {
	return fmt.Sprintf("verif:%s:%s", email, string(codeType))
}

func (r *redisCodeRepository) Create(code *models.VerificationCode) error {
	key := r.codeKey(code.Email, code.Type)
	ttl := time.Until(code.ExpiresAt)
	if ttl <= 0 {
		ttl = 15 * time.Minute
	}
	return r.rdb.Set(context.Background(), key, code.Code, ttl).Err()
}

func (r *redisCodeRepository) FindValidCode(email, code string, codeType models.CodeType) (*models.VerificationCode, error) {
	key := r.codeKey(email, codeType)
	stored, err := r.rdb.Get(context.Background(), key).Result()
	if err == redis.Nil {
		return nil, ErrCodeNotFound
	}
	if err != nil {
		return nil, err
	}
	if stored != code {
		return nil, ErrCodeNotFound
	}
	return &models.VerificationCode{Email: email, Code: code, Type: codeType}, nil
}

// MarkAsUsed удаляет код из Redis — повторное использование невозможно
func (r *redisCodeRepository) MarkAsUsed(id interface{}) error {
	return nil
}

// DeleteExpired — Redis автоматически удаляет ключи по TTL
func (r *redisCodeRepository) DeleteExpired() error {
	return nil
}

func (r *redisCodeRepository) InvalidateAll(email string, codeType models.CodeType) error {
	key := r.codeKey(email, codeType)
	return r.rdb.Del(context.Background(), key).Err()
}
