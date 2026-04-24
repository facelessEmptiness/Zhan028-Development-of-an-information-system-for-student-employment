package handler

import (
	"context"
	"net/http"
	"slices"
	"strings"
	"time"

	"api-gateway/internal/grpc/applicationpb"
	"api-gateway/internal/grpc/studentpb"
	"api-gateway/internal/grpc/vacancypb"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc/metadata"
)

type AnalyticsHandler struct {
	studentClient     studentpb.StudentServiceClient
	vacancyClient     vacancypb.VacancyServiceClient
	applicationClient applicationpb.ApplicationServiceClient
}

func NewAnalyticsHandler(
	studentClient studentpb.StudentServiceClient,
	vacancyClient vacancypb.VacancyServiceClient,
	applicationClient applicationpb.ApplicationServiceClient,
) *AnalyticsHandler {
	return &AnalyticsHandler{
		studentClient:     studentClient,
		vacancyClient:     vacancyClient,
		applicationClient: applicationClient,
	}
}

type skillEntry struct {
	Skill string `json:"skill"`
	Count int    `json:"count"`
}

type jobTypeEntry struct {
	JobType string `json:"job_type"`
	Count   int    `json:"count"`
}

type locationEntry struct {
	Location string `json:"location"`
	Count    int    `json:"count"`
}

// GET /api/analytics/summary
func (h *AnalyticsHandler) GetSummary(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// If caller is a university user, scope student stats to their university
	universityID := c.GetHeader("X-University-ID")
	if universityID != "" {
		md := metadata.New(map[string]string{"university-id": universityID})
		ctx = metadata.NewOutgoingContext(ctx, md)
	}

	// --- Student stats ---
	studentStats, err := h.studentClient.GetStudentStats(ctx, &studentpb.StatsEmpty{})
	if err != nil {
		studentStats = nil
	}

	// --- Application stats ---
	appStats, err := h.applicationClient.GetApplicationStats(ctx, &applicationpb.AppStatsEmpty{})
	if err != nil {
		appStats = nil
	}

	// --- Vacancy data (fetch all for analytics) ---
	vacancyResp, err := h.vacancyClient.GetAllVacancies(ctx, &vacancypb.GetAllVacanciesRequest{
		Page:     1,
		PageSize: 500,
	})
	totalVacancies := int32(0)
	skillsMap := map[string]int{}
	jobTypesMap := map[string]int{}
	locationsMap := map[string]int{}

	if err == nil && vacancyResp != nil {
		totalVacancies = vacancyResp.Total
		for _, v := range vacancyResp.Vacancies {
			// Skills
			if v.Skills != "" {
				for _, s := range strings.Split(v.Skills, ",") {
					s = strings.TrimSpace(s)
					if s != "" {
						skillsMap[s]++
					}
				}
			}
			// Job types
			if v.JobType != "" {
				jobTypesMap[v.JobType]++
			}
			// Locations
			if v.Location != "" {
				locationsMap[v.Location]++
			}
		}
	}

	// Sort and convert maps to slices
	demandedSkills := sortedEntries(skillsMap, 15)
	jobTypesDist := sortedEntries(jobTypesMap, 10)
	locationsDist := sortedEntries(locationsMap, 10)

	// Build response
	resp := gin.H{
		"vacancies": gin.H{
			"total":            totalVacancies,
			"demanded_skills":  demandedSkills,
			"by_job_type":      jobTypesDist,
			"by_location":      locationsDist,
		},
	}

	if studentStats != nil {
		bySpec := make([]gin.H, 0, len(studentStats.BySpecialization))
		for _, s := range studentStats.BySpecialization {
			bySpec = append(bySpec, gin.H{"specialization": s.Specialization, "count": s.Count})
		}
		resp["students"] = gin.H{
			"total":              studentStats.Total,
			"by_specialization":  bySpec,
		}
	} else {
		resp["students"] = gin.H{"total": 0, "by_specialization": []gin.H{}}
	}

	if appStats != nil {
		byStatus := make([]gin.H, 0, len(appStats.ByStatus))
		for _, s := range appStats.ByStatus {
			byStatus = append(byStatus, gin.H{"status": s.Status, "count": s.Count})
		}
		resp["applications"] = gin.H{
			"total":         appStats.Total,
			"offered_count": appStats.OfferedCount,
			"by_status":     byStatus,
		}
	} else {
		resp["applications"] = gin.H{"total": 0, "offered_count": 0, "by_status": []gin.H{}}
	}

	c.JSON(http.StatusOK, resp)
}

// sortedEntries converts a map to a sorted slice of {name, count} limited to top N
func sortedEntries(m map[string]int, limit int) []gin.H {
	type kv struct{ k string; v int }
	sorted := make([]kv, 0, len(m))
	for k, v := range m {
		sorted = append(sorted, kv{k, v})
	}
	slices.SortFunc(sorted, func(a, b kv) int { return b.v - a.v })
	if limit > len(sorted) {
		limit = len(sorted)
	}
	result := make([]gin.H, 0, limit)
	for _, kv := range sorted[:limit] {
		result = append(result, gin.H{"name": kv.k, "count": kv.v})
	}
	return result
}
