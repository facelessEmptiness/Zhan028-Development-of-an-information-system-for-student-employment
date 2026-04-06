package grpc

import (
	"context"
	"errors"
	"employer-service/internal/dto"
	"employer-service/internal/grpc/pb"
	"employer-service/internal/models"
	"employer-service/internal/repository"
	"employer-service/internal/service"

	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type VacancyGRPCServer struct {
	pb.UnimplementedVacancyServiceServer
	service    service.VacancyService
	profileSvc service.EmployerProfileService
}

func NewVacancyGRPCServer(svc service.VacancyService, profileSvc service.EmployerProfileService) *VacancyGRPCServer {
	return &VacancyGRPCServer{service: svc, profileSvc: profileSvc}
}

func (s *VacancyGRPCServer) CreateVacancy(ctx context.Context, req *pb.CreateVacancyRequest) (*pb.VacancyMessage, error) {
	employerID, err := uuid.Parse(req.EmployerId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid employer_id: %v", err)
	}

	if req.EmployerRole != "employer" {
		return nil, status.Errorf(codes.PermissionDenied, "only employers can create vacancies")
	}

	vacancy, err := s.service.CreateVacancy(employerID, &dto.CreateVacancyRequest{
		Title:       req.Title,
		Description: req.Description,
		Location:    req.Location,
		SalaryMin:   int(req.SalaryMin),
		SalaryMax:   int(req.SalaryMax),
		JobType:     req.JobType,
		Skills:      req.Skills,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create vacancy: %v", err)
	}

	return s.toProtoVacancy(vacancy), nil
}

func (s *VacancyGRPCServer) GetAllVacancies(ctx context.Context, req *pb.GetAllVacanciesRequest) (*pb.VacanciesResponse, error) {
	vacancies, total, err := s.service.GetAllVacancies(service.SearchParams{
		Search:   req.Search,
		JobType:  req.JobType,
		Location: req.Location,
		Page:     int(req.Page),
		PageSize: int(req.PageSize),
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get vacancies: %v", err)
	}

	resp := &pb.VacanciesResponse{Total: int32(total)}
	for _, v := range vacancies {
		v := v
		resp.Vacancies = append(resp.Vacancies, s.toProtoVacancy(&v))
	}
	return resp, nil
}

func (s *VacancyGRPCServer) GetVacancyByID(ctx context.Context, req *pb.GetByIDRequest) (*pb.VacancyMessage, error) {
	id, err := uuid.Parse(req.Id)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid id: %v", err)
	}

	vacancy, err := s.service.GetVacancyByID(id)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "vacancy not found: %v", err)
	}

	return s.toProtoVacancy(vacancy), nil
}

func (s *VacancyGRPCServer) GetMyVacancies(ctx context.Context, req *pb.GetMyVacanciesRequest) (*pb.VacanciesResponse, error) {
	employerID, err := uuid.Parse(req.EmployerId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid employer_id: %v", err)
	}

	vacancies, err := s.service.GetMyVacancies(employerID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get vacancies: %v", err)
	}

	resp := &pb.VacanciesResponse{}
	for _, v := range vacancies {
		v := v
		resp.Vacancies = append(resp.Vacancies, s.toProtoVacancy(&v))
	}
	return resp, nil
}

func (s *VacancyGRPCServer) UpdateVacancy(ctx context.Context, req *pb.UpdateVacancyRequest) (*pb.VacancyMessage, error) {
	id, err := uuid.Parse(req.Id)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid id: %v", err)
	}

	employerID, err := uuid.Parse(req.EmployerId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid employer_id: %v", err)
	}

	vacancy, err := s.service.UpdateVacancy(id, employerID, &dto.UpdateVacancyRequest{
		Title:       req.Title,
		Description: req.Description,
		Location:    req.Location,
		SalaryMin:   int(req.SalaryMin),
		SalaryMax:   int(req.SalaryMax),
		JobType:     req.JobType,
		Skills:      req.Skills,
		Status:      req.Status,
	})
	if err != nil {
		if errors.Is(err, errors.New("доступ запрещён")) {
			return nil, status.Errorf(codes.PermissionDenied, err.Error())
		}
		return nil, status.Errorf(codes.Internal, "failed to update vacancy: %v", err)
	}

	return s.toProtoVacancy(vacancy), nil
}

func (s *VacancyGRPCServer) DeleteVacancy(ctx context.Context, req *pb.DeleteVacancyRequest) (*pb.DeleteResponse, error) {
	id, err := uuid.Parse(req.Id)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid id: %v", err)
	}

	employerID, err := uuid.Parse(req.EmployerId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid employer_id: %v", err)
	}

	if req.EmployerRole == "admin" {
		vacancy, err := s.service.GetVacancyByID(id)
		if err != nil {
			return nil, status.Errorf(codes.NotFound, "vacancy not found: %v", err)
		}
		employerID = vacancy.EmployerID
	}

	if err := s.service.DeleteVacancy(id, employerID); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete vacancy: %v", err)
	}

	return &pb.DeleteResponse{Message: "vacancy deleted successfully"}, nil
}

// ---------- Employer Profile ----------

func (s *VacancyGRPCServer) GetEmployerProfile(ctx context.Context, req *pb.GetEmployerProfileRequest) (*pb.EmployerProfileMessage, error) {
	employerID, err := uuid.Parse(req.EmployerId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid employer_id: %v", err)
	}

	profile, err := s.profileSvc.GetProfile(employerID)
	if err != nil {
		if errors.Is(err, repository.ErrProfileNotFound) {
			return nil, status.Errorf(codes.NotFound, "profile not found")
		}
		return nil, status.Errorf(codes.Internal, "failed to get profile: %v", err)
	}

	return toProtoProfile(profile), nil
}

func (s *VacancyGRPCServer) CreateEmployerProfile(ctx context.Context, req *pb.CreateEmployerProfileRequest) (*pb.EmployerProfileMessage, error) {
	employerID, err := uuid.Parse(req.EmployerId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid employer_id: %v", err)
	}

	profile := &models.EmployerProfile{
		EmployerID:         employerID,
		CompanyName:        req.CompanyName,
		CompanyDescription: req.CompanyDescription,
		Industry:           req.Industry,
		CompanySize:        req.CompanySize,
		Website:            req.Website,
		Location:           req.Location,
		ContactEmail:       req.ContactEmail,
		ContactPhone:       req.ContactPhone,
		BIN:                req.Bin,
	}

	created, err := s.profileSvc.CreateProfile(profile)
	if err != nil {
		if errors.Is(err, service.ErrBINInvalidFormat) || errors.Is(err, service.ErrBINInvalidValue) || errors.Is(err, service.ErrBINTaken) {
			return nil, status.Errorf(codes.InvalidArgument, err.Error())
		}
		return nil, status.Errorf(codes.Internal, "failed to create profile: %v", err)
	}

	return toProtoProfile(created), nil
}

func (s *VacancyGRPCServer) UpdateEmployerProfile(ctx context.Context, req *pb.UpdateEmployerProfileRequest) (*pb.EmployerProfileMessage, error) {
	employerID, err := uuid.Parse(req.EmployerId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid employer_id: %v", err)
	}

	updates := &models.EmployerProfile{
		CompanyName:        req.CompanyName,
		CompanyDescription: req.CompanyDescription,
		Industry:           req.Industry,
		CompanySize:        req.CompanySize,
		Website:            req.Website,
		Location:           req.Location,
		ContactEmail:       req.ContactEmail,
		ContactPhone:       req.ContactPhone,
		BIN:                req.Bin,
	}

	updated, err := s.profileSvc.UpdateProfile(employerID, updates)
	if err != nil {
		if errors.Is(err, repository.ErrProfileNotFound) {
			return nil, status.Errorf(codes.NotFound, "profile not found")
		}
		if errors.Is(err, service.ErrBINInvalidFormat) || errors.Is(err, service.ErrBINInvalidValue) || errors.Is(err, service.ErrBINTaken) {
			return nil, status.Errorf(codes.InvalidArgument, err.Error())
		}
		return nil, status.Errorf(codes.Internal, "failed to update profile: %v", err)
	}

	return toProtoProfile(updated), nil
}

// ---------- Helpers ----------

func (s *VacancyGRPCServer) toProtoVacancy(v *models.Vacancy) *pb.VacancyMessage {
	companyName := ""
	if s.profileSvc != nil {
		if p, err := s.profileSvc.GetProfile(v.EmployerID); err == nil {
			companyName = p.CompanyName
		}
	}

	return &pb.VacancyMessage{
		Id:          v.ID.String(),
		EmployerId:  v.EmployerID.String(),
		Title:       v.Title,
		Description: v.Description,
		Location:    v.Location,
		SalaryMin:   float64(v.SalaryMin),
		SalaryMax:   float64(v.SalaryMax),
		JobType:     v.JobType,
		Skills:      v.Skills,
		Status:      v.Status,
		CreatedAt:   v.CreatedAt.String(),
		UpdatedAt:   v.UpdatedAt.String(),
		CompanyName: companyName,
	}
}

func toProtoProfile(p *models.EmployerProfile) *pb.EmployerProfileMessage {
	return &pb.EmployerProfileMessage{
		EmployerId:         p.EmployerID.String(),
		CompanyName:        p.CompanyName,
		CompanyDescription: p.CompanyDescription,
		Industry:           p.Industry,
		CompanySize:        p.CompanySize,
		Website:            p.Website,
		Location:           p.Location,
		ContactEmail:       p.ContactEmail,
		ContactPhone:       p.ContactPhone,
		Bin:                p.BIN,
		BinStatus:          p.BINStatus,
		CreatedAt:          p.CreatedAt.String(),
		UpdatedAt:          p.UpdatedAt.String(),
	}
}
