package service

import (
	"testing"
	"unicode"

	"auth-service/pkg/jwt"

	"github.com/google/uuid"
)

func TestGenerateCode_SixDigits(t *testing.T) {
	code := generateCode()
	if len(code) != 6 {
		t.Fatalf("expected 6-char code, got %q (len=%d)", code, len(code))
	}
	for _, ch := range code {
		if !unicode.IsDigit(ch) {
			t.Fatalf("expected all digits, got %q", code)
		}
	}
}

func TestGenerateCode_IsUnique(t *testing.T) {
	seen := make(map[string]struct{}, 200)
	for range 200 {
		seen[generateCode()] = struct{}{}
	}
	if len(seen) < 180 {
		t.Fatalf("expected near-unique codes, got only %d distinct out of 200", len(seen))
	}
}

func TestJWT_AccessTokenRoundTrip(t *testing.T) {
	mgr := jwt.NewJWTManager("test-secret-key", 1)
	userID := uuid.New()

	token, err := mgr.GenerateAccessToken(userID, "student@uni.kz", "student", "")
	if err != nil {
		t.Fatalf("GenerateAccessToken: %v", err)
	}

	claims, err := mgr.ValidateAccessToken(token)
	if err != nil {
		t.Fatalf("ValidateAccessToken: %v", err)
	}
	if claims.UserID != userID {
		t.Errorf("user ID: got %v, want %v", claims.UserID, userID)
	}
	if claims.Email != "student@uni.kz" {
		t.Errorf("email: got %q, want %q", claims.Email, "student@uni.kz")
	}
	if claims.Role != "student" {
		t.Errorf("role: got %q, want %q", claims.Role, "student")
	}
}

func TestJWT_WrongSecretRejected(t *testing.T) {
	signer := jwt.NewJWTManager("secret-A", 1)
	verifier := jwt.NewJWTManager("secret-B", 1)

	token, err := signer.GenerateAccessToken(uuid.New(), "x@x.kz", "employer", "")
	if err != nil {
		t.Fatalf("GenerateAccessToken: %v", err)
	}
	if _, err := verifier.ValidateAccessToken(token); err == nil {
		t.Fatal("expected error validating token signed with different secret, got nil")
	}
}

func TestJWT_RefreshTokenRejectedAsAccess(t *testing.T) {
	mgr := jwt.NewJWTManager("test-secret-key", 1)
	_, refreshToken, _, err := mgr.GenerateTokenPair(uuid.New(), "admin@uni.kz", "admin", "")
	if err != nil {
		t.Fatalf("GenerateTokenPair: %v", err)
	}
	if _, err := mgr.ValidateAccessToken(refreshToken); err == nil {
		t.Fatal("expected error using refresh token as access token, got nil")
	}
}
