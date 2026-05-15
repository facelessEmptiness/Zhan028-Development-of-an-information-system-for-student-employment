package router

import (
	"api-gateway/internal/config"
	"api-gateway/internal/grpc/applicationpb"
	"api-gateway/internal/grpc/studentpb"
	"api-gateway/internal/grpc/universitypb"
	"api-gateway/internal/grpc/vacancypb"
	"api-gateway/internal/handler"
	"api-gateway/internal/middleware"
	"api-gateway/internal/proxy"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// SetupRoutes configures all routes
func SetupRoutes(r *gin.Engine, cfg *config.Config) {
	// gRPC connections
	studentConn, err := grpc.NewClient(cfg.StudentServiceGRPCUrl, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		panic("failed to connect to student-service: " + err.Error())
	}
	vacancyConn, err := grpc.NewClient(cfg.EmployerServiceGRPCUrl, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		panic("failed to connect to vacancy-service: " + err.Error())
	}
	universityConn, err := grpc.NewClient(cfg.UniversityServiceGRPCUrl, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		panic("failed to connect to university-service: " + err.Error())
	}
	applicationConn, err := grpc.NewClient(cfg.ApplicationServiceGRPCUrl, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		panic("failed to connect to application-service: " + err.Error())
	}

	studentClient := studentpb.NewStudentServiceClient(studentConn)
	vacancyClient := vacancypb.NewVacancyServiceClient(vacancyConn)
	universityClient := universitypb.NewUniversityServiceClient(universityConn)
	applicationClient := applicationpb.NewApplicationServiceClient(applicationConn)

	notifClient := handler.NewNotificationClient(cfg.DocumentServiceUrl)

	studentHandler := handler.NewStudentHandler(studentClient, cfg.DocumentServiceUrl)
	vacancyHandler := handler.NewVacancyHandler(vacancyClient)
	universityHandler := handler.NewUniversityHandler(universityClient)
	applicationHandler := handler.NewApplicationHandler(applicationClient, studentClient, vacancyClient, notifClient, cfg.ApplicationServiceHttpUrl)
	employerProfileHandler := handler.NewEmployerProfileHandler(vacancyClient)
	analyticsHandler := handler.NewAnalyticsHandler(studentClient, vacancyClient, applicationClient)
	interviewHandler := handler.NewInterviewHandler(cfg.ApplicationServiceHttpUrl, notifClient)
	employmentHandler := handler.NewEmploymentHandler(cfg.ApplicationServiceHttpUrl)
	chatHandler := handler.NewChatHandler(cfg.ApplicationServiceHttpUrl, notifClient, vacancyClient)
	wsChatProxy := handler.NewWSChatProxy(cfg)

	api := r.Group("/api")

	// ============================================
	// AUTH SERVICE - REST proxy (rate-limited: 10 req/min per IP)
	// ============================================
	authLimiter := middleware.NewRateLimiter(rate.Every(6*time.Second), 10)
	api.Any("/auth/*path", authLimiter.Middleware(), proxy.NewServiceProxy(cfg.AuthServiceUrl))

	// ============================================
	// DOCUMENT SERVICE - REST proxy
	// ============================================
	api.Any("/documents/*path", middleware.AuthMiddleware(cfg.JWTSecret), proxy.NewServiceProxy(cfg.DocumentServiceUrl))

	// ============================================
	// NOTIFICATIONS - REST proxy to student-service
	// Using explicit routes (no wildcard) to avoid redirect loops between
	// Gin's trailing-slash redirect and the student-service's own redirect.
	// ============================================
	notifAuth := middleware.AuthMiddleware(cfg.JWTSecret)
	notifProxy := proxy.NewServiceProxy(cfg.DocumentServiceUrl)
	notifStreamProxy := proxy.NewStreamingProxy(cfg.DocumentServiceUrl)
	api.GET("/notifications", notifAuth, notifProxy)
	api.GET("/notifications/unread-count", notifAuth, notifProxy)
	api.GET("/notifications/stream", notifAuth, notifStreamProxy)
	api.PUT("/notifications/read-all", notifAuth, notifProxy)
	api.PUT("/notifications/:id/read", notifAuth, notifProxy)

	// ============================================
	// STUDENT SERVICE - gRPC
	// ============================================
	students := api.Group("/students", middleware.AuthMiddleware(cfg.JWTSecret), middleware.RoleMiddleware("student"))
	{
		students.POST("/profile", studentHandler.CreateProfile)
		students.GET("/profile", studentHandler.GetProfile)
		students.PUT("/profile", studentHandler.UpdateProfile)
	}

	// Student lookup by ID — accessible to employers and university admins
	api.GET("/students/:id", middleware.AuthMiddleware(cfg.JWTSecret), studentHandler.GetStudentByID)

	// University admins: list their own students
	api.GET("/students", middleware.AuthMiddleware(cfg.JWTSecret), middleware.RoleMiddleware("university", "admin"), studentHandler.ListStudentsByUniversity)

	// ============================================
	// VACANCY SERVICE - gRPC
	// ============================================
	vacancies := api.Group("/vacancies", middleware.AuthMiddleware(cfg.JWTSecret))
	{
		vacancies.POST("", vacancyHandler.CreateVacancy)
		vacancies.GET("", vacancyHandler.GetAllVacancies)
		vacancies.GET("/my", vacancyHandler.GetMyVacancies)
		vacancies.GET("/:id", vacancyHandler.GetVacancyByID)
		vacancies.PUT("/:id", vacancyHandler.UpdateVacancy)
		vacancies.DELETE("/:id", vacancyHandler.DeleteVacancy)
	}

	// ============================================
	// EMPLOYER PROFILE - gRPC (via vacancy-service)
	// ============================================
	employers := api.Group("/employers", middleware.AuthMiddleware(cfg.JWTSecret), middleware.RoleMiddleware("employer"))
	{
		employers.GET("/profile", employerProfileHandler.GetProfile)
		employers.POST("/profile", employerProfileHandler.CreateProfile)
		employers.PUT("/profile", employerProfileHandler.UpdateProfile)
	}

	// ============================================
	// UNIVERSITY SERVICE - gRPC
	// ============================================
	// Public: list all universities (needed before login for registration/profile dropdowns)
	api.GET("/universities", universityHandler.GetAllUniversities)

	universities := api.Group("/universities", middleware.AuthMiddleware(cfg.JWTSecret))
	{
		universities.POST("", universityHandler.CreateUniversity)
		universities.GET("/:id", universityHandler.GetUniversityByID)
		universities.PUT("/:id", universityHandler.UpdateUniversity)
		universities.DELETE("/:id", universityHandler.DeleteUniversity)
	}

	// ============================================
	// APPLICATION SERVICE - gRPC
	// ============================================
	applications := api.Group("/applications", middleware.AuthMiddleware(cfg.JWTSecret))
	{
		applications.POST("", applicationHandler.Apply)
		applications.GET("/my", applicationHandler.GetMyApplications)
		applications.GET("/vacancy/:vacancy_id", applicationHandler.GetVacancyApplications)
		applications.PUT("/:id/status", applicationHandler.UpdateStatus)
		applications.DELETE("/:id", applicationHandler.Withdraw)
	}

	// ============================================
	// INTERVIEWS - proxied to application-service HTTP
	// ============================================
	interviews := api.Group("/interviews", middleware.AuthMiddleware(cfg.JWTSecret))
	{
		interviews.POST("", interviewHandler.Schedule)
		interviews.GET("/employer", interviewHandler.GetForEmployer)
		interviews.GET("/student", interviewHandler.GetForStudent)
		interviews.GET("/application/:application_id", interviewHandler.GetByApplication)
		interviews.DELETE("/:id", interviewHandler.Cancel)
	}

	// ============================================
	// EMPLOYMENT MONITORING - proxied to application-service HTTP
	// ============================================
	employment := api.Group("/employment", middleware.AuthMiddleware(cfg.JWTSecret))
	{
		employment.GET("/student", employmentHandler.GetForStudent)
		employment.GET("/university", employmentHandler.GetForUniversity)
		employment.GET("/employer", employmentHandler.GetForEmployer)
		employment.PUT("/:id/end", employmentHandler.End)
	}

	// ============================================
	// CHAT - proxied to application-service HTTP
	// ============================================
	chatRoutes := api.Group("/chat", middleware.AuthMiddleware(cfg.JWTSecret))
	{
		chatRoutes.GET("/:application_id", chatHandler.GetMessages)
		chatRoutes.POST("/:application_id", chatHandler.SendMessage)
	}

	// ============================================
	// ANALYTICS - aggregated from all services
	// ============================================
	analytics := api.Group("/analytics", middleware.AuthMiddleware(cfg.JWTSecret))
	{
		analytics.GET("/summary", analyticsHandler.GetSummary)
	}

	// ============================================
	// WebSocket chat (auth via ?token=<jwt> query param)
	// ============================================
	r.GET("/ws/chat/:application_id", wsChatProxy.ProxyChat)

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
