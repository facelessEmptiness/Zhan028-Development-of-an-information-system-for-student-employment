package handler

import (
	"errors"
	"net/http"
	"employer-service/internal/dto"
	"employer-service/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type VacancyHandler struct {
	service service.VacancyService
}

func NewVacancyHandler(svc service.VacancyService) *VacancyHandler {
	return &VacancyHandler{service: svc}
}

// POST /vacancies
func (h *VacancyHandler) CreateVacancy(c *gin.Context) {
	role := c.GetHeader("X-User-Role")
	if role != "employer" {
		c.JSON(http.StatusForbidden, gin.H{"error": "только работодатели могут создавать вакансии"})
		return
	}

	userIDStr := c.GetHeader("X-User-ID")
	employerID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "некорректный идентификатор пользователя"})
		return
	}

	var req dto.CreateVacancyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	vacancy, err := h.service.CreateVacancy(employerID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, vacancy)
}

// GET /vacancies
func (h *VacancyHandler) GetAllVacancies(c *gin.Context) {
	vacancies, _, err := h.service.GetAllVacancies(service.SearchParams{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, vacancies)
}

// GET /vacancies/my
func (h *VacancyHandler) GetMyVacancies(c *gin.Context) {
	userIDStr := c.GetHeader("X-User-ID")
	employerID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "некорректный идентификатор пользователя"})
		return
	}

	vacancies, err := h.service.GetMyVacancies(employerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, vacancies)
}

// GET /vacancies/:id
func (h *VacancyHandler) GetVacancyByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "некорректный ID вакансии"})
		return
	}

	vacancy, err := h.service.GetVacancyByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "вакансия не найдена"})
		return
	}
	c.JSON(http.StatusOK, vacancy)
}

// PUT /vacancies/:id
func (h *VacancyHandler) UpdateVacancy(c *gin.Context) {
	role := c.GetHeader("X-User-Role")
	if role != "employer" {
		c.JSON(http.StatusForbidden, gin.H{"error": "только работодатели могут редактировать вакансии"})
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "некорректный ID вакансии"})
		return
	}

	userIDStr := c.GetHeader("X-User-ID")
	employerID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "некорректный идентификатор пользователя"})
		return
	}

	var req dto.UpdateVacancyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	vacancy, err := h.service.UpdateVacancy(id, employerID, &req)
	if err != nil {
		if errors.Is(err, service.ErrAccessDenied) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, vacancy)
}

// DELETE /vacancies/:id
func (h *VacancyHandler) DeleteVacancy(c *gin.Context) {
	role := c.GetHeader("X-User-Role")
	if role != "employer" {
		c.JSON(http.StatusForbidden, gin.H{"error": "только работодатели могут удалять вакансии"})
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "некорректный ID вакансии"})
		return
	}

	userIDStr := c.GetHeader("X-User-ID")
	employerID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "некорректный идентификатор пользователя"})
		return
	}

	if err := h.service.DeleteVacancy(id, employerID); err != nil {
		if errors.Is(err, service.ErrAccessDenied) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "вакансия удалена"})
}
