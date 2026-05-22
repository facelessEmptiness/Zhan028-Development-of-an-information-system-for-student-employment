package handler

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
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

// POST /api/applications — student applies to a vacancy
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

	var studentSkills string
	sCtx, sCancel := context.WithTimeout(context.Background(), 3*time.Second)
	studentResp, sErr := h.studentClient.GetProfile(sCtx, &studentpb.GetProfileRequest{UserId: studentID})
	sCancel()
	if sErr == nil && studentResp != nil {
		studentSkills = studentResp.Skills
	}

	var vacancySkills string
	vCtx, vCancel := context.WithTimeout(context.Background(), 3*time.Second)
	vacancyResp, vErr := h.vacancyClient.GetVacancyByID(vCtx, &vacancypb.GetByIDRequest{Id: req.VacancyID})
	vCancel()
	if vErr == nil && vacancyResp != nil {
		vacancySkills = vacancyResp.Skills
	}

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

	go h.notif.Send(
		studentID,
		"application_submitted",
		"Заявка подана ✅",
		"Ваша заявка успешно отправлена. Match Score: "+fmt.Sprintf("%d%%", matchScore),
		resp.GetId(),
	)

	c.JSON(http.StatusCreated, resp)
}

// GET /api/applications/my — student sees their own applications (paginated)
func (h *ApplicationHandler) GetMyApplications(c *gin.Context) {
	studentID := c.GetHeader("X-User-ID")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := h.appClient.GetMyApplications(ctx, &applicationpb.GetMyApplicationsRequest{
		StudentId: studentID,
	})
	if err != nil {
		handleGRPCError(c, err)
		return
	}

	type EnrichedApp struct {
		ID           string `json:"id"`
		StudentID    string `json:"student_id"`
		VacancyID    string `json:"vacancy_id"`
		EmployerID   string `json:"employer_id"`
		Status       string `json:"status"`
		CoverLetter  string `json:"cover_letter"`
		MatchScore   int32  `json:"match_score"`
		CreatedAt    string `json:"created_at"`
		UpdatedAt    string `json:"updated_at"`
		VacancyTitle string `json:"vacancy_title"`
		CompanyName  string `json:"company_name"`
	}

	all := resp.Applications
	total := len(all)
	start := (page - 1) * pageSize
	end := start + pageSize
	if start > total {
		start = total
	}
	if end > total {
		end = total
	}

	enriched := make([]EnrichedApp, 0, end-start)
	for _, a := range all[start:end] {
		app := EnrichedApp{
			ID:          a.GetId(),
			StudentID:   a.GetStudentId(),
			VacancyID:   a.GetVacancyId(),
			EmployerID:  a.GetEmployerId(),
			Status:      a.GetStatus(),
			CoverLetter: a.GetCoverLetter(),
			MatchScore:  a.GetMatchScore(),
			CreatedAt:   a.GetCreatedAt(),
			UpdatedAt:   a.GetUpdatedAt(),
		}
		vCtx, vCancel := context.WithTimeout(context.Background(), 3*time.Second)
		if vResp, vErr := h.vacancyClient.GetVacancyByID(vCtx, &vacancypb.GetByIDRequest{Id: a.GetVacancyId()}); vErr == nil && vResp != nil {
			app.VacancyTitle = vResp.GetTitle()
			app.CompanyName = vResp.GetCompanyName()
		}
		vCancel()
		enriched = append(enriched, app)
	}

	c.JSON(http.StatusOK, gin.H{
		"applications": enriched,
		"total":        total,
		"page":         page,
		"page_size":    pageSize,
	})
}

// GET /api/applications/vacancy/:vacancy_id — employer sees applications for their vacancy (paginated)
func (h *ApplicationHandler) GetVacancyApplications(c *gin.Context) {
	employerID := c.GetHeader("X-User-ID")
	role := c.GetHeader("X-User-Role")
	if role != "employer" {
		c.JSON(http.StatusForbidden, gin.H{"error": "доступ запрещён"})
		return
	}
	vacancyID := c.Param("vacancy_id")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}
	statusFilter := c.Query("status")

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

	type StudentInfo struct {
		FirstName    string   `json:"first_name"`
		LastName     string   `json:"last_name"`
		IIN          string   `json:"iin"`
		UniversityID string   `json:"university_id"`
		Skills       []string `json:"skills"`
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

	// Filter by status if requested
	source := appsResp.Applications
	if statusFilter != "" {
		filtered := source[:0]
		for _, a := range source {
			if a.Status == statusFilter {
				filtered = append(filtered, a)
			}
		}
		source = filtered
	}

	total := len(source)
	start := (page - 1) * pageSize
	end := start + pageSize
	if start > total {
		start = total
	}
	if end > total {
		end = total
	}

	var enriched []EnrichedApplication
	for _, app := range source[start:end] {
		ea := EnrichedApplication{
			ID:          app.Id,
			StudentID:   app.StudentId,
			VacancyID:   app.VacancyId,
			Status:      app.Status,
			CoverLetter: app.CoverLetter,
			MatchScore:  app.MatchScore,
			CreatedAt:   app.CreatedAt,
		}

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
			ea.Student.Skills = splitSkills(studentResp.Skills)
		}

		enriched = append(enriched, ea)
	}

	if enriched == nil {
		enriched = []EnrichedApplication{}
	}
	c.JSON(http.StatusOK, gin.H{
		"applications": enriched,
		"total":        total,
		"page":         page,
		"page_size":    pageSize,
	})
}

// PUT /api/applications/:id/status — employer updates application status
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

	statusLabels := map[string]string{
		"interview":   "Вас приглашают на интервью 🎯",
		"shortlisted": "Вы попали в шорт-лист 📋",
		"offered":     "Вам предложена работа! 🎉",
		"rejected":    "Ваша заявка отклонена",
	}
	if title, ok := statusLabels[req.Status]; ok {
		body := "Работодатель изменил статус вашей заявки на «" + req.Status + "»."
		go h.notif.Send(resp.GetStudentId(), "application_status", title, body, id+"|"+req.Status)
	}

	if req.Status == "offered" && h.appHTTPURL != "" {
		go func() {
			companyName := ""
			jobTitle := ""
			vCtx, vCancel := context.WithTimeout(context.Background(), 3*time.Second)
			vacancyResp, vErr := h.vacancyClient.GetVacancyByID(vCtx, &vacancypb.GetByIDRequest{Id: resp.GetVacancyId()})
			vCancel()
			if vErr == nil && vacancyResp != nil {
				companyName = vacancyResp.GetCompanyName()
				jobTitle = vacancyResp.GetTitle()
			}

			universityID := ""
			sCtx, sCancel := context.WithTimeout(context.Background(), 3*time.Second)
			studentResp, sErr := h.studentClient.GetProfile(sCtx, &studentpb.GetProfileRequest{UserId: resp.GetStudentId()})
			sCancel()
			if sErr == nil && studentResp != nil {
				universityID = studentResp.GetUniversityId()
			}

			payload := map[string]any{
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

// DELETE /api/applications/:id — student withdraws application
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
