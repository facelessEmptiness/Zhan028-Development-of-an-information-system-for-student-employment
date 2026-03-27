package main

import (
	"log"
	"net"

	grpcserver "employer-service/internal/grpc"
	"employer-service/internal/grpc/pb"
	"employer-service/internal/config"
	"employer-service/internal/models"
	"employer-service/internal/repository"
	"employer-service/internal/service"

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
	if err := db.AutoMigrate(&models.Vacancy{}, &models.EmployerProfile{}); err != nil {
		log.Fatalf("migration error: %v", err)
	}

	// 4. Initialize layers
	vacancyRepo := repository.NewVacancyRepository(db)
	vacancySvc := service.NewVacancyService(vacancyRepo)

	profileRepo := repository.NewEmployerProfileRepository(db)
	profileSvc := service.NewEmployerProfileService(profileRepo)

	grpcSrv := grpcserver.NewVacancyGRPCServer(vacancySvc, profileSvc)

	// 5. Determine gRPC port
	grpcPort := cfg.GRPCPort
	if grpcPort == "" {
		grpcPort = "50052"
	}

	// 6. Start gRPC server
	lis, err := net.Listen("tcp", ":"+grpcPort)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	s := grpc.NewServer()
	pb.RegisterVacancyServiceServer(s, grpcSrv)

	log.Printf("Vacancy Service gRPC running on :%s", grpcPort)
	if err := s.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
