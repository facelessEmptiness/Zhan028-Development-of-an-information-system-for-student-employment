package handler

import (
	"context"
	"net/http"
	"time"

	"api-gateway/internal/grpc/vacancypb"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type EmployerProfileHandler struct {
	client vacancypb.VacancyServiceClient
}

func NewEmployerProfileHandler(client vacancypb.VacancyServiceClient) *EmployerProfileHandler {
	return &EmployerProfileHandler{client: client}
}

func (h *EmployerProfileHandler) GetProfile(c *gin.Context) {
	employerID := c.GetHeader("X-User-ID")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := h.client.GetEmployerProfile(ctx, &vacancypb.GetEmployerProfileRequest{
		EmployerId: employerID,
	})
	if err != nil {
		st, _ := status.FromError(err)
		if st.Code() == codes.NotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "profile not found"})
			return
		}
		handleGRPCError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *EmployerProfileHandler) CreateProfile(c *gin.Context) {
	employerID := c.GetHeader("X-User-ID")

	var req struct {
		CompanyName        string `json:"company_name"`
		CompanyDescription string `json:"company_description"`
		Industry           string `json:"industry"`
		CompanySize        string `json:"company_size"`
		Website            string `json:"website"`
		Location           string `json:"location"`
		ContactEmail       string `json:"contact_email"`
		ContactPhone       string `json:"contact_phone"`
		BIN                string `json:"bin"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := h.client.CreateEmployerProfile(ctx, &vacancypb.CreateEmployerProfileRequest{
		EmployerId:         employerID,
		CompanyName:        req.CompanyName,
		CompanyDescription: req.CompanyDescription,
		Industry:           req.Industry,
		CompanySize:        req.CompanySize,
		Website:            req.Website,
		Location:           req.Location,
		ContactEmail:       req.ContactEmail,
		ContactPhone:       req.ContactPhone,
		Bin:                req.BIN,
	})
	if err != nil {
		handleGRPCError(c, err)
		return
	}

	c.JSON(http.StatusCreated, resp)
}

func (h *EmployerProfileHandler) UpdateProfile(c *gin.Context) {
	employerID := c.GetHeader("X-User-ID")

	var req struct {
		CompanyName        string `json:"company_name"`
		CompanyDescription string `json:"company_description"`
		Industry           string `json:"industry"`
		CompanySize        string `json:"company_size"`
		Website            string `json:"website"`
		Location           string `json:"location"`
		ContactEmail       string `json:"contact_email"`
		ContactPhone       string `json:"contact_phone"`
		BIN                string `json:"bin"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := h.client.UpdateEmployerProfile(ctx, &vacancypb.UpdateEmployerProfileRequest{
		EmployerId:         employerID,
		CompanyName:        req.CompanyName,
		CompanyDescription: req.CompanyDescription,
		Industry:           req.Industry,
		CompanySize:        req.CompanySize,
		Website:            req.Website,
		Location:           req.Location,
		ContactEmail:       req.ContactEmail,
		ContactPhone:       req.ContactPhone,
		Bin:                req.BIN,
	})
	if err != nil {
		handleGRPCError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}
