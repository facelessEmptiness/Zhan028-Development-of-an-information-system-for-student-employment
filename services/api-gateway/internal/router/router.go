package router

import (
	"github.com/gin-gonic/gin"

	"api-gateway/internal/config"
	"api-gateway/internal/middleware"
	"api-gateway/internal/proxy"
)

// SetupRoutes - настраивает все маршруты
func SetupRoutes(r *gin.Engine, cfg *config.Config) {

	// API группа
	api := r.Group("/api")

	// ============================================
	// AUTH SERVICE - публичные эндпоинты
	// ============================================
	api.Any("/auth/*path", proxy.NewServiceProxy(cfg.AuthServiceUrl))

	// ============================================
	// STUDENT SERVICE - защищённые эндпоинты
	// ============================================
	api.Any("/students/*path",
		middleware.AuthMiddleware(cfg.JWTSecret),     // ← middleware первый
		proxy.NewServiceProxy(cfg.StudentServiceUrl), // ← proxy второй
	)

	// ============================================
	// EMPLOYER SERVICE - защищённые эндпоинты
	// ============================================
	api.Any("/employers/*path",
		middleware.AuthMiddleware(cfg.JWTSecret),
		proxy.NewServiceProxy(cfg.EmployerServiceUrl),
	)

	// ============================================
	// VACANCY SERVICE
	// ============================================
	//api.Any("/vacancies/*path",
	//	middleware.AuthMiddleware(cfg.JWTSecret),
	//	proxy.NewServiceProxy(cfg.VacancyServiceURL),
	//)

	// ============================================
	// REPORT SERVICE
	// ============================================
	//api.Any("/reports/*path",
	//	middleware.AuthMiddleware(cfg.JWTSecret),
	//	proxy.NewServiceProxy(cfg.ReportServiceURL),
	//)

	// ============================================
	// Health check
	// ============================================
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "api-gateway",
		})
	})
}
