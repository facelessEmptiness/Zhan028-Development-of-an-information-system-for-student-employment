package main

import (
	"log"
	"net"

	grpcserver "student-service/internal/grpc"
	"student-service/internal/grpc/pb"
	"student-service/internal/config"
	"student-service/internal/http/handler"
	"student-service/internal/http/router"
	"student-service/internal/repository"
	"student-service/internal/service"

	"google.golang.org/grpc"
)

func main() {
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	db, err := config.ConnectDatabase(cfg)
	if err != nil {
		log.Fatalf("db error: %v", err)
	}

	// Repositories
	studentRepo := repository.NewStudentRepository(db)
	docRepo := repository.NewDocumentRepository(db)
	notifRepo := repository.NewNotificationRepository(db)

	// Services
	studentSvc := service.NewStudentService(studentRepo)

	// gRPC server
	grpcSrv := grpcserver.NewStudentGRPCServer(studentSvc)

	grpcPort := cfg.GRPCPort
	if grpcPort == "" {
		grpcPort = "50051"
	}

	lis, err := net.Listen("tcp", ":"+grpcPort)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	s := grpc.NewServer()
	pb.RegisterStudentServiceServer(s, grpcSrv)

	// HTTP server (documents + student REST) in background
	go func() {
		studentHandler := handler.NewStudentHandler(studentSvc)
		docHandler := handler.NewDocumentHandler(docRepo, notifRepo)
		notifHandler := handler.NewNotificationHandler(notifRepo)
		r := router.SetupRouter(studentHandler, docHandler, notifHandler)

		httpPort := cfg.ServerPort
		if httpPort == "" {
			httpPort = "8082"
		}
		log.Printf("Student Service HTTP running on :%s", httpPort)
		if err := r.Run(":" + httpPort); err != nil {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	log.Printf("Student Service gRPC running on :%s", grpcPort)
	if err := s.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
