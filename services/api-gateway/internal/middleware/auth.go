package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// AuthMiddleware - проверяет JWT токен
func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. Получаем header Authorization
		authHeader := c.GetHeader("Authorization")

		// 2. Проверяем что header не пустой
		if authHeader == "" {
			c.JSON(401, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		// 3. Проверяем формат "Bearer <token>"
		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.JSON(401, gin.H{"error": "Invalid authorization format"})
			c.Abort()
			return
		}

		// 4. Извлекаем токен (убираем "Bearer ")
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		// 5. Парсим и проверяем JWT токен
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(jwtSecret), nil
		})

		// 6. Проверяем на ошибки
		if err != nil || !token.Valid {
			c.JSON(401, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		// 7. Извлекаем claims (данные из токена)
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(401, gin.H{"error": "Invalid token claims"})
			c.Abort()
			return
		}

		// 8. Достаём user_id из токена
		userID, ok := claims["user_id"].(string)
		if !ok {
			c.JSON(401, gin.H{"error": "User ID not found in token"})
			c.Abort()
			return
		}
		role, ok := claims["role"].(string)
		if !ok {
			c.JSON(401, gin.H{"error": "Role not found in token"})
		}

		// 9. Добавляем user_id в header для микросервисов
		c.Request.Header.Set("X-User-ID", userID)
		c.Request.Header.Set("X-User-Role", role)

		// 10. Сохраняем в контекст Gin
		c.Set("user_id", userID)
		c.Set("role", role)

		// 11. Продолжаем обработку
		c.Next()
	}
}
