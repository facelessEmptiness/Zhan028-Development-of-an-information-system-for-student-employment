package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type RefreshTokenRepository interface {
	Store(jti, userID string, ttl time.Duration) error
	Exists(jti string) (bool, error)
	Delete(jti string) error
}

type redisRefreshTokenRepository struct {
	rdb *redis.Client
}

func NewRedisRefreshTokenRepository(rdb *redis.Client) RefreshTokenRepository {
	return &redisRefreshTokenRepository{rdb: rdb}
}

func (r *redisRefreshTokenRepository) key(jti string) string {
	return fmt.Sprintf("rt:%s", jti)
}

func (r *redisRefreshTokenRepository) Store(jti, userID string, ttl time.Duration) error {
	return r.rdb.Set(context.Background(), r.key(jti), userID, ttl).Err()
}

func (r *redisRefreshTokenRepository) Exists(jti string) (bool, error) {
	n, err := r.rdb.Exists(context.Background(), r.key(jti)).Result()
	return n > 0, err
}

func (r *redisRefreshTokenRepository) Delete(jti string) error {
	return r.rdb.Del(context.Background(), r.key(jti)).Err()
}
