package main

import (
	"log"
	"net"

	"university-service/internal/config"
	grpcserver "university-service/internal/grpc"
	"university-service/internal/grpc/pb"
	"university-service/internal/models"
	"university-service/internal/repository"
	"university-service/internal/service"

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
	if err := db.AutoMigrate(&models.University{}); err != nil {
		log.Fatalf("migration error: %v", err)
	}

	// 4. Initialize layers
	universityRepo := repository.NewUniversityRepository(db)
	universitySvc := service.NewUniversityService(universityRepo)
	grpcSrv := grpcserver.NewUniversityGRPCServer(universitySvc)

	// 5. Seed universities if empty
	seedUniversities(universitySvc)

	// 6. Determine gRPC port
	grpcPort := cfg.GRPCPort
	if grpcPort == "" {
		grpcPort = "50053"
	}

	// 7. Start gRPC server
	lis, err := net.Listen("tcp", ":"+grpcPort)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	s := grpc.NewServer()
	pb.RegisterUniversityServiceServer(s, grpcSrv)

	log.Printf("University Service gRPC running on :%s — seeded", grpcPort)
	if err := s.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}

func seedUniversities(svc service.UniversityService) {
	unis := []struct{ name, city, country, website string }{
		{"Назарбаев Университет", "Астана", "Казахстан", "https://nu.edu.kz"},
		{"Евразийский национальный университет им. Л.Н. Гумилёва", "Астана", "Казахстан", "https://enu.kz"},
		{"Казахский агротехнический университет им. С. Сейфуллина", "Астана", "Казахстан", "https://kaznau.kz"},
		{"Казахский национальный университет им. аль-Фараби", "Алматы", "Казахстан", "https://kaznu.kz"},
		{"Казахстанско-Британский технический университет", "Алматы", "Казахстан", "https://kbtu.kz"},
		{"Международный университет информационных технологий", "Алматы", "Казахстан", "https://iitu.edu.kz"},
		{"Сатпаев Университет", "Алматы", "Казахстан", "https://satbayev.university"},
		{"Университет КИМЭП", "Алматы", "Казахстан", "https://kimep.kz"},
		{"Университет Туран", "Алматы", "Казахстан", "https://turan-edu.kz"},
		{"Карагандинский технический университет им. А. Сагинова", "Караганда", "Казахстан", "https://kstu.kz"},
		{"Astana IT University", "Астана", "Казахстан", "https://astanait.edu.kz"},
	}
	for _, u := range unis {
		_, err := svc.CreateUniversity(u.name, u.city, u.country, u.website)
		if err != nil {
			// already exists — skip silently
			continue
		}
	}
	log.Printf("University seed done (%d entries)", len(unis))
}
