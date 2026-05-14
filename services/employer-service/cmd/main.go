package main

import (
	"context"
	"log"
	"net"

	grpcserver "employer-service/internal/grpc"
	"employer-service/internal/grpc/pb"
	"employer-service/internal/config"
	"employer-service/internal/repository"
	"employer-service/internal/service"

	"github.com/redis/go-redis/v9"
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

	// 3. Run SQL migrations
	if err := config.RunMigrations(cfg); err != nil {
		log.Fatalf("migration error: %v", err)
	}

	// 4. Connect to Redis
	redisOpts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatalf("Failed to parse Redis URL: %v", err)
	}
	redisClient := redis.NewClient(redisOpts)
	if err := redisClient.Ping(context.Background()).Err(); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redisClient.Close()
	log.Println("Redis connection established")

	// 5. Initialize layers
	vacancyRepo := repository.NewVacancyRepository(db)
	vacancySvc := service.NewCachedVacancyService(service.NewVacancyService(vacancyRepo), redisClient)

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
