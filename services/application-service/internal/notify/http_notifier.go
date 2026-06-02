// Package notify delivers compliance notifications to students via the
// student-service HTTP endpoint. It implements service.Notifier.
package notify

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
)

const atRiskNotificationType = "compliance_at_risk"

// HTTPNotifier sends fire-and-forget notifications to student-service's internal
// endpoint (POST /api/notifications/internal). Errors are logged, never returned,
// so notification problems cannot break the nightly evaluation.
type HTTPNotifier struct {
	baseURL string
	client  *http.Client
}

func NewHTTPNotifier(studentServiceURL string) *HTTPNotifier {
	return &HTTPNotifier{
		baseURL: studentServiceURL,
		client:  &http.Client{Timeout: 3 * time.Second},
	}
}

func (n *HTTPNotifier) NotifyAtRisk(studentID uuid.UUID) {
	payload := map[string]string{
		"user_id":    studentID.String(),
		"type":       atRiskNotificationType,
		"title":      "Риск по обязательству гранта ⚠️",
		"body":       "Прошло более 3 месяцев после выпуска без подходящего трудоустройства. Найдите квалифицирующую работу до дедлайна — иначе по статье 47 возможен возврат стоимости обучения.",
		"related_id": studentID.String(),
	}

	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[compliance-notify] marshal error for %s: %v", studentID, err)
		return
	}

	resp, err := n.client.Post(n.baseURL+"/api/notifications/internal", "application/json", bytes.NewReader(data))
	if err != nil {
		log.Printf("[compliance-notify] send error for %s: %v", studentID, err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		log.Printf("[compliance-notify] unexpected status %d for %s", resp.StatusCode, studentID)
	}
}
