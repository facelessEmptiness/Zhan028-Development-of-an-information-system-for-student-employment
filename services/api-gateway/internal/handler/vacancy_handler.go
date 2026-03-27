package handler

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"api-gateway/internal/grpc/vacancypb"

	"github.com/gin-gonic/gin"
)

type VacancyHandler struct {
	client vacancypb.VacancyServiceClient
}

func NewVacancyHandler(client vacancypb.VacancyServiceClient) *VacancyHandler {
	return &VacancyHandler{client: client}
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
		Skills      string  `json:"skills"`
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
		Skills:       req.Skills,
	})
	if err != nil {
		handleGRPCError(c, err)
		return
	}

	c.JSON(http.StatusCreated, resp)
}

func (h *VacancyHandler) GetAllVacancies(c *gin.Context) {
	search := c.Query("search")
	jobType := c.Query("job_type")
	location := c.Query("location")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

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

	c.JSON(http.StatusOK, gin.H{
		"vacancies": resp.Vacancies,
		"total":     resp.Total,
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

	c.JSON(http.StatusOK, resp)
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

	c.JSON(http.StatusOK, resp)
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
		Skills      string  `json:"skills"`
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
		Skills:      req.Skills,
		Status:      req.Status,
	})
	if err != nil {
		handleGRPCError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
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
