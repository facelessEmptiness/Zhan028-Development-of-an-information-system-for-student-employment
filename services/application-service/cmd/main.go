package main

import (
	"log"
	"net"

	grpcserver "application-service/internal/grpc"
	"application-service/internal/grpc/pb"
	"application-service/internal/config"
	httphandler "application-service/internal/http/handler"
	httprouter "application-service/internal/http/router"
	"application-service/internal/models"
	"application-service/internal/repository"
	"application-service/internal/service"

	"google.golang.org/grpc"
)

func main() {
	// 1. Load configuration
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	// 2. Connect to database
	db, err := config.ConnectDatabase(cfg)
	if err != nil {
		log.Fatalf("db error: %v", err)
	}

	// 3. Auto-migrate schema
	if err := db.AutoMigrate(&models.Application{}, &models.Interview{}, &models.EmploymentRecord{}); err != nil {
		log.Fatalf("migration error: %v", err)
	}

	// 4. Initialize layers
	appRepo := repository.NewApplicationRepository(db)
	interviewRepo := repository.NewInterviewRepository(db)
	employmentRepo := repository.NewEmploymentRepository(db)
	appSvc := service.NewApplicationService(appRepo)
	grpcSrv := grpcserver.NewApplicationGRPCServer(appSvc, appRepo)

	// 5. Start HTTP server for interviews and employment in background
	go func() {
		interviewHandler := httphandler.NewInterviewHandler(interviewRepo, appRepo)
		employmentHandler := httphandler.NewEmploymentHandler(employmentRepo)
		r := httprouter.SetupRouter(interviewHandler, employmentHandler)

		httpPort := cfg.HTTPPort
		if httpPort == "" {
			httpPort = "8083"
		}
		log.Printf("Application Service HTTP running on :%s", httpPort)
		if err := r.Run(":" + httpPort); err != nil {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	// 6. Determine gRPC port
	grpcPort := cfg.GRPCPort
	if grpcPort == "" {
		grpcPort = "50054"
	}

	// 7. Start gRPC server
	lis, err := net.Listen("tcp", ":"+grpcPort)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	s := grpc.NewServer()
	pb.RegisterApplicationServiceServer(s, grpcSrv)

	log.Printf("Application Service gRPC running on :%s", grpcPort)
	if err := s.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
