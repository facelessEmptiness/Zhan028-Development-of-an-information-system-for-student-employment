package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ComplianceRecord tracks a student's grant-obligation compliance state
// (Article 47). One record per grant student, independent of whether they
// currently hold an employment record — most states apply before any job
// exists. The State string maps to the values in internal/compliance.
type ComplianceRecord struct {
	ID           uuid.UUID  `gorm:"type:uuid;primary_key" json:"id"`
	StudentID    uuid.UUID  `gorm:"type:uuid;not null;uniqueIndex" json:"student_id"`
	UniversityID *uuid.UUID `gorm:"type:uuid;index" json:"university_id,omitempty"`
	State        string     `gorm:"type:varchar(20);not null;default:'NotYetDue'" json:"state"`

	GraduationDate     *time.Time `json:"graduation_date,omitempty"`
	GrantYears         int        `gorm:"not null;default:3" json:"grant_years"`
	Deadline           *time.Time `json:"deadline,omitempty"`
	EmploymentRecordID *uuid.UUID `gorm:"type:uuid" json:"employment_record_id,omitempty"`

	// Evidence / audit trail for university-staff (evidence-driven) transitions.
	ExemptReason   string     `gorm:"type:varchar(100)" json:"exempt_reason,omitempty"`
	EvidenceDocID  *uuid.UUID `gorm:"type:uuid" json:"evidence_doc_id,omitempty"`
	TransitionedBy *uuid.UUID `gorm:"type:uuid" json:"transitioned_by,omitempty"`
	TransitionedAt *time.Time `json:"transitioned_at,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (c *ComplianceRecord) BeforeCreate(_ *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}
