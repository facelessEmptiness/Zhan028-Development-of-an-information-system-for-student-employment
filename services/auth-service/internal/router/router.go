package router

import (
	"auth-service/internal/dto"
	"auth-service/internal/handler"
	"auth-service/pkg/jwt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)


// SetupRouter настраивает и возвращает роутер Gin
func SetupRouter(authHandler *handler.AuthHandler, jwtManager *jwt.JWTManager, allowedOrigins []string) *gin.Engine {
	// Создание роутера с стандартными middleware (Logger и Recovery)
	r := gin.Default()

	// Middleware для CORS
	r.Use(corsMiddleware(allowedOrigins))

	// Группа API маршрутов
	api := r.Group("/api")
	{
		// Группа маршрутов аутентификации
		auth := api.Group("/auth")
		{
			// Публичные маршруты (не требуют аутентификации)
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.POST("/refresh", authHandler.RefreshToken)
			auth.POST("/logout", authHandler.Logout)

			// Email подтверждение
			auth.POST("/verify-email", authHandler.VerifyEmail)
			auth.POST("/resend-verification", authHandler.ResendVerification)

			// Сброс пароля
			auth.POST("/forgot-password", authHandler.ForgotPassword)
			auth.POST("/reset-password", authHandler.ResetPassword)

			// Защищённые маршруты (требуют JWT токен)
			protected := auth.Group("")
			protected.Use(authMiddleware(jwtManager))
			{
				protected.GET("/me", authHandler.GetProfile)

			// Admin-only routes (role check is enforced in handler)
			protected.GET("/admin/users", authHandler.ListUsers)
			protected.DELETE("/admin/users/:id", authHandler.DeleteUser)
			protected.PATCH("/admin/users/:id/role", authHandler.UpdateUserRole)
			protected.PATCH("/admin/users/:id/active", authHandler.ToggleUserActive)
			}
		}
	}

	// Health check эндпоинт
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "auth-service",
		})
	})

	return r
}

// authMiddleware создаёт middleware для проверки JWT токена
func authMiddleware(jwtManager *jwt.JWTManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Получение заголовка Authorization
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, dto.ErrorResponse{
				Error:   "Не авторизован",
				Message: "Отсутствует заголовок Authorization",
			})
			return
		}

		// Проверка формата "Bearer <token>"
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, dto.ErrorResponse{
				Error:   "Не авторизован",
				Message: "Неверный формат заголовка Authorization",
			})
			return
		}

		// Валидация токена
		claims, err := jwtManager.ValidateAccessToken(parts[1])
		if err != nil {
			var message string
			if err == jwt.ErrExpiredToken {
				message = "Срок действия токена истёк"
			} else {
				message = "Недействительный токен"
			}
			c.AbortWithStatusJSON(http.StatusUnauthorized, dto.ErrorResponse{
				Error:   "Не авторизован",
				Message: message,
			})
			return
		}

		// Сохранение данных пользователя в контексте запроса
		c.Set("user_id", claims.UserID)
		c.Set("user_email", claims.Email)
		c.Set("user_role", claims.Role)

		c.Next()
	}
}

// corsMiddleware настраивает CORS для API
func corsMiddleware(allowedOrigins []string) gin.HandlerFunc {
	originSet := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		originSet[strings.TrimSpace(o)] = struct{}{}
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if _, ok := originSet[origin]; ok {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Vary", "Origin")
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		}
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
