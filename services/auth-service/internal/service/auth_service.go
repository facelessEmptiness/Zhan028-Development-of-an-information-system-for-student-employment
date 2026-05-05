package service

import (
	"auth-service/internal/dto"
	"auth-service/internal/models"
	"auth-service/internal/repository"
	"auth-service/pkg/email"
	"auth-service/pkg/jwt"
	crand "crypto/rand"
	"errors"
	"fmt"
	"log"
	"math/big"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// universityIDFromRequest parses optional university_id string into *uuid.UUID
func universityIDFromRequest(raw string) *uuid.UUID {
	if raw == "" {
		return nil
	}
	id, err := uuid.Parse(raw)
	if err != nil {
		return nil
	}
	return &id
}

// Ошибки сервиса аутентификации
var (
	ErrInvalidCredentials   = errors.New("неверный email или пароль")
	ErrUserNotActive        = errors.New("учётная запись деактивирована")
	ErrInvalidRole          = errors.New("недопустимая роль пользователя")
	ErrEmailNotVerified     = errors.New("email не подтверждён")
	ErrInvalidCode          = errors.New("неверный или просроченный код")
	ErrEmailAlreadyVerified = errors.New("email уже подтверждён")
)

// AuthService определяет интерфейс сервиса аутентификации
type AuthService interface {
	Register(req *dto.RegisterRequest) (*dto.MessageResponse, error)
	Login(req *dto.LoginRequest) (*dto.AuthResponse, error)
	GetProfile(userID uuid.UUID) (*dto.UserResponse, error)
	RefreshToken(refreshToken string) (*dto.TokenResponse, error)
	Logout(refreshToken string) error
	SendEmailVerification(emailAddr string) error
	VerifyEmail(req *dto.VerifyEmailRequest) (*dto.AuthResponse, error)
	ForgotPassword(req *dto.ForgotPasswordRequest) error
	ResetPassword(req *dto.ResetPasswordRequest) error
}

// authService реализует AuthService
type authService struct {
	userRepo     repository.UserRepository
	codeRepo     repository.VerificationCodeRepository
	tokenRepo    repository.RefreshTokenRepository
	jwtManager   *jwt.JWTManager
	emailService *email.EmailService
}

// NewAuthService создаёт новый экземпляр сервиса аутентификации
func NewAuthService(
	userRepo repository.UserRepository,
	codeRepo repository.VerificationCodeRepository,
	tokenRepo repository.RefreshTokenRepository,
	jwtManager *jwt.JWTManager,
	emailService *email.EmailService,
) AuthService {
	return &authService{
		userRepo:     userRepo,
		codeRepo:     codeRepo,
		tokenRepo:    tokenRepo,
		jwtManager:   jwtManager,
		emailService: emailService,
	}
}

// generateCode генерирует криптографически безопасный 6-значный числовой код
func generateCode() string {
	n, err := crand.Int(crand.Reader, big.NewInt(1_000_000))
	if err != nil {
		log.Fatalf("не удалось сгенерировать код: %v", err)
	}
	return fmt.Sprintf("%06d", n.Int64())
}

// Register регистрирует нового пользователя и отправляет код подтверждения
func (s *authService) Register(req *dto.RegisterRequest) (*dto.MessageResponse, error) {
	// Валидация роли
	if !req.Role.IsValid() {
		return nil, ErrInvalidRole
	}

	// Хеширование пароля
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	uniID := universityIDFromRequest(req.UniversityID)
	user := &models.User{
		Email:           req.Email,
		PasswordHash:    string(hashedPassword),
		Role:            req.Role,
		UniversityID:    uniID,
		IsActive:        true,
		IsEmailVerified: false,
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, err
	}

	// Отправка кода подтверждения
	if err := s.sendCode(req.Email, models.CodeTypeEmailVerification); err != nil {
		log.Printf("[Register] ошибка отправки кода на %s: %v", req.Email, err)
	}

	return &dto.MessageResponse{
		Message: "Регистрация успешна. Проверьте вашу почту для подтверждения email.",
		Email:   req.Email,
	}, nil
}

// sendCode создаёт и отправляет код подтверждения
func (s *authService) sendCode(emailAddr string, codeType models.CodeType) error {
	// Инвалидируем старые коды
	_ = s.codeRepo.InvalidateAll(emailAddr, codeType)

	code := generateCode()
	vc := &models.VerificationCode{
		Email:     emailAddr,
		Code:      code,
		Type:      codeType,
		ExpiresAt: time.Now().Add(15 * time.Minute),
	}

	if err := s.codeRepo.Create(vc); err != nil {
		return err
	}

	switch codeType {
	case models.CodeTypeEmailVerification:
		return s.emailService.SendVerificationCode(emailAddr, code)
	case models.CodeTypePasswordReset:
		return s.emailService.SendPasswordResetCode(emailAddr, code)
	}
	return nil
}

// Login аутентифицирует пользователя и возвращает JWT токены
func (s *authService) Login(req *dto.LoginRequest) (*dto.AuthResponse, error) {
	user, err := s.userRepo.FindByEmail(req.Email)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	if !user.IsActive {
		return nil, ErrUserNotActive
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	// Проверка подтверждения email
	if !user.IsEmailVerified {
		if err := s.sendCode(req.Email, models.CodeTypeEmailVerification); err != nil {
			log.Printf("[Login] ошибка отправки кода на %s: %v", req.Email, err)
		}
		return nil, ErrEmailNotVerified
	}

	return s.buildAuthResponse(user)
}

// GetProfile возвращает профиль пользователя по ID
func (s *authService) GetProfile(userID uuid.UUID) (*dto.UserResponse, error) {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return nil, err
	}
	response := dto.ToUserResponse(user)
	return &response, nil
}

// RefreshToken проверяет refresh токен, отзывает его и выдаёт новую пару (rotation)
func (s *authService) RefreshToken(refreshToken string) (*dto.TokenResponse, error) {
	claims, err := s.jwtManager.ValidateRefreshToken(refreshToken)
	if err != nil {
		return nil, err
	}

	// Проверяем, что токен ещё активен (не был отозван или использован)
	exists, err := s.tokenRepo.Exists(claims.ID)
	if err != nil || !exists {
		return nil, jwt.ErrInvalidToken
	}

	user, err := s.userRepo.FindByID(claims.UserID)
	if err != nil {
		return nil, err
	}

	if !user.IsActive {
		return nil, ErrUserNotActive
	}

	uniIDStr := ""
	if user.UniversityID != nil {
		uniIDStr = user.UniversityID.String()
	}

	// Rotation: отзываем старый токен перед выдачей нового
	_ = s.tokenRepo.Delete(claims.ID)

	newAccessToken, newRefreshToken, refreshJTI, err := s.jwtManager.GenerateTokenPair(
		user.ID, user.Email, string(user.Role), uniIDStr,
	)
	if err != nil {
		return nil, err
	}

	if err := s.tokenRepo.Store(refreshJTI, user.ID.String(), s.jwtManager.GetRefreshDuration()); err != nil {
		return nil, err
	}

	return &dto.TokenResponse{
		AccessToken:  newAccessToken,
		RefreshToken: newRefreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    s.jwtManager.GetAccessDuration(),
	}, nil
}

// Logout отзывает refresh токен — повторный refresh вернёт 401
func (s *authService) Logout(refreshToken string) error {
	claims, err := s.jwtManager.ValidateRefreshToken(refreshToken)
	if err != nil {
		return err
	}
	return s.tokenRepo.Delete(claims.ID)
}

// SendEmailVerification повторно отправляет код подтверждения email
func (s *authService) SendEmailVerification(emailAddr string) error {
	user, err := s.userRepo.FindByEmail(emailAddr)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			// Не раскрываем существование email
			return nil
		}
		return err
	}

	if user.IsEmailVerified {
		return ErrEmailAlreadyVerified
	}

	// Инвалидируем старые коды и создаём новый
	_ = s.codeRepo.InvalidateAll(emailAddr, models.CodeTypeEmailVerification)
	code := generateCode()
	vc := &models.VerificationCode{
		Email:     emailAddr,
		Code:      code,
		Type:      models.CodeTypeEmailVerification,
		ExpiresAt: time.Now().Add(15 * time.Minute),
	}
	if err := s.codeRepo.Create(vc); err != nil {
		return err
	}

	// SMTP ошибки не блокируют ответ — код уже сохранён в БД
	if err := s.emailService.SendVerificationCode(emailAddr, code); err != nil {
		log.Printf("[SendEmailVerification] SMTP ошибка для %s: %v", emailAddr, err)
	}
	return nil
}

// VerifyEmail подтверждает email по коду и возвращает JWT токены
func (s *authService) VerifyEmail(req *dto.VerifyEmailRequest) (*dto.AuthResponse, error) {
	_, err := s.codeRepo.FindValidCode(req.Email, req.Code, models.CodeTypeEmailVerification)
	if err != nil {
		if errors.Is(err, repository.ErrCodeNotFound) {
			return nil, ErrInvalidCode
		}
		return nil, err
	}

	// Находим пользователя
	user, err := s.userRepo.FindByEmail(req.Email)
	if err != nil {
		return nil, err
	}

	// Помечаем email как подтверждённый
	user.IsEmailVerified = true
	if err := s.userRepo.Update(user); err != nil {
		return nil, err
	}

	// Инвалидируем все коды подтверждения email
	_ = s.codeRepo.InvalidateAll(req.Email, models.CodeTypeEmailVerification)

	return s.buildAuthResponse(user)
}

// ForgotPassword отправляет код сброса пароля
func (s *authService) ForgotPassword(req *dto.ForgotPasswordRequest) error {
	log.Printf("[ForgotPassword] Запрос для email: %s", req.Email)
	_, err := s.userRepo.FindByEmail(req.Email)
	if err != nil {
		log.Printf("[ForgotPassword] Пользователь не найден: %s — %v", req.Email, err)
		// Не раскрываем существование email
		return nil
	}
	log.Printf("[ForgotPassword] Пользователь найден, генерируем код для: %s", req.Email)

	_ = s.codeRepo.InvalidateAll(req.Email, models.CodeTypePasswordReset)
	code := generateCode()
	vc := &models.VerificationCode{
		Email:     req.Email,
		Code:      code,
		Type:      models.CodeTypePasswordReset,
		ExpiresAt: time.Now().Add(15 * time.Minute),
	}
	if err := s.codeRepo.Create(vc); err != nil {
		log.Printf("[ForgotPassword] Ошибка сохранения кода: %v", err)
		return err
	}
	log.Printf("[ForgotPassword] Код сохранён в БД, отправляем email на: %s", req.Email)

	if smtpErr := s.emailService.SendPasswordResetCode(req.Email, code); smtpErr != nil {
		log.Printf("[ForgotPassword] SMTP ошибка: %v", smtpErr)
	}
	return nil
}

// ResetPassword сбрасывает пароль по коду
func (s *authService) ResetPassword(req *dto.ResetPasswordRequest) error {
	_, err := s.codeRepo.FindValidCode(req.Email, req.Code, models.CodeTypePasswordReset)
	if err != nil {
		if errors.Is(err, repository.ErrCodeNotFound) {
			return ErrInvalidCode
		}
		return err
	}

	user, err := s.userRepo.FindByEmail(req.Email)
	if err != nil {
		return err
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	user.PasswordHash = string(hashedPassword)
	if err := s.userRepo.Update(user); err != nil {
		return err
	}

	// Инвалидируем все коды сброса пароля
	_ = s.codeRepo.InvalidateAll(req.Email, models.CodeTypePasswordReset)

	return nil
}

// buildAuthResponse формирует ответ с токенами и сохраняет refresh JTI в Redis
func (s *authService) buildAuthResponse(user *models.User) (*dto.AuthResponse, error) {
	uniIDStr := ""
	if user.UniversityID != nil {
		uniIDStr = user.UniversityID.String()
	}

	accessToken, refreshToken, refreshJTI, err := s.jwtManager.GenerateTokenPair(
		user.ID, user.Email, string(user.Role), uniIDStr,
	)
	if err != nil {
		return nil, err
	}

	if err := s.tokenRepo.Store(refreshJTI, user.ID.String(), s.jwtManager.GetRefreshDuration()); err != nil {
		return nil, err
	}

	return &dto.AuthResponse{
		User: dto.ToUserResponse(user),
		Tokens: dto.TokenResponse{
			AccessToken:  accessToken,
			RefreshToken: refreshToken,
			TokenType:    "Bearer",
			ExpiresIn:    s.jwtManager.GetAccessDuration(),
		},
	}, nil
}
