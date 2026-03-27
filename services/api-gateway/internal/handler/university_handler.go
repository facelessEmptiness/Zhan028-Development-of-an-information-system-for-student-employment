package handler

import (
	"context"
	"net/http"
	"time"

	"api-gateway/internal/grpc/universitypb"

	"github.com/gin-gonic/gin"
)

type UniversityHandler struct {
	client universitypb.UniversityServiceClient
}

func NewUniversityHandler(client universitypb.UniversityServiceClient) *UniversityHandler {
	return &UniversityHandler{client: client}
}

func (h *UniversityHandler) CreateUniversity(c *gin.Context) {
	var req struct {
		Name    string `json:"name"`
		City    string `json:"city"`
		Country string `json:"country"`
		Website string `json:"website"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := h.client.CreateUniversity(ctx, &universitypb.CreateUniversityRequest{
		Name:    req.Name,
		City:    req.City,
		Country: req.Country,
		Website: req.Website,
	})
	if err != nil {
		handleGRPCError(c, err)
		return
	}

	c.JSON(http.StatusCreated, resp)
}

func (h *UniversityHandler) GetAllUniversities(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := h.client.GetAllUniversities(ctx, &universitypb.Empty{})
	if err != nil {
		handleGRPCError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *UniversityHandler) GetUniversityByID(c *gin.Context) {
	id := c.Param("id")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := h.client.GetUniversityByID(ctx, &universitypb.GetByIDRequest{Id: id})
	if err != nil {
		handleGRPCError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *UniversityHandler) UpdateUniversity(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		Name    string `json:"name"`
		City    string `json:"city"`
		Country string `json:"country"`
		Website string `json:"website"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := h.client.UpdateUniversity(ctx, &universitypb.UpdateUniversityRequest{
		Id:      id,
		Name:    req.Name,
		City:    req.City,
		Country: req.Country,
		Website: req.Website,
	})
	if err != nil {
		handleGRPCError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *UniversityHandler) DeleteUniversity(c *gin.Context) {
	id := c.Param("id")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := h.client.DeleteUniversity(ctx, &universitypb.DeleteUniversityRequest{Id: id})
	if err != nil {
		handleGRPCError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}
