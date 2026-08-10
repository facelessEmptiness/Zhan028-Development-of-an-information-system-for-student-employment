// Package scheduler runs the nightly compliance evaluation. It is a thin timer
// around service.EvaluateAll: all the decision logic lives in the service and
// the pure compliance package, so the only thing here is "when to run".
package scheduler

import (
	"context"
	"log"
	"time"

	"application-service/internal/service"
)

type ComplianceScheduler struct {
	svc      service.ComplianceService
	facts    service.FactProvider
	interval time.Duration
	clock    func() time.Time
}

// NewComplianceScheduler creates a scheduler that evaluates every interval.
// A non-positive interval defaults to 24h.
func NewComplianceScheduler(svc service.ComplianceService, facts service.FactProvider, interval time.Duration) *ComplianceScheduler {
	if interval <= 0 {
		interval = 24 * time.Hour
	}
	return &ComplianceScheduler{svc: svc, facts: facts, interval: interval, clock: time.Now}
}

// RunOnce performs a single evaluation pass and logs the summary.
func (s *ComplianceScheduler) RunOnce() {
	rep, err := s.svc.EvaluateAll(s.clock(), s.facts)
	if err != nil {
		log.Printf("[compliance-scheduler] pass failed: %v", err)
		return
	}
	log.Printf("[compliance-scheduler] evaluated=%d changed=%d errors=%d",
		rep.Evaluated, rep.Changed, rep.Errors)
}

// Start runs one pass immediately, then one every interval until ctx is
// cancelled. Intended to be launched in its own goroutine.
func (s *ComplianceScheduler) Start(ctx context.Context) {
	s.RunOnce()

	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("[compliance-scheduler] stopped")
			return
		case <-ticker.C:
			s.RunOnce()
		}
	}
}
