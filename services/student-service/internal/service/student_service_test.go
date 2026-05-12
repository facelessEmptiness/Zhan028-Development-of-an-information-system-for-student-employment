package service

import (
	"errors"
	"testing"
)

// Valid IIN: born 1990-01-01, male (century=3).
// Checksum: weights·digits[0:11] = 51 → 51%11 = 7 = digits[11].
const validIIN = "900101300017"

func TestValidateIIN_ValidAdult(t *testing.T) {
	if err := validateIIN(validIIN); err != nil {
		t.Fatalf("expected valid IIN, got: %v", err)
	}
}

func TestValidateIIN_InvalidLength(t *testing.T) {
	err := validateIIN("12345")
	if !errors.Is(err, ErrIINInvalidFormat) {
		t.Fatalf("expected ErrIINInvalidFormat, got: %v", err)
	}
}

func TestValidateIIN_NonDigits(t *testing.T) {
	err := validateIIN("90010130001X")
	if !errors.Is(err, ErrIINInvalidFormat) {
		t.Fatalf("expected ErrIINInvalidFormat, got: %v", err)
	}
}

func TestValidateIIN_InvalidChecksum(t *testing.T) {
	// Change last digit of validIIN from 7 → 8 to break checksum.
	err := validateIIN("900101300018")
	if !errors.Is(err, ErrIINInvalidChecksum) {
		t.Fatalf("expected ErrIINInvalidChecksum, got: %v", err)
	}
}

func TestValidateIIN_TooYoung(t *testing.T) {
	// Born 2015-01-01, male (century=5).
	// Checksum: sum = 67 → 67%11 = 1 = digits[11].
	// Age in 2026 = 11 < 16.
	err := validateIIN("150101500011")
	if !errors.Is(err, ErrIINTooYoung) {
		t.Fatalf("expected ErrIINTooYoung, got: %v", err)
	}
}
