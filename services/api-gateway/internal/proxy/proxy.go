package proxy

import (
	"net/http"
	"net/http/httputil"
	"net/url"

	"github.com/gin-gonic/gin"
)

// NewServiceProxy - создаёт прокси для перенаправления запросов
func NewServiceProxy(targetURL string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. Парсим URL целевого сервиса
		target, err := url.Parse(targetURL)
		if err != nil {
			c.JSON(500, gin.H{"error": "Invalid target URL"})
			return
		}

		// 2. Создаём reverse proxy
		proxy := httputil.NewSingleHostReverseProxy(target)

		// 3. Настраиваем Director (модифицирует исходящий запрос)
		proxy.Director = func(req *http.Request) {
			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			req.Host = target.Host

			// Path остаётся как есть!
			// /api/auth/login → /api/auth/login
		}

		// 4. Обработка ошибок прокси
		proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
			c.JSON(502, gin.H{"error": "Service unavailable"})
		}

		// 5. Отправляем запрос через прокси
		proxy.ServeHTTP(c.Writer, c.Request)
	}
}
