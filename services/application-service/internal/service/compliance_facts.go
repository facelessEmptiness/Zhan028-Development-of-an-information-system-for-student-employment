package service

import (
	"errors"
	"time"

	"application-service/internal/models"
)

// FactProvider supplies externally-sourced facts that the time-driven evaluation
// needs but that do not live on the compliance record itself — currently just
// whether the student has a qualifying offer. The real implementation is wired
// in step 5; until then UnconfiguredFactProvider is used.
type FactProvider interface {
	HasQualifyingOffer(rec *models.ComplianceRecord) (bool, error)
}

// EvaluationReport summarises a single EvaluateAll pass.
type EvaluationReport struct {
	Evaluated int
	Changed   int
	Errors    int
}

// EvaluateAll applies the time-driven rules to every non-terminal record. A
// per-record fact or persistence error is counted and skipped so that one bad
// record cannot abort the whole nightly pass.
func (s *complianceService) EvaluateAll(now time.Time, facts FactProvider) (EvaluationReport, error) {
	recs, err := s.repo.ListNonTerminal()
	if err != nil {
		return EvaluationReport{}, err
	}

	var rep EvaluationReport
	for i := range recs {
		rep.Evaluated++

		hasOffer, ferr := facts.HasQualifyingOffer(&recs[i])
		if ferr != nil {
			rep.Errors++
			continue
		}

		changed, eerr := s.Evaluate(&recs[i], now, hasOffer)
		if eerr != nil {
			rep.Errors++
			continue
		}
		if changed {
			rep.Changed++
		}
	}
	return rep, nil
}

// ErrFactProviderUnconfigured is returned by UnconfiguredFactProvider.
var ErrFactProviderUnconfigured = errors.New("поставщик фактов не настроен")

// UnconfiguredFactProvider is the safe placeholder used until real fact sourcing
// (step 5) is wired in. It errors for every record, so EvaluateAll changes no
// state even if the scheduler is enabled by mistake.
type UnconfiguredFactProvider struct{}

func (UnconfiguredFactProvider) HasQualifyingOffer(*models.ComplianceRecord) (bool, error) {
	return false, ErrFactProviderUnconfigured
}
