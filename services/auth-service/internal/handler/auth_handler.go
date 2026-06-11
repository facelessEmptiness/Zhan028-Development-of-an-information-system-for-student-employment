package handler

import (
	"auth-service/internal/dto"
	"auth-service/internal/repository"
	"auth-service/internal/service"
	"auth-service/pkg/jwt"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AuthHandler обрабатывает HTTP запросы аутентификации
type AuthHandler struct {
	authService service.AuthService
}

// NewAuthHandler создаёт новый экземпляр обработчика аутентификации
func NewAuthHandler(authService service.AuthService) *AuthHandler {
	return &AuthHandler{
		authService: authService,
	}
}

// Register обрабатывает запрос на регистрацию нового пользователя
func (h *AuthHandler) Register(c *gin.Context) {
	var req dto.RegisterRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "Ошибка валидации",
			Message: err.Error(),
		})
		return
	}

	response, err := h.authService.Register(&req)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusCreated, response)
}

// Login обрабатывает запрос на аутентификацию
func (h *AuthHandler) Login(c *gin.Context) {
	var req dto.LoginRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "Ошибка валидации",
			Message: err.Error(),
		})
		return
	}

	response, err := h.authService.Login(&req)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, response)
}

// GetProfile возвращает профиль текущего пользователя
func (h *AuthHandler) GetProfile(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
			Error:   "Не авторизован",
			Message: "Требуется аутентификация",
		})
		return
	}

	id, ok := userID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error:   "Внутренняя ошибка",
			Message: "Некорректный формат ID пользователя",
		})
		return
	}

	response, err := h.authService.GetProfile(id)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, response)
}

// RefreshToken обновляет JWT токены
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req dto.RefreshRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "Ошибка валидации",
			Message: err.Error(),
		})
		return
	}

	response, err := h.authService.RefreshToken(req.RefreshToken)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, response)
}

// VerifyEmail подтверждает email по коду
func (h *AuthHandler) VerifyEmail(c *gin.Context) {
	var req dto.VerifyEmailRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "Ошибка валидации",
			Message: err.Error(),
		})
		return
	}

	response, err := h.authService.VerifyEmail(&req)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, response)
}

// ResendVerification повторно отправляет код подтверждения email
func (h *AuthHandler) ResendVerification(c *gin.Context) {
	var req dto.ResendVerificationRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "Ошибка валидации",
			Message: err.Error(),
		})
		return
	}

	if err := h.authService.SendEmailVerification(req.Email); err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{
		Message: "Код подтверждения отправлен на вашу почту",
	})
}

// ForgotPassword отправляет код сброса пароля
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req dto.ForgotPasswordRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "Ошибка валидации",
			Message: err.Error(),
		})
		return
	}

	_ = h.authService.ForgotPassword(&req)

	// Всегда возвращаем успех (не раскрываем существование email)
	c.JSON(http.StatusOK, dto.SuccessResponse{
		Message: "Если аккаунт с таким email существует, мы отправили код для сброса пароля",
	})
}

// Logout отзывает refresh токен пользователя
func (h *AuthHandler) Logout(c *gin.Context) {
	var req dto.RefreshRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "Ошибка валидации",
			Message: err.Error(),
		})
		return
	}

	if err := h.authService.Logout(req.RefreshToken); err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{Message: "Выход выполнен успешно"})
}

// ResetPassword сбрасывает пароль по коду
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req dto.ResetPasswordRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "Ошибка валидации",
			Message: err.Error(),
		})
		return
	}

	if err := h.authService.ResetPassword(&req); err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{
		Message: "Пароль успешно изменён",
	})
}

// UpdateUserRole меняет роль пользователя (только для admin)
func (h *AuthHandler) UpdateUserRole(c *gin.Context) {
	if c.GetString("user_role") != "admin" {
		c.JSON(http.StatusForbidden, dto.ErrorResponse{Error: "Доступ запрещён", Message: "Только для администраторов"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Ошибка валидации", Message: "Некорректный UUID"})
		return
	}
	var req struct {
		Role string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Ошибка валидации", Message: err.Error()})
		return
	}
	user, err := h.authService.UpdateUserRole(id, req.Role)
	if err != nil {
		handleServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, user)
}

// ToggleUserActive активирует или деактивирует пользователя (только для admin)
func (h *AuthHandler) ToggleUserActive(c *gin.Context) {
	if c.GetString("user_role") != "admin" {
		c.JSON(http.StatusForbidden, dto.ErrorResponse{Error: "Доступ запрещён", Message: "Только для администраторов"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Ошибка валидации", Message: "Некорректный UUID"})
		return
	}
	var req struct {
		IsActive bool `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Ошибка валидации", Message: err.Error()})
		return
	}
	user, err := h.authService.ToggleUserActive(id, req.IsActive)
	if err != nil {
		handleServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, user)
}

// ListUsers возвращает всех пользователей (только для admin)
func (h *AuthHandler) ListUsers(c *gin.Context) {
	if c.GetString("user_role") != "admin" {
		c.JSON(http.StatusForbidden, dto.ErrorResponse{Error: "Доступ запрещён", Message: "Только для администраторов"})
		return
	}
	role := c.Query("role")
	users, err := h.authService.ListUsers(role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Ошибка сервера", Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"users": users, "total": len(users)})
}

// DeleteUser удаляет пользователя по ID (только для admin)
func (h *AuthHandler) DeleteUser(c *gin.Context) {
	if c.GetString("user_role") != "admin" {
		c.JSON(http.StatusForbidden, dto.ErrorResponse{Error: "Доступ запрещён", Message: "Только для администраторов"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Ошибка валидации", Message: "Некорректный UUID"})
		return
	}
	if err := h.authService.DeleteUser(id); err != nil {
		handleServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, dto.SuccessResponse{Message: "Пользователь удалён"})
}

// handleServiceError обрабатывает ошибки сервиса
func handleServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, repository.ErrUserAlreadyExists):
		c.JSON(http.StatusConflict, dto.ErrorResponse{
			Error:   "Конфликт",
			Message: "Пользователь с таким email уже существует",
		})
	case errors.Is(err, repository.ErrUserNotFound):
		c.JSON(http.StatusNotFound, dto.ErrorResponse{
			Error:   "Не найдено",
			Message: "Пользователь не найден",
		})
	case errors.Is(err, service.ErrInvalidCredentials):
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
			Error:   "Ошибка аутентификации",
			Message: "Неверный email или пароль",
		})
	case errors.Is(err, service.ErrUserNotActive):
		c.JSON(http.StatusForbidden, dto.ErrorResponse{
			Error:   "Доступ запрещён",
			Message: "Учётная запись деактивирована",
		})
	case errors.Is(err, service.ErrInvalidRole):
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "Ошибка валидации",
			Message: "Недопустимая роль пользователя",
		})
	case errors.Is(err, service.ErrAdminRoleForbidden):
		c.JSON(http.StatusForbidden, dto.ErrorResponse{
			Error:   "Доступ запрещён",
			Message: "Роль администратора нельзя назначать через API",
		})
	case errors.Is(err, service.ErrEmailNotVerified):
		c.JSON(http.StatusForbidden, dto.ErrorResponse{
			Error:   "Email не подтверждён",
			Message: "Пожалуйста, подтвердите ваш email. Новый код отправлен.",
		})
	case errors.Is(err, service.ErrInvalidCode):
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "Неверный код",
			Message: "Код неверный или срок его действия истёк",
		})
	case errors.Is(err, service.ErrEmailAlreadyVerified):
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "Уже подтверждён",
			Message: "Email уже подтверждён",
		})
	case errors.Is(err, jwt.ErrInvalidToken):
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
			Error:   "Ошибка аутентификации",
			Message: "Недействительный токен",
		})
	case errors.Is(err, jwt.ErrExpiredToken):
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
			Error:   "Ошибка аутентификации",
			Message: "Срок действия токена истёк",
		})
	default:
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error:   "Внутренняя ошибка сервера",
			Message: "Произошла непредвиденная ошибка",
		})
	}
}
