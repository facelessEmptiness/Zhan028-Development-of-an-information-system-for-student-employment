package main

import (
	"log"
	"net"

	grpcserver "application-service/internal/grpc"
	"application-service/internal/grpc/pb"
	"application-service/internal/config"
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
	if err := db.AutoMigrate(&models.Application{}); err != nil {
		log.Fatalf("migration error: %v", err)
	}

	// 4. Initialize layers
	appRepo := repository.NewApplicationRepository(db)
	appSvc := service.NewApplicationService(appRepo)
	grpcSrv := grpcserver.NewApplicationGRPCServer(appSvc, appRepo)

	// 5. Determine gRPC port
	grpcPort := cfg.GRPCPort
	if grpcPort == "" {
		grpcPort = "50054"
	}

	// 6. Start gRPC server
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
