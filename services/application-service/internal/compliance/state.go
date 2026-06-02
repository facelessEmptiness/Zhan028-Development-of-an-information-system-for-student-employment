// Package compliance implements the grant-obligation state machine described in
// Article 47. It is pure domain logic: no database, no network, no clock of its
// own — every decision is a function of its inputs. This makes it fully unit
// testable and keeps it decoupled from how facts are gathered or persisted.
//
// The machine is temporally monotonic: time-driven evaluation never moves a
// record backwards. Compliant and Exempt are terminal "good" states reached
// only by evidence-driven transitions performed by verified university staff.
package compliance

import (
	"errors"
	"time"
)

// State is a compliance state in the grant-obligation lifecycle.
type State string

const (
	// NotYetDue — the student has not yet graduated; the obligation is not active.
	NotYetDue State = "NotYetDue"
	// InProgress — graduated with an active qualifying offer (verified employer,
	// matching specialisation, start date within the period required by Article 47).
	InProgress State = "InProgress"
	// Compliant — the required employment period (2 or 3 years) has been completed
	// in a qualifying position. Evidence-driven, terminal.
	Compliant State = "Compliant"
	// AtRisk — more than three months have elapsed since graduation without a
	// qualifying offer. Triggers a student notification and the university at-risk panel.
	AtRisk State = "AtRisk"
	// NonCompliant — the legal deadline passed without qualifying employment
	// (Clause 17-4 of Article 47; precedes reimbursement of educational costs).
	NonCompliant State = "NonCompliant"
	// Exempt — the student falls under an exemption (Clause 17-2: continuing
	// education, maternity/childcare, certain disabilities, etc.). Evidence-driven, terminal.
	Exempt State = "Exempt"
)

// GraceMonths — a graduate without a qualifying offer becomes AtRisk only after
// strictly more than this many calendar months have elapsed since graduation.
const GraceMonths = 3

// Errors returned by evidence-driven transitions.
var (
	// ErrUnauthorized — the actor is not verified university staff.
	ErrUnauthorized = errors.New("только сотрудник вуза может выполнять evidence-переход")
	// ErrEvidenceRequired — no verified supporting documentation was provided.
	ErrEvidenceRequired = errors.New("требуется подтверждающий документ")
	// ErrInvalidTransition — the requested transition is not allowed.
	ErrInvalidTransition = errors.New("недопустимый переход состояния")
)

// Valid reports whether s is a known compliance state.
func (s State) Valid() bool {
	switch s {
	case NotYetDue, InProgress, Compliant, AtRisk, NonCompliant, Exempt:
		return true
	}
	return false
}

// IsTerminal reports whether s is a terminal "good" state that admits no further
// transitions.
func (s State) IsTerminal() bool {
	return s == Compliant || s == Exempt
}

// Offer describes the offer being evaluated for the InProgress condition.
type Offer struct {
	Active                    bool // offer is currently active in CareerBond
	EmployerVerified          bool // employer passed BIN verification
	SpecialisationMatches     bool // vacancy specialisation matches the student's field of study
	StartWithinRequiredPeriod bool // start date falls within the period required by Article 47
}

// IsQualifying reports whether an offer satisfies all InProgress conditions.
func (o Offer) IsQualifying() bool {
	return o.Active && o.EmployerVerified && o.SpecialisationMatches && o.StartWithinRequiredPeriod
}

// Facts is the snapshot of inputs the time-driven evaluation needs. Where these
// values come from (the record itself, or other services) is intentionally not
// the machine's concern.
type Facts struct {
	// GraduationDate is when the student graduated; nil means not graduated yet.
	GraduationDate *time.Time
	// Deadline is the legal deadline after which AtRisk becomes NonCompliant;
	// nil disables that transition.
	Deadline *time.Time
	// HasQualifyingOffer is the result of Offer.IsQualifying for the student's
	// current offer (false if there is none).
	HasQualifyingOffer bool
}

// NextTimeDriven returns the state after applying the time-driven rules at time
// now. This is the logic the nightly scheduler runs. It never moves backwards
// and never produces Compliant or Exempt (those are evidence-driven only).
//
// Transitions:
//
//	NotYetDue -> InProgress   graduated and has a qualifying offer
//	NotYetDue -> AtRisk       graduated, no qualifying offer, > GraceMonths since graduation
//	AtRisk    -> NonCompliant the deadline has passed
//
// All other states are left unchanged.
func NextTimeDriven(current State, now time.Time, f Facts) State {
	switch current {
	case NotYetDue:
		// Obligation is not active until the student has graduated.
		if f.GraduationDate == nil || now.Before(*f.GraduationDate) {
			return NotYetDue
		}
		// Graduated: a qualifying offer moves the record to InProgress.
		if f.HasQualifyingOffer {
			return InProgress
		}
		// No qualifying offer: at-risk once strictly more than GraceMonths elapsed.
		atRiskFrom := f.GraduationDate.AddDate(0, GraceMonths, 0)
		if now.After(atRiskFrom) {
			return AtRisk
		}
		return NotYetDue

	case AtRisk:
		if f.Deadline != nil && now.After(*f.Deadline) {
			return NonCompliant
		}
		return AtRisk

	default:
		// InProgress, Compliant, NonCompliant, Exempt have no time-driven exit.
		return current
	}
}

// ApplyEvidence performs an evidence-driven transition to Compliant or Exempt.
// Only verified university staff (role "university" or "admin") may do this, and
// only with verified supporting documentation. The current state must be a
// non-terminal valid state.
func ApplyEvidence(current, target State, actorRole string, hasVerifiedDocs bool) (State, error) {
	if target != Compliant && target != Exempt {
		return current, ErrInvalidTransition
	}
	if actorRole != "university" && actorRole != "admin" {
		return current, ErrUnauthorized
	}
	if !hasVerifiedDocs {
		return current, ErrEvidenceRequired
	}
	if !current.Valid() || current.IsTerminal() {
		return current, ErrInvalidTransition
	}
	return target, nil
}
