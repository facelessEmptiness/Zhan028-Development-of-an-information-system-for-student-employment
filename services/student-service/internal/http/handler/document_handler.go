package handler

import (
	"errors"
	"io"
	"net/http"
	"student-service/internal/models"
	"student-service/internal/repository"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const maxFileMB = 10

type DocumentHandler struct {
	repo      repository.DocumentRepository
	notifRepo repository.NotificationRepository
}

func NewDocumentHandler(repo repository.DocumentRepository, notifRepo repository.NotificationRepository) *DocumentHandler {
	return &DocumentHandler{repo: repo, notifRepo: notifRepo}
}

// POST /api/documents/upload
func (h *DocumentHandler) Upload(c *gin.Context) {
	userIDStr := c.GetHeader("X-User-ID")
	uid, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid X-User-ID"})
		return
	}

	docType := c.PostForm("type")
	if docType != models.DocTypeCV && docType != models.DocTypeDiploma && docType != models.DocTypeCertificate {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type must be cv, diploma or certificate"})
		return
	}

	fh, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}

	if fh.Size > maxFileMB*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file exceeds maximum size of 10 MB"})
		return
	}

	f, err := fh.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot open file"})
		return
	}
	defer f.Close()

	data, err := io.ReadAll(f)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot read file"})
		return
	}

	mimeType := fh.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = http.DetectContentType(data)
	}

	doc := &models.Document{
		UserID:   uid,
		Type:     docType,
		FileName: fh.Filename,
		FileSize: fh.Size,
		MimeType: mimeType,
		FileData: data,
		Status:   models.DocStatusPending,
	}

	if err := h.repo.Create(doc); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save document"})
		return
	}

	doc.FileData = nil
	c.JSON(http.StatusCreated, doc)
}

// GET /api/documents/my
func (h *DocumentHandler) ListMy(c *gin.Context) {
	uid, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid X-User-ID"})
		return
	}

	docs, err := h.repo.FindByUserID(uid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch documents"})
		return
	}

	if docs == nil {
		docs = []*models.Document{}
	}
	c.JSON(http.StatusOK, gin.H{"documents": docs})
}

// GET /api/documents/student/:user_id
func (h *DocumentHandler) ListByStudent(c *gin.Context) {
	targetUID, err := uuid.Parse(c.Param("user_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user_id"})
		return
	}

	docs, err := h.repo.FindByUserID(targetUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch documents"})
		return
	}

	if docs == nil {
		docs = []*models.Document{}
	}
	c.JSON(http.StatusOK, gin.H{"documents": docs})
}

// GET /api/documents/:id/download
func (h *DocumentHandler) Download(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	doc, err := h.repo.FindByIDWithData(id)
	if errors.Is(err, repository.ErrDocumentNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	mime := doc.MimeType
	if mime == "" {
		mime = "application/octet-stream"
	}
	c.Header("Content-Disposition", `attachment; filename="`+doc.FileName+`"`)
	c.Data(http.StatusOK, mime, doc.FileData)
}

// PUT /api/documents/:id/verify
func (h *DocumentHandler) Verify(c *gin.Context) {
	h.setStatus(c, models.DocStatusVerified)
}

// PUT /api/documents/:id/reject
func (h *DocumentHandler) Reject(c *gin.Context) {
	h.setStatus(c, models.DocStatusRejected)
}

func (h *DocumentHandler) setStatus(c *gin.Context, newStatus string) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	verifierID, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user id"})
		return
	}

	var body struct {
		Comment string `json:"comment"`
	}
	_ = c.ShouldBindJSON(&body)

	doc, err := h.repo.FindByID(id)
	if errors.Is(err, repository.ErrDocumentNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	now := time.Now()
	doc.Status = newStatus
	doc.VerifiedBy = &verifierID
	doc.VerifiedAt = &now
	doc.Comment = body.Comment

	if err := h.repo.Update(doc); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update status"})
		return
	}

	// Create notification for the document owner
	if h.notifRepo != nil {
		var notifType, title, body string
		docTypeLabel := map[string]string{
			models.DocTypeCV:          "CV",
			models.DocTypeCertificate: "Сертификат",
		}[doc.Type]
		if docTypeLabel == "" {
			docTypeLabel = doc.Type
		}

		if newStatus == models.DocStatusVerified {
			notifType = models.NotifTypeDocumentVerified
			title = "Документ верифицирован ✅"
			body = "Ваш документ «" + docTypeLabel + "» был подтверждён университетом."
		} else {
			notifType = models.NotifTypeDocumentRejected
			title = "Документ отклонён ❌"
			body = "Ваш документ «" + docTypeLabel + "» был отклонён."
			if doc.Comment != "" {
				body += " Комментарий: " + doc.Comment
			}
		}

		_ = h.notifRepo.Create(&models.Notification{
			UserID:    doc.UserID,
			Type:      notifType,
			Title:     title,
			Body:      body,
			RelatedID: doc.ID.String(),
		})
	}

	c.JSON(http.StatusOK, doc)
}

// PUT /api/documents/auto-verify/:user_id
// University admin auto-verifies all pending non-CV documents for a student.
func (h *DocumentHandler) AutoVerify(c *gin.Context) {
	verifierID, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid X-User-ID"})
		return
	}

	targetUID, err := uuid.Parse(c.Param("user_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user_id"})
		return
	}

	updatedDocs, err := h.repo.VerifyAllPendingByUserID(targetUID, verifierID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to auto-verify documents"})
		return
	}

	if len(updatedDocs) == 0 {
		c.JSON(http.StatusOK, gin.H{"message": "no pending documents to verify", "verified_count": 0})
		return
	}

	// Send a single notification to the student
	if h.notifRepo != nil {
		_ = h.notifRepo.Create(&models.Notification{
			UserID:    targetUID,
			Type:      models.NotifTypeDocumentVerified,
			Title:     "Диплом подтверждён университетом 🎓",
			Body:      "Ваши документы автоматически подтверждены университетом.",
			RelatedID: updatedDocs[0].ID.String(),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        "documents auto-verified successfully",
		"verified_count": len(updatedDocs),
		"documents":      updatedDocs,
	})
}

// GET /api/documents/pending-count
// Returns the count of pending diploma documents for the calling university's students.
func (h *DocumentHandler) PendingCount(c *gin.Context) {
	universityIDStr := c.GetHeader("X-University-ID")
	universityID, err := uuid.Parse(universityIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "university ID required"})
		return
	}
	count, err := h.repo.CountPendingDiplomaByUniversityID(universityID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to count pending documents"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// DELETE /api/documents/:id
func (h *DocumentHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	doc, err := h.repo.FindByID(id)
	if errors.Is(err, repository.ErrDocumentNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
		return
	}

	if doc.UserID.String() != c.GetHeader("X-User-ID") {
		c.JSON(http.StatusForbidden, gin.H{"error": "cannot delete another user's document"})
		return
	}

	if err := h.repo.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete document"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "document deleted"})
}
