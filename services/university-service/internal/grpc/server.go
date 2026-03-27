package grpc

import (
	"context"
	"errors"
	"university-service/internal/grpc/pb"
	"university-service/internal/models"
	"university-service/internal/service"

	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type UniversityGRPCServer struct {
	pb.UnimplementedUniversityServiceServer
	service service.UniversityService
}

func NewUniversityGRPCServer(svc service.UniversityService) *UniversityGRPCServer {
	return &UniversityGRPCServer{service: svc}
}

func (s *UniversityGRPCServer) CreateUniversity(ctx context.Context, req *pb.CreateUniversityRequest) (*pb.UniversityMessage, error) {
	university, err := s.service.CreateUniversity(req.Name, req.City, req.Country, req.Website)
	if err != nil {
		if errors.Is(err, service.ErrNameAlreadyTaken) {
			return nil, status.Errorf(codes.AlreadyExists, "university name already taken: %v", err)
		}
		return nil, status.Errorf(codes.Internal, "failed to create university: %v", err)
	}

	return toProtoUniversity(university), nil
}

func (s *UniversityGRPCServer) GetAllUniversities(ctx context.Context, req *pb.Empty) (*pb.UniversitiesResponse, error) {
	universities, err := s.service.GetAllUniversities()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get universities: %v", err)
	}

	resp := &pb.UniversitiesResponse{}
	for _, u := range universities {
		u := u
		resp.Universities = append(resp.Universities, toProtoUniversity(&u))
	}
	return resp, nil
}

func (s *UniversityGRPCServer) GetUniversityByID(ctx context.Context, req *pb.GetByIDRequest) (*pb.UniversityMessage, error) {
	id, err := uuid.Parse(req.Id)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid id: %v", err)
	}

	university, err := s.service.GetUniversityByID(id)
	if err != nil {
		if errors.Is(err, service.ErrUniversityNotFound) {
			return nil, status.Errorf(codes.NotFound, "university not found: %v", err)
		}
		return nil, status.Errorf(codes.Internal, "failed to get university: %v", err)
	}

	return toProtoUniversity(university), nil
}

func (s *UniversityGRPCServer) UpdateUniversity(ctx context.Context, req *pb.UpdateUniversityRequest) (*pb.UniversityMessage, error) {
	id, err := uuid.Parse(req.Id)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid id: %v", err)
	}

	university, err := s.service.UpdateUniversity(id, req.Name, req.City, req.Country, req.Website)
	if err != nil {
		if errors.Is(err, service.ErrUniversityNotFound) {
			return nil, status.Errorf(codes.NotFound, "university not found: %v", err)
		}
		return nil, status.Errorf(codes.Internal, "failed to update university: %v", err)
	}

	return toProtoUniversity(university), nil
}

func (s *UniversityGRPCServer) DeleteUniversity(ctx context.Context, req *pb.DeleteUniversityRequest) (*pb.DeleteResponse, error) {
	id, err := uuid.Parse(req.Id)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid id: %v", err)
	}

	if err := s.service.DeleteUniversity(id); err != nil {
		if errors.Is(err, service.ErrUniversityNotFound) {
			return nil, status.Errorf(codes.NotFound, "university not found: %v", err)
		}
		return nil, status.Errorf(codes.Internal, "failed to delete university: %v", err)
	}

	return &pb.DeleteResponse{Message: "university deleted successfully"}, nil
}

func toProtoUniversity(u *models.University) *pb.UniversityMessage {
	return &pb.UniversityMessage{
		Id:        u.ID.String(),
		Name:      u.Name,
		City:      u.City,
		Country:   u.Country,
		Website:   u.Website,
		CreatedAt: u.CreatedAt.String(),
		UpdatedAt: u.UpdatedAt.String(),
	}
}
