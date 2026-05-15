package handler

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"api-gateway/internal/grpc/vacancypb"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc/metadata"
)

type VacancyHandler struct {
	client vacancypb.VacancyServiceClient
}

func NewVacancyHandler(client vacancypb.VacancyServiceClient) *VacancyHandler {
	return &VacancyHandler{client: client}
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
		Title       string   `json:"title"`
		Description string   `json:"description"`
		Location    string   `json:"location"`
		SalaryMin   float64  `json:"salary_min"`
		SalaryMax   float64  `json:"salary_max"`
		JobType     string   `json:"job_type"`
		Skills      []string `json:"skills"`
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
		Skills:       strings.Join(req.Skills, ","),
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

	vacancies := make([]vacancyResp, 0, len(resp.GetVacancies()))
	for _, v := range resp.GetVacancies() {
		vacancies = append(vacancies, toVacancyResp(v))
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
		Title       string   `json:"title"`
		Description string   `json:"description"`
		Location    string   `json:"location"`
		SalaryMin   float64  `json:"salary_min"`
		SalaryMax   float64  `json:"salary_max"`
		JobType     string   `json:"job_type"`
		Skills      []string `json:"skills"`
		Status      string   `json:"status"`
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
		Skills:      strings.Join(req.Skills, ","),
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
