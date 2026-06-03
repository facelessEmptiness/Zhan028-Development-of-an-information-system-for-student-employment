// Package facts provides the externally-sourced facts the compliance machine
// needs. EmploymentFactProvider answers "does the student have a qualifying
// offer?" purely from data local to application-service (employment_records),
// so it adds no cross-service dependency.
package facts

import (
	"time"

	"application-service/internal/compliance"
	"application-service/internal/models"
	"application-service/internal/repository"
)

// employmentStatusActive is the employment_records.status value for a current job.
const employmentStatusActive = "active"

// Policy controls which qualifying-offer conditions are enforced.
//
// Active and StartWithinRequiredPeriod are always evaluated from local data.
// EmployerVerified and SpecialisationMatches depend on data owned by other
// services (employer verification) or not yet modelled (vacancy specialisation),
// so they are NOT enforced by default. Turning them on belongs to a later step
// that wires a real source for each.
type Policy struct {
	RequireEmployerVerified    bool
	RequireSpecialisationMatch bool
}

// EmploymentFactProvider implements service.FactProvider using local employment
// records.
type EmploymentFactProvider struct {
	employment repository.EmploymentRepository
	policy     Policy
}

func NewEmploymentFactProvider(employment repository.EmploymentRepository, policy Policy) *EmploymentFactProvider {
	return &EmploymentFactProvider{employment: employment, policy: policy}
}

// HasQualifyingOffer reports whether the student holds at least one active
// employment record that satisfies the Article 47 InProgress conditions.
func (p *EmploymentFactProvider) HasQualifyingOffer(rec *models.ComplianceRecord) (bool, error) {
	records, err := p.employment.GetByStudentID(rec.StudentID)
	if err != nil {
		return false, err
	}

	for i := range records {
		if p.toOffer(&records[i], rec).IsQualifying() {
			return true, nil
		}
	}
	return false, nil
}

func (p *EmploymentFactProvider) toOffer(emp *models.EmploymentRecord, rec *models.ComplianceRecord) compliance.Offer {
	return compliance.Offer{
		Active:                    emp.Status == employmentStatusActive,
		StartWithinRequiredPeriod: startWithinPeriod(emp.StartedAt, rec.Deadline),
		// Externally-sourced conditions are treated as satisfied unless the
		// policy requires them (and a real source is wired in a later step).
		EmployerVerified:      !p.policy.RequireEmployerVerified,
		SpecialisationMatches: !p.policy.RequireSpecialisationMatch,
	}
}

// startWithinPeriod reports whether employment started on or before the legal
// deadline. With no deadline known yet, timing is not treated as blocking.
func startWithinPeriod(startedAt time.Time, deadline *time.Time) bool {
	if deadline == nil {
		return true
	}
	return !startedAt.After(*deadline)
}
