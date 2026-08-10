package main

import (
	"context"
	"log"
	"net"

	"application-service/internal/config"
	"application-service/internal/facts"
	grpcserver "application-service/internal/grpc"
	"application-service/internal/grpc/pb"
	httphandler "application-service/internal/http/handler"
	httprouter "application-service/internal/http/router"
	"application-service/internal/notify"
	"application-service/internal/repository"
	"application-service/internal/scheduler"
	"application-service/internal/service"
	"application-service/internal/ws"

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

	if err := config.RunMigrations(cfg); err != nil {
		log.Fatalf("migration error: %v", err)
	}

	appRepo := repository.NewApplicationRepository(db)
	interviewRepo := repository.NewInterviewRepository(db)
	employmentRepo := repository.NewEmploymentRepository(db)
	appSvc := service.NewApplicationService(appRepo)
	grpcSrv := grpcserver.NewApplicationGRPCServer(appSvc, appRepo)

	// Compliance state machine (Article 47).
	complianceRepo := repository.NewComplianceRepository(db)
	complianceNotifier := notify.NewHTTPNotifier(cfg.StudentServiceURL)
	complianceSvc := service.NewComplianceService(complianceRepo, complianceNotifier)
	factProvider := facts.NewEmploymentFactProvider(employmentRepo, facts.Policy{})
	if cfg.ComplianceSchedulerEnabled {
		sched := scheduler.NewComplianceScheduler(complianceSvc, factProvider, cfg.ComplianceSchedulerInterval)
		go sched.Start(context.Background())
		log.Printf("Compliance scheduler enabled (interval=%s)", cfg.ComplianceSchedulerInterval)
	}

	go func() {
		chatRepo := repository.NewChatRepository(db)
		hub := ws.NewHub()
		interviewHandler := httphandler.NewInterviewHandler(interviewRepo, appRepo)
		employmentHandler := httphandler.NewEmploymentHandler(employmentRepo)
		chatHandler := httphandler.NewChatHandler(chatRepo, appRepo)
		wsHandler := httphandler.NewWSChatHandler(hub, chatRepo, appRepo)
		complianceHandler := httphandler.NewComplianceHandler(complianceSvc, factProvider)
		r := httprouter.SetupRouter(interviewHandler, employmentHandler, chatHandler, wsHandler, complianceHandler)

		httpPort := cfg.HTTPPort
		if httpPort == "" {
			httpPort = "8083"
		}
		log.Printf("Application Service HTTP running on :%s", httpPort)
		if err := r.Run(":" + httpPort); err != nil {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	grpcPort := cfg.GRPCPort
	if grpcPort == "" {
		grpcPort = "50054"
	}

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
