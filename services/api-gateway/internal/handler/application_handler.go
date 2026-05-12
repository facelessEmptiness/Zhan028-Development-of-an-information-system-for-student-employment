package handler

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"api-gateway/internal/grpc/applicationpb"
	"api-gateway/internal/grpc/studentpb"
	"api-gateway/internal/grpc/vacancypb"
	"api-gateway/internal/match"
	"github.com/gin-gonic/gin"
)

type ApplicationHandler struct {
	appClient     applicationpb.ApplicationServiceClient
	studentClient studentpb.StudentServiceClient
	vacancyClient vacancypb.VacancyServiceClient
	notif         *NotificationClient
	appHTTPURL    string
}

func NewApplicationHandler(
	appClient applicationpb.ApplicationServiceClient,
	studentClient studentpb.StudentServiceClient,
	vacancyClient vacancypb.VacancyServiceClient,
	notif *NotificationClient,
	appHTTPURL string,
) *ApplicationHandler {
	return &ApplicationHandler{
		appClient:     appClient,
		studentClient: studentClient,
		vacancyClient: vacancyClient,
		notif:         notif,
		appHTTPURL:    appHTTPURL,
	}
}

// POST /api/applications - student applies to a vacancy
func (h *ApplicationHandler) Apply(c *gin.Context) {
	studentID := c.GetHeader("X-User-ID")
	role := c.GetHeader("X-User-Role")
	if role != "student" {
		c.JSON(http.StatusForbidden, gin.H{"error": "только студенты могут подавать заявки"})
		return
	}

	var req struct {
		VacancyID   string `json:"vacancy_id" binding:"required"`
		CoverLetter string `json:"cover_letter"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Fetch student skills
	var studentSkills string
	sCtx, sCancel := context.WithTimeout(context.Background(), 3*time.Second)
	studentResp, sErr := h.studentClient.GetProfile(sCtx, &studentpb.GetProfileRequest{UserId: studentID})
	sCancel()
	if sErr == nil && studentResp != nil {
		studentSkills = studentResp.Skills
	}

	// Fetch vacancy skills
	var vacancySkills string
	vCtx, vCancel := context.WithTimeout(context.Background(), 3*time.Second)
	vacancyResp, vErr := h.vacancyClient.GetVacancyByID(vCtx, &vacancypb.GetByIDRequest{Id: req.VacancyID})
	vCancel()
	if vErr == nil && vacancyResp != nil {
		vacancySkills = vacancyResp.Skills
	}

	// Calculate match score
	matchScore := match.CalculateMatchIndex(studentSkills, vacancySkills)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	employerID := ""
	if vErr == nil && vacancyResp != nil {
		employerID = vacancyResp.GetEmployerId()
	}
	if employerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "vacancy not found"})
		return
	}

	resp, err := h.appClient.Apply(ctx, &applicationpb.ApplyRequest{
		StudentId:   studentID,
		VacancyId:   req.VacancyID,
		EmployerId:  employerID,
		CoverLetter: req.CoverLetter,
		MatchScore:  matchScore,
	})
	if err != nil {
		handleGRPCError(c, err)
		return
	}

	// Notify student: application submitted successfully
	go h.notif.Send(
		studentID,
		"application_submitted",
		"Заявка подана ✅",
		"Ваша заявка успешно отправлена. Match Score: "+fmt.Sprintf("%d%%", matchScore),
		resp.GetId(),
	)

	c.JSON(http.StatusCreated, resp)
}

// GET /api/applications/my - student sees their own applications
func (h *ApplicationHandler) GetMyApplications(c *gin.Context) {
	studentID := c.GetHeader("X-User-ID")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := h.appClient.GetMyApplications(ctx, &applicationpb.GetMyApplicationsRequest{
		StudentId: studentID,
	})
	if err != nil {
		handleGRPCError(c, err)
		return
	}
	c.JSON(http.StatusOK, resp)
}

// GET /api/applications/vacancy/:vacancy_id - employer sees applications for their vacancy (enriched with student data)
func (h *ApplicationHandler) GetVacancyApplications(c *gin.Context) {
	employerID := c.GetHeader("X-User-ID")
	role := c.GetHeader("X-User-Role")
	if role != "employer" {
		c.JSON(http.StatusForbidden, gin.H{"error": "доступ запрещён"})
		return
	}
	vacancyID := c.Param("vacancy_id")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	appsResp, err := h.appClient.GetVacancyApplications(ctx, &applicationpb.GetVacancyApplicationsRequest{
		VacancyId:  vacancyID,
		EmployerId: employerID,
	})
	if err != nil {
		handleGRPCError(c, err)
		return
	}

	// Enrich with student data
	type StudentInfo struct {
		FirstName    string `json:"first_name"`
		LastName     string `json:"last_name"`
		IIN          string `json:"iin"`
		UniversityID string `json:"university_id"`
		Skills       string `json:"skills"`
	}
	type EnrichedApplication struct {
		ID          string      `json:"id"`
		StudentID   string      `json:"student_id"`
		VacancyID   string      `json:"vacancy_id"`
		Status      string      `json:"status"`
		CoverLetter string      `json:"cover_letter"`
		MatchScore  int32       `json:"match_score"`
		CreatedAt   string      `json:"created_at"`
		Student     StudentInfo `json:"student"`
	}

	var enriched []EnrichedApplication
	for _, app := range appsResp.Applications {
		ea := EnrichedApplication{
			ID:          app.Id,
			StudentID:   app.StudentId,
			VacancyID:   app.VacancyId,
			Status:      app.Status,
			CoverLetter: app.CoverLetter,
			MatchScore:  app.MatchScore,
			CreatedAt:   app.CreatedAt,
		}

		// Try to get student profile
		studentCtx, studentCancel := context.WithTimeout(context.Background(), 3*time.Second)
		studentResp, studentErr := h.studentClient.GetProfile(studentCtx, &studentpb.GetProfileRequest{
			UserId: app.StudentId,
		})
		studentCancel()
		if studentErr == nil && studentResp != nil {
			ea.Student.FirstName = studentResp.FirstName
			ea.Student.LastName = studentResp.LastName
			ea.Student.IIN = studentResp.Iin
			ea.Student.UniversityID = studentResp.UniversityId
			ea.Student.Skills = studentResp.Skills
		}

		enriched = append(enriched, ea)
	}

	if enriched == nil {
		enriched = []EnrichedApplication{}
	}
	c.JSON(http.StatusOK, gin.H{"applications": enriched})
}

// PUT /api/applications/:id/status - employer updates application status
func (h *ApplicationHandler) UpdateStatus(c *gin.Context) {
	employerID := c.GetHeader("X-User-ID")
	role := c.GetHeader("X-User-Role")
	if role != "employer" {
		c.JSON(http.StatusForbidden, gin.H{"error": "доступ запрещён"})
		return
	}
	id := c.Param("id")

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := h.appClient.UpdateStatus(ctx, &applicationpb.UpdateStatusRequest{
		Id:         id,
		EmployerId: employerID,
		Status:     req.Status,
	})
	if err != nil {
		handleGRPCError(c, err)
		return
	}

	// Notify student about status change
	statusLabels := map[string]string{
		"interview":   "Вас приглашают на интервью 🎯",
		"shortlisted": "Вы попали в шорт-лист 📋",
		"offered":     "Вам предложена работа! 🎉",
		"rejected":    "Ваша заявка отклонена",
	}
	if title, ok := statusLabels[req.Status]; ok {
		body := "Работодатель изменил статус вашей заявки на «" + req.Status + "»."
		// related_id format: "applicationId|status" — used by frontend for i18n translation
		go h.notif.Send(resp.GetStudentId(), "application_status", title, body, id+"|"+req.Status)
	}

	// When employer offers a job — create employment record for grant monitoring
	if req.Status == "offered" && h.appHTTPURL != "" {
		go func() {
			// Fetch vacancy info to get company name and job title
			companyName := ""
			jobTitle := ""
			vCtx, vCancel := context.WithTimeout(context.Background(), 3*time.Second)
			vacancyResp, vErr := h.vacancyClient.GetVacancyByID(vCtx, &vacancypb.GetByIDRequest{Id: resp.GetVacancyId()})
			vCancel()
			if vErr == nil && vacancyResp != nil {
				companyName = vacancyResp.GetCompanyName()
				jobTitle = vacancyResp.GetTitle()
			}

			// Fetch student's university_id for scoped university access
			universityID := ""
			sCtx, sCancel := context.WithTimeout(context.Background(), 3*time.Second)
			studentResp, sErr := h.studentClient.GetProfile(sCtx, &studentpb.GetProfileRequest{UserId: resp.GetStudentId()})
			sCancel()
			if sErr == nil && studentResp != nil {
				universityID = studentResp.GetUniversityId()
			}

			payload := map[string]interface{}{
				"student_id":     resp.GetStudentId(),
				"employer_id":    employerID,
				"application_id": id,
				"vacancy_id":     resp.GetVacancyId(),
				"company_name":   companyName,
				"job_title":      jobTitle,
				"university_id":  universityID,
			}
			CreateEmploymentRecord(h.appHTTPURL, payload)
		}()
	}

	c.JSON(http.StatusOK, resp)
}

// DELETE /api/applications/:id - student withdraws application
func (h *ApplicationHandler) Withdraw(c *gin.Context) {
	studentID := c.GetHeader("X-User-ID")
	id := c.Param("id")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := h.appClient.Withdraw(ctx, &applicationpb.WithdrawRequest{
		Id:        id,
		StudentId: studentID,
	})
	if err != nil {
		handleGRPCError(c, err)
		return
	}
	c.JSON(http.StatusOK, resp)
}
