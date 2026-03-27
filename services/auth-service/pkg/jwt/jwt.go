package jwt

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Ошибки JWT
var (
	ErrInvalidToken = errors.New("недействительный токен")
	ErrExpiredToken = errors.New("срок действия токена истёк")
)

// TokenType определяет тип токена
type TokenType string

const (
	AccessToken  TokenType = "access"
	RefreshToken TokenType = "refresh"
)

// Claims представляет данные, хранящиеся в JWT токене
type Claims struct {
	UserID       uuid.UUID `json:"user_id"`
	Email        string    `json:"email"`
	Role         string    `json:"role"`
	UniversityID string    `json:"university_id,omitempty"`
	TokenType    TokenType `json:"token_type"`
	jwt.RegisteredClaims
}

// JWTManager управляет созданием и валидацией JWT токенов
type JWTManager struct {
	secretKey       string
	accessDuration  time.Duration
	refreshDuration time.Duration
}

// NewJWTManager создаёт новый экземпляр JWTManager
func NewJWTManager(secretKey string, accessExpirationHours int) *JWTManager {
	return &JWTManager{
		secretKey:       secretKey,
		accessDuration:  time.Duration(accessExpirationHours) * time.Hour,
		refreshDuration: time.Duration(accessExpirationHours*7) * time.Hour, // Refresh токен живёт в 7 раз дольше
	}
}

// GenerateAccessToken создаёт новый access токен
func (m *JWTManager) GenerateAccessToken(userID uuid.UUID, email, role, universityID string) (string, error) {
	return m.generateToken(userID, email, role, universityID, AccessToken, m.accessDuration)
}

// GenerateRefreshToken создаёт новый refresh токен
func (m *JWTManager) GenerateRefreshToken(userID uuid.UUID, email, role, universityID string) (string, error) {
	return m.generateToken(userID, email, role, universityID, RefreshToken, m.refreshDuration)
}

// GenerateTokenPair создаёт пару access и refresh токенов
func (m *JWTManager) GenerateTokenPair(userID uuid.UUID, email, role, universityID string) (accessToken, refreshToken string, err error) {
	accessToken, err = m.GenerateAccessToken(userID, email, role, universityID)
	if err != nil {
		return "", "", err
	}

	refreshToken, err = m.GenerateRefreshToken(userID, email, role, universityID)
	if err != nil {
		return "", "", err
	}

	return accessToken, refreshToken, nil
}

// ValidateToken проверяет токен и возвращает claims
func (m *JWTManager) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		// Проверка метода подписи
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return []byte(m.secretKey), nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

// ValidateAccessToken проверяет, что токен является access токеном
func (m *JWTManager) ValidateAccessToken(tokenString string) (*Claims, error) {
	claims, err := m.ValidateToken(tokenString)
	if err != nil {
		return nil, err
	}

	if claims.TokenType != AccessToken {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

// ValidateRefreshToken проверяет, что токен является refresh токеном
func (m *JWTManager) ValidateRefreshToken(tokenString string) (*Claims, error) {
	claims, err := m.ValidateToken(tokenString)
	if err != nil {
		return nil, err
	}

	if claims.TokenType != RefreshToken {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

// GetAccessDuration возвращает время жизни access токена в секундах
func (m *JWTManager) GetAccessDuration() int64 {
	return int64(m.accessDuration.Seconds())
}

// generateToken создаёт JWT токен с указанными параметрами
func (m *JWTManager) generateToken(userID uuid.UUID, email, role, universityID string, tokenType TokenType, duration time.Duration) (string, error) {
	now := time.Now()

	claims := &Claims{
		UserID:       userID,
		Email:        email,
		Role:         role,
		UniversityID: universityID,
		TokenType:    tokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(duration)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    "auth-service",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(m.secretKey))
}
