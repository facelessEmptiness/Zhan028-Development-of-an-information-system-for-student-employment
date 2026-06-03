package compliance

import (
	"testing"
	"time"
)

func date(y int, m time.Month, d int) time.Time {
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

func ptr(t time.Time) *time.Time { return &t }

func TestNextTimeDriven(t *testing.T) {
	grad := date(2025, time.June, 1)
	// AtRisk threshold is strictly after graduation + 3 months => 2025-09-01.
	atRiskFrom := date(2025, time.September, 1)
	deadline := date(2028, time.June, 1)

	tests := []struct {
		name    string
		current State
		now     time.Time
		facts   Facts
		want    State
	}{
		{
			name:    "not graduated yet (no date) stays NotYetDue",
			current: NotYetDue,
			now:     date(2025, time.July, 1),
			facts:   Facts{GraduationDate: nil},
			want:    NotYetDue,
		},
		{
			name:    "before graduation stays NotYetDue",
			current: NotYetDue,
			now:     date(2025, time.May, 31),
			facts:   Facts{GraduationDate: ptr(grad)},
			want:    NotYetDue,
		},
		{
			name:    "graduated with qualifying offer -> InProgress",
			current: NotYetDue,
			now:     grad,
			facts:   Facts{GraduationDate: ptr(grad), HasQualifyingOffer: true},
			want:    InProgress,
		},
		{
			name:    "graduated, no offer, exactly at grace boundary stays NotYetDue",
			current: NotYetDue,
			now:     atRiskFrom, // exactly grad+3mo: "more than" not yet satisfied
			facts:   Facts{GraduationDate: ptr(grad)},
			want:    NotYetDue,
		},
		{
			name:    "graduated, no offer, one day past grace -> AtRisk",
			current: NotYetDue,
			now:     atRiskFrom.AddDate(0, 0, 1),
			facts:   Facts{GraduationDate: ptr(grad)},
			want:    AtRisk,
		},
		{
			name:    "AtRisk with no deadline stays AtRisk",
			current: AtRisk,
			now:     date(2030, time.January, 1),
			facts:   Facts{GraduationDate: ptr(grad), Deadline: nil},
			want:    AtRisk,
		},
		{
			name:    "AtRisk before deadline stays AtRisk",
			current: AtRisk,
			now:     deadline.AddDate(0, 0, -1),
			facts:   Facts{GraduationDate: ptr(grad), Deadline: ptr(deadline)},
			want:    AtRisk,
		},
		{
			name:    "AtRisk exactly at deadline stays AtRisk (deadline must pass)",
			current: AtRisk,
			now:     deadline,
			facts:   Facts{GraduationDate: ptr(grad), Deadline: ptr(deadline)},
			want:    AtRisk,
		},
		{
			name:    "AtRisk after deadline -> NonCompliant",
			current: AtRisk,
			now:     deadline.AddDate(0, 0, 1),
			facts:   Facts{GraduationDate: ptr(grad), Deadline: ptr(deadline)},
			want:    NonCompliant,
		},
		{
			name:    "InProgress is not changed by time (no offer, past grace)",
			current: InProgress,
			now:     date(2030, time.January, 1),
			facts:   Facts{GraduationDate: ptr(grad), HasQualifyingOffer: false},
			want:    InProgress,
		},
		{
			name:    "Compliant is terminal under time",
			current: Compliant,
			now:     date(2030, time.January, 1),
			facts:   Facts{GraduationDate: ptr(grad), Deadline: ptr(deadline)},
			want:    Compliant,
		},
		{
			name:    "Exempt is terminal under time",
			current: Exempt,
			now:     date(2030, time.January, 1),
			facts:   Facts{GraduationDate: ptr(grad), Deadline: ptr(deadline)},
			want:    Exempt,
		},
		{
			name:    "NonCompliant is not changed by time",
			current: NonCompliant,
			now:     date(2030, time.January, 1),
			facts:   Facts{GraduationDate: ptr(grad), Deadline: ptr(deadline)},
			want:    NonCompliant,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NextTimeDriven(tt.current, tt.now, tt.facts)
			if got != tt.want {
				t.Errorf("NextTimeDriven(%s) = %s, want %s", tt.current, got, tt.want)
			}
		})
	}
}

func TestApplyEvidence(t *testing.T) {
	tests := []struct {
		name    string
		current State
		target  State
		role    string
		docs    bool
		want    State
		wantErr error
	}{
		{
			name:    "university marks Compliant with docs from AtRisk",
			current: AtRisk, target: Compliant, role: "university", docs: true,
			want: Compliant, wantErr: nil,
		},
		{
			name:    "university marks Exempt with docs from NotYetDue",
			current: NotYetDue, target: Exempt, role: "university", docs: true,
			want: Exempt, wantErr: nil,
		},
		{
			name:    "admin marks Compliant with docs from InProgress",
			current: InProgress, target: Compliant, role: "admin", docs: true,
			want: Compliant, wantErr: nil,
		},
		{
			name:    "NonCompliant may still become Exempt with docs (appeal)",
			current: NonCompliant, target: Exempt, role: "university", docs: true,
			want: Exempt, wantErr: nil,
		},
		{
			name:    "student cannot perform evidence transition",
			current: AtRisk, target: Compliant, role: "student", docs: true,
			want: AtRisk, wantErr: ErrUnauthorized,
		},
		{
			name:    "employer cannot perform evidence transition",
			current: NotYetDue, target: Exempt, role: "employer", docs: true,
			want: NotYetDue, wantErr: ErrUnauthorized,
		},
		{
			name:    "no verified documents is rejected",
			current: AtRisk, target: Compliant, role: "university", docs: false,
			want: AtRisk, wantErr: ErrEvidenceRequired,
		},
		{
			name:    "invalid target state is rejected",
			current: AtRisk, target: AtRisk, role: "university", docs: true,
			want: AtRisk, wantErr: ErrInvalidTransition,
		},
		{
			name:    "cannot transition out of terminal Compliant",
			current: Compliant, target: Exempt, role: "university", docs: true,
			want: Compliant, wantErr: ErrInvalidTransition,
		},
		{
			name:    "cannot transition out of terminal Exempt",
			current: Exempt, target: Compliant, role: "university", docs: true,
			want: Exempt, wantErr: ErrInvalidTransition,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ApplyEvidence(tt.current, tt.target, tt.role, tt.docs)
			if err != tt.wantErr {
				t.Errorf("ApplyEvidence error = %v, want %v", err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("ApplyEvidence state = %s, want %s", got, tt.want)
			}
		})
	}
}

func TestOfferIsQualifying(t *testing.T) {
	full := Offer{Active: true, EmployerVerified: true, SpecialisationMatches: true, StartWithinRequiredPeriod: true}

	tests := []struct {
		name  string
		offer Offer
		want  bool
	}{
		{"all conditions met", full, true},
		{"inactive offer", Offer{Active: false, EmployerVerified: true, SpecialisationMatches: true, StartWithinRequiredPeriod: true}, false},
		{"employer not verified", Offer{Active: true, EmployerVerified: false, SpecialisationMatches: true, StartWithinRequiredPeriod: true}, false},
		{"specialisation mismatch", Offer{Active: true, EmployerVerified: true, SpecialisationMatches: false, StartWithinRequiredPeriod: true}, false},
		{"start outside required period", Offer{Active: true, EmployerVerified: true, SpecialisationMatches: true, StartWithinRequiredPeriod: false}, false},
		{"empty offer", Offer{}, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.offer.IsQualifying(); got != tt.want {
				t.Errorf("IsQualifying() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestStateValidAndTerminal(t *testing.T) {
	for _, s := range []State{NotYetDue, InProgress, Compliant, AtRisk, NonCompliant, Exempt} {
		if !s.Valid() {
			t.Errorf("%s should be valid", s)
		}
	}
	if State("Bogus").Valid() {
		t.Error("unknown state should be invalid")
	}
	if !Compliant.IsTerminal() || !Exempt.IsTerminal() {
		t.Error("Compliant and Exempt must be terminal")
	}
	for _, s := range []State{NotYetDue, InProgress, AtRisk, NonCompliant} {
		if s.IsTerminal() {
			t.Errorf("%s must not be terminal", s)
		}
	}
}
