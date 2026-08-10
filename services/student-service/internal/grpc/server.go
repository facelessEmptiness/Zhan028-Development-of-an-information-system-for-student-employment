package grpc

import (
	"context"
	"errors"
	"strings"

	"student-service/internal/dto"
	"student-service/internal/grpc/pb"
	"student-service/internal/models"
	"student-service/internal/repository"
	"student-service/internal/service"

	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

type StudentGRPCServer struct {
	pb.UnimplementedStudentServiceServer
	service *service.StudentService
}

func NewStudentGRPCServer(svc *service.StudentService) *StudentGRPCServer {
	return &StudentGRPCServer{service: svc}
}

func (s *StudentGRPCServer) CreateProfile(ctx context.Context, req *pb.CreateProfileRequest) (*pb.StudentResponse, error) {
	userID, err := uuid.Parse(req.UserId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user_id: %v", err)
	}

	student, err := s.service.CreateProfile(userID, dto.CreateProfileRequest{
		FirstName:      req.FirstName,
		LastName:       req.LastName,
		IIN:            req.Iin,
		UniversityID:   req.UniversityId,
		Skills:         req.Skills,
		GPA:            req.Gpa,
		Specialization: req.Specialization,
		GraduationYear: int(req.GraduationYear),
		Bio:            req.Bio,
		Phone:          req.Phone,
		LocationCity:   req.LocationCity,
	})
	if err != nil {
		if errors.Is(err, service.ErrProfileAlreadyExists) {
			return nil, status.Error(codes.AlreadyExists, err.Error())
		}
		if errors.Is(err, service.ErrIINAlreadyTaken) {
			return nil, status.Error(codes.AlreadyExists, err.Error())
		}
		return nil, status.Errorf(codes.Internal, "failed to create profile: %v", err)
	}

	return toProtoStudent(student), nil
}

func (s *StudentGRPCServer) GetProfile(ctx context.Context, req *pb.GetProfileRequest) (*pb.StudentResponse, error) {
	userID, err := uuid.Parse(req.UserId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user_id: %v", err)
	}

	student, err := s.service.GetProfile(userID)
	if err != nil {
		if errors.Is(err, repository.ErrStudentNotFound) {
			return nil, status.Errorf(codes.NotFound, "profile not found")
		}
		return nil, status.Errorf(codes.Internal, "failed to get profile: %v", err)
	}

	return toProtoStudent(student), nil
}

func (s *StudentGRPCServer) GetByID(ctx context.Context, req *pb.GetByIDRequest) (*pb.StudentResponse, error) {
	id, err := uuid.Parse(req.Id)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid id: %v", err)
	}

	student, err := s.service.GetByID(id)
	if err != nil {
		if errors.Is(err, repository.ErrStudentNotFound) {
			return nil, status.Errorf(codes.NotFound, "student not found")
		}
		return nil, status.Errorf(codes.Internal, "failed to get student: %v", err)
	}

	return toProtoStudent(student), nil
}

func (s *StudentGRPCServer) UpdateProfile(ctx context.Context, req *pb.UpdateProfileRequest) (*pb.StudentResponse, error) {
	userID, err := uuid.Parse(req.UserId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user_id: %v", err)
	}

	student, err := s.service.UpdateProfile(userID, dto.UpdateProfileRequest{
		FirstName:      req.FirstName,
		LastName:       req.LastName,
		UniversityID:   req.UniversityId,
		Skills:         req.Skills,
		GPA:            req.Gpa,
		Specialization: req.Specialization,
		GraduationYear: int(req.GraduationYear),
		Bio:            req.Bio,
		Phone:          req.Phone,
		LocationCity:   req.LocationCity,
	})
	if err != nil {
		if errors.Is(err, repository.ErrStudentNotFound) {
			return nil, status.Errorf(codes.NotFound, "profile not found")
		}
		return nil, status.Errorf(codes.Internal, "failed to update profile: %v", err)
	}

	return toProtoStudent(student), nil
}

func (s *StudentGRPCServer) GetStudentStats(ctx context.Context, _ *pb.StatsEmpty) (*pb.StudentStatsResponse, error) {
	// Check if caller passed university_id via gRPC metadata for scoped queries
	universityIDStr := ""
	if md, ok := metadata.FromIncomingContext(ctx); ok {
		if vals := md.Get("university-id"); len(vals) > 0 {
			universityIDStr = vals[0]
		}
	}

	var total int64
	var bySpec []repository.SpecializationCount
	var err error

	if universityIDStr != "" {
		uniID, parseErr := uuid.Parse(universityIDStr)
		if parseErr == nil {
			total, err = s.service.Repo.CountAllByUniversityID(uniID)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to count students: %v", err)
			}
			bySpec, err = s.service.Repo.CountBySpecializationAndUniversityID(uniID)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to count by specialization: %v", err)
			}
		}
	} else {
		total, err = s.service.Repo.CountAll()
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to count students: %v", err)
		}
		bySpec, err = s.service.Repo.CountBySpecialization()
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to count by specialization: %v", err)
		}
	}

	resp := &pb.StudentStatsResponse{Total: int32(total)}
	for _, item := range bySpec {
		resp.BySpecialization = append(resp.BySpecialization, &pb.SpecializationCount{
			Specialization: item.Specialization,
			Count:          int32(item.Count),
		})
	}
	return resp, nil
}

func (s *StudentGRPCServer) GetStudentsByUniversity(_ *pb.StatsEmpty, stream pb.StudentService_GetStudentsByUniversityServer) error {
	// Read university_id from gRPC metadata
	universityIDStr := ""
	if md, ok := metadata.FromIncomingContext(stream.Context()); ok {
		if vals := md.Get("university-id"); len(vals) > 0 {
			universityIDStr = vals[0]
		}
	}

	if universityIDStr == "" {
		return status.Errorf(codes.InvalidArgument, "university_id is required")
	}

	uniID, err := uuid.Parse(universityIDStr)
	if err != nil {
		return status.Errorf(codes.InvalidArgument, "invalid university_id: %v", err)
	}

	students, err := s.service.Repo.ListByUniversityID(uniID)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to list students: %v", err)
	}

	for _, student := range students {
		if err := stream.Send(toProtoStudent(student)); err != nil {
			return err
		}
	}
	return nil
}

func toProtoStudent(s *models.Student) *pb.StudentResponse {
	uniID := ""
	if s.UniversityID != nil {
		uniID = s.UniversityID.String()
	}
	return &pb.StudentResponse{
		Id:             s.ID.String(),
		UserId:         s.UserID.String(),
		FirstName:      s.FirstName,
		LastName:       s.LastName,
		Iin:            s.IIN,
		UniversityId:   uniID,
		Skills:         strings.Join([]string(s.Skills), ","),
		CreatedAt:      s.CreatedAt.String(),
		UpdatedAt:      s.UpdatedAt.String(),
		Gpa:            s.GPA,
		Specialization: s.Specialization,
		GraduationYear: int32(s.GraduationYear),
		Bio:            s.Bio,
		Phone:          s.Phone,
		LocationCity:   s.LocationCity,
	}
}
