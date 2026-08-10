package grpc

import (
	"application-service/internal/grpc/pb"
	"application-service/internal/models"
	"application-service/internal/repository"
	"application-service/internal/service"
	"context"
	"errors"

	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type ApplicationGRPCServer struct {
	pb.UnimplementedApplicationServiceServer
	service service.ApplicationService
	repo    repository.ApplicationRepository
}

func NewApplicationGRPCServer(svc service.ApplicationService, repo repository.ApplicationRepository) *ApplicationGRPCServer {
	return &ApplicationGRPCServer{service: svc, repo: repo}
}

func (s *ApplicationGRPCServer) GetApplicationStats(ctx context.Context, _ *pb.AppStatsEmpty) (*pb.ApplicationStatsResponse, error) {
	total, err := s.repo.CountAll()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count applications: %v", err)
	}

	byStatus, err := s.repo.CountByStatus()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count by status: %v", err)
	}

	resp := &pb.ApplicationStatsResponse{Total: int32(total)}
	for _, item := range byStatus {
		resp.ByStatus = append(resp.ByStatus, &pb.StatusCount{
			Status: item.Status,
			Count:  int32(item.Count),
		})
		if item.Status == "offered" {
			resp.OfferedCount = int32(item.Count)
		}
	}
	return resp, nil
}

func (s *ApplicationGRPCServer) Apply(ctx context.Context, req *pb.ApplyRequest) (*pb.ApplicationMessage, error) {
	studentID, err := uuid.Parse(req.StudentId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid student_id: %v", err)
	}

	vacancyID, err := uuid.Parse(req.VacancyId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid vacancy_id: %v", err)
	}

	employerID, err := uuid.Parse(req.EmployerId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid employer_id: %v", err)
	}

	app, err := s.service.Apply(studentID, vacancyID, employerID, req.CoverLetter, req.MatchScore)
	if err != nil {
		if errors.Is(err, service.ErrAlreadyApplied) {
			return nil, status.Error(codes.AlreadyExists, err.Error())
		}
		return nil, status.Errorf(codes.Internal, "failed to apply: %v", err)
	}

	return toProtoApplication(app), nil
}

func (s *ApplicationGRPCServer) GetMyApplications(ctx context.Context, req *pb.GetMyApplicationsRequest) (*pb.ApplicationsResponse, error) {
	studentID, err := uuid.Parse(req.StudentId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid student_id: %v", err)
	}

	apps, err := s.service.GetMyApplications(studentID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get applications: %v", err)
	}

	resp := &pb.ApplicationsResponse{}
	for _, a := range apps {
		resp.Applications = append(resp.Applications, toProtoApplication(&a))
	}
	return resp, nil
}

func (s *ApplicationGRPCServer) GetVacancyApplications(ctx context.Context, req *pb.GetVacancyApplicationsRequest) (*pb.ApplicationsResponse, error) {
	vacancyID, err := uuid.Parse(req.VacancyId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid vacancy_id: %v", err)
	}

	apps, err := s.service.GetVacancyApplications(vacancyID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get applications: %v", err)
	}

	resp := &pb.ApplicationsResponse{}
	for _, a := range apps {
		resp.Applications = append(resp.Applications, toProtoApplication(&a))
	}
	return resp, nil
}

func (s *ApplicationGRPCServer) UpdateStatus(ctx context.Context, req *pb.UpdateStatusRequest) (*pb.ApplicationMessage, error) {
	id, err := uuid.Parse(req.Id)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid id: %v", err)
	}

	employerID, err := uuid.Parse(req.EmployerId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid employer_id: %v", err)
	}

	app, err := s.service.UpdateStatus(id, employerID, req.Status)
	if err != nil {
		if errors.Is(err, service.ErrApplicationNotFound) {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		if errors.Is(err, service.ErrForbidden) {
			return nil, status.Error(codes.PermissionDenied, err.Error())
		}
		return nil, status.Errorf(codes.Internal, "failed to update status: %v", err)
	}

	return toProtoApplication(app), nil
}

func (s *ApplicationGRPCServer) Withdraw(ctx context.Context, req *pb.WithdrawRequest) (*pb.DeleteResponse, error) {
	id, err := uuid.Parse(req.Id)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid id: %v", err)
	}

	studentID, err := uuid.Parse(req.StudentId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid student_id: %v", err)
	}

	if err := s.service.Withdraw(id, studentID); err != nil {
		if errors.Is(err, service.ErrApplicationNotFound) {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		if errors.Is(err, service.ErrForbidden) {
			return nil, status.Error(codes.PermissionDenied, err.Error())
		}
		return nil, status.Errorf(codes.Internal, "failed to withdraw application: %v", err)
	}

	return &pb.DeleteResponse{Message: "application withdrawn successfully"}, nil
}

func toProtoApplication(a *models.Application) *pb.ApplicationMessage {
	return &pb.ApplicationMessage{
		Id:          a.ID.String(),
		StudentId:   a.StudentID.String(),
		VacancyId:   a.VacancyID.String(),
		EmployerId:  a.EmployerID.String(),
		Status:      a.Status,
		CoverLetter: a.CoverLetter,
		MatchScore:  a.MatchScore,
		CreatedAt:   a.CreatedAt.String(),
		UpdatedAt:   a.UpdatedAt.String(),
	}
}
