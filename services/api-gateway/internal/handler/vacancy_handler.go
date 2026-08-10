package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"api-gateway/internal/grpc/studentpb"
	"api-gateway/internal/grpc/vacancypb"
	"api-gateway/internal/match"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc/metadata"
)

type VacancyHandler struct {
	client        vacancypb.VacancyServiceClient
	studentClient studentpb.StudentServiceClient
}

func NewVacancyHandler(client vacancypb.VacancyServiceClient, studentClient studentpb.StudentServiceClient) *VacancyHandler {
	return &VacancyHandler{client: client, studentClient: studentClient}
}

// vacancyResp is the JSON shape returned to the frontend — skills as []string.
type vacancyResp struct {
	ID          string   `json:"id"`
	EmployerID  string   `json:"employer_id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Location    string   `json:"location"`
	SalaryMin   float64  `json:"salary_min"`
	SalaryMax   float64  `json:"salary_max"`
	JobType     string   `json:"job_type"`
	Skills      []string `json:"skills"`
	Status      string   `json:"status"`
	CreatedAt   string   `json:"created_at"`
	UpdatedAt   string   `json:"updated_at"`
	CompanyName string   `json:"company_name"`
	MatchScore  *int32   `json:"match_score,omitempty"`
}

func toVacancyResp(v *vacancypb.VacancyMessage) vacancyResp {
	return vacancyResp{
		ID:          v.GetId(),
		EmployerID:  v.GetEmployerId(),
		Title:       v.GetTitle(),
		Description: v.GetDescription(),
		Location:    v.GetLocation(),
		SalaryMin:   v.GetSalaryMin(),
		SalaryMax:   v.GetSalaryMax(),
		JobType:     v.GetJobType(),
		Skills:      splitSkills(v.GetSkills()),
		Status:      v.GetStatus(),
		CreatedAt:   v.GetCreatedAt(),
		UpdatedAt:   v.GetUpdatedAt(),
		CompanyName: v.GetCompanyName(),
	}
}

// skills accepts the "skills" JSON field as either a comma-separated string
// ("React, Go") or an array (["React","Go"]) and normalizes it to the
// comma-separated string the vacancy service stores. This keeps the API
// tolerant of both the web and mobile clients.
type skills string

func (s *skills) UnmarshalJSON(data []byte) error {
	// Try array first.
	var arr []string
	if err := json.Unmarshal(data, &arr); err == nil {
		*s = skills(strings.Join(arr, ","))
		return nil
	}
	// Fall back to a plain string.
	var str string
	if err := json.Unmarshal(data, &str); err != nil {
		return err
	}
	*s = skills(str)
	return nil
}

func splitSkills(s string) []string {
	if s == "" {
		return []string{}
	}
	parts := strings.Split(s, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}

func (h *VacancyHandler) CreateVacancy(c *gin.Context) {
	employerID := c.GetHeader("X-User-ID")
	employerRole := c.GetHeader("X-User-Role")

	var req struct {
		Title       string  `json:"title"`
		Description string  `json:"description"`
		Location    string  `json:"location"`
		SalaryMin   float64 `json:"salary_min"`
		SalaryMax   float64 `json:"salary_max"`
		JobType     string  `json:"job_type"`
		Skills      skills  `json:"skills"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := h.client.CreateVacancy(ctx, &vacancypb.CreateVacancyRequest{
		EmployerId:   employerID,
		EmployerRole: employerRole,
		Title:        req.Title,
		Description:  req.Description,
		Location:     req.Location,
		SalaryMin:    req.SalaryMin,
		SalaryMax:    req.SalaryMax,
		JobType:      req.JobType,
		Skills:       string(req.Skills),
	})
	if err != nil {
		handleGRPCError(c, err)
		return
	}

	c.JSON(http.StatusCreated, toVacancyResp(resp))
}

func (h *VacancyHandler) GetAllVacancies(c *gin.Context) {
	search := c.Query("search")
	jobType := c.Query("job_type")
	location := c.Query("location")
	salaryMinStr := c.Query("salary_min")
	salaryMaxStr := c.Query("salary_max")
	skillsStr := c.Query("skills") // comma-separated: ?skills=Python,Go

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	salaryMin, _ := strconv.Atoi(salaryMinStr)
	salaryMax, _ := strconv.Atoi(salaryMaxStr)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Pass salary and skills via gRPC metadata so filtering happens at DB level
	mdPairs := []string{}
	if salaryMin > 0 {
		mdPairs = append(mdPairs, "salary-min", strconv.Itoa(salaryMin))
	}
	if salaryMax > 0 {
		mdPairs = append(mdPairs, "salary-max", strconv.Itoa(salaryMax))
	}
	if skillsStr != "" {
		mdPairs = append(mdPairs, "skills", skillsStr)
	}
	if len(mdPairs) > 0 {
		ctx = metadata.NewOutgoingContext(ctx, metadata.Pairs(mdPairs...))
	}

	resp, err := h.client.GetAllVacancies(ctx, &vacancypb.GetAllVacanciesRequest{
		Search:   search,
		JobType:  jobType,
		Location: location,
		Page:     int32(page),
		PageSize: int32(pageSize),
	})
	if err != nil {
		handleGRPCError(c, err)
		return
	}

	// Fetch student skills for match score calculation (only for student role)
	studentSkills := ""
	if c.GetHeader("X-User-Role") == "student" {
		userID := c.GetHeader("X-User-ID")
		sCtx, sCancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer sCancel()
		if sp, err := h.studentClient.GetProfile(sCtx, &studentpb.GetProfileRequest{UserId: userID}); err == nil {
			studentSkills = sp.GetSkills()
		}
	}

	vacancies := make([]vacancyResp, 0, len(resp.GetVacancies()))
	for _, v := range resp.GetVacancies() {
		vr := toVacancyResp(v)
		if studentSkills != "" {
			score := match.CalculateMatchIndex(studentSkills, v.GetSkills())
			vr.MatchScore = &score
		}
		vacancies = append(vacancies, vr)
	}

	c.JSON(http.StatusOK, gin.H{
		"vacancies": vacancies,
		"total":     resp.GetTotal(),
		"page":      page,
		"page_size": pageSize,
	})
}

func (h *VacancyHandler) GetVacancyByID(c *gin.Context) {
	id := c.Param("id")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := h.client.GetVacancyByID(ctx, &vacancypb.GetByIDRequest{Id: id})
	if err != nil {
		handleGRPCError(c, err)
		return
	}

	c.JSON(http.StatusOK, toVacancyResp(resp))
}

func (h *VacancyHandler) GetMyVacancies(c *gin.Context) {
	employerID := c.GetHeader("X-User-ID")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := h.client.GetMyVacancies(ctx, &vacancypb.GetMyVacanciesRequest{EmployerId: employerID})
	if err != nil {
		handleGRPCError(c, err)
		return
	}

	vacancies := make([]vacancyResp, 0, len(resp.GetVacancies()))
	for _, v := range resp.GetVacancies() {
		vacancies = append(vacancies, toVacancyResp(v))
	}
	c.JSON(http.StatusOK, gin.H{"vacancies": vacancies})
}

func (h *VacancyHandler) UpdateVacancy(c *gin.Context) {
	id := c.Param("id")
	employerID := c.GetHeader("X-User-ID")

	var req struct {
		Title       string  `json:"title"`
		Description string  `json:"description"`
		Location    string  `json:"location"`
		SalaryMin   float64 `json:"salary_min"`
		SalaryMax   float64 `json:"salary_max"`
		JobType     string  `json:"job_type"`
		Skills      skills  `json:"skills"`
		Status      string  `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := h.client.UpdateVacancy(ctx, &vacancypb.UpdateVacancyRequest{
		Id:          id,
		EmployerId:  employerID,
		Title:       req.Title,
		Description: req.Description,
		Location:    req.Location,
		SalaryMin:   req.SalaryMin,
		SalaryMax:   req.SalaryMax,
		JobType:     req.JobType,
		Skills:      string(req.Skills),
		Status:      req.Status,
	})
	if err != nil {
		handleGRPCError(c, err)
		return
	}

	c.JSON(http.StatusOK, toVacancyResp(resp))
}

func (h *VacancyHandler) DeleteVacancy(c *gin.Context) {
	id := c.Param("id")
	employerID := c.GetHeader("X-User-ID")
	employerRole := c.GetHeader("X-User-Role")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := h.client.DeleteVacancy(ctx, &vacancypb.DeleteVacancyRequest{
		Id:           id,
		EmployerId:   employerID,
		EmployerRole: employerRole,
	})
	if err != nil {
		handleGRPCError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}
