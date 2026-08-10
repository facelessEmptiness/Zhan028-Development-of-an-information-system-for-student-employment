package service

import (
	"errors"
	"testing"
	"time"

	"auth-service/internal/dto"
	"auth-service/internal/models"
	"auth-service/internal/repository"
	"auth-service/pkg/jwt"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// ── Hand-written repository stubs (no DB, no Redis) ──

type stubUserRepo struct {
	user    *models.User
	findErr error
	updated *models.User
}

func (s *stubUserRepo) Create(*models.User) error { return nil }
func (s *stubUserRepo) FindByID(uuid.UUID) (*models.User, error) {
	if s.findErr != nil {
		return nil, s.findErr
	}
	return s.user, nil
}
func (s *stubUserRepo) FindByEmail(string) (*models.User, error) {
	if s.findErr != nil {
		return nil, s.findErr
	}
	return s.user, nil
}
func (s *stubUserRepo) Update(u *models.User) error                  { s.updated = u; return nil }
func (s *stubUserRepo) Delete(uuid.UUID) error                       { return nil }
func (s *stubUserRepo) ExistsByEmail(string) (bool, error)           { return false, nil }
func (s *stubUserRepo) ListAll(string) ([]models.User, error)        { return nil, nil }

type stubCodeRepo struct {
	findErr error
}

func (s *stubCodeRepo) Create(*models.VerificationCode) error { return nil }
func (s *stubCodeRepo) FindValidCode(string, string, models.CodeType) (*models.VerificationCode, error) {
	if s.findErr != nil {
		return nil, s.findErr
	}
	return &models.VerificationCode{}, nil
}
func (s *stubCodeRepo) MarkAsUsed(interface{}) error                { return nil }
func (s *stubCodeRepo) DeleteExpired() error                        { return nil }
func (s *stubCodeRepo) InvalidateAll(string, models.CodeType) error { return nil }

type stubTokenRepo struct {
	exists  bool
	stored  []string
	deleted []string
}

func (s *stubTokenRepo) Store(jti, _ string, _ time.Duration) error {
	s.stored = append(s.stored, jti)
	return nil
}
func (s *stubTokenRepo) Exists(string) (bool, error) { return s.exists, nil }
func (s *stubTokenRepo) Delete(jti string) error     { s.deleted = append(s.deleted, jti); return nil }

func newSvc(u repository.UserRepository, c repository.VerificationCodeRepository, tk repository.RefreshTokenRepository, mgr *jwt.JWTManager) AuthService {
	return NewAuthService(u, c, tk, mgr, nil) // email service unused on the tested paths
}

func verifiedUser(t *testing.T, password string) *models.User {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	return &models.User{
		ID:              uuid.New(),
		Email:           "student@uni.kz",
		PasswordHash:    string(hash),
		Role:            models.RoleStudent,
		IsActive:        true,
		IsEmailVerified: true,
	}
}

// ── bcrypt password verification via Login ──

func TestLogin_CorrectPassword_IssuesTokens(t *testing.T) {
	user := verifiedUser(t, "correct horse battery")
	tk := &stubTokenRepo{}
	svc := newSvc(&stubUserRepo{user: user}, &stubCodeRepo{}, tk, jwt.NewJWTManager("secret", 1))

	resp, err := svc.Login(&dto.LoginRequest{Email: user.Email, Password: "correct horse battery"})
	if err != nil {
		t.Fatalf("Login: %v", err)
	}
	if resp.Tokens.AccessToken == "" || resp.Tokens.RefreshToken == "" {
		t.Error("expected a token pair")
	}
	if len(tk.stored) != 1 {
		t.Errorf("expected refresh JTI stored once, got %d", len(tk.stored))
	}
}

func TestLogin_WrongPassword_Rejected(t *testing.T) {
	user := verifiedUser(t, "correct")
	svc := newSvc(&stubUserRepo{user: user}, &stubCodeRepo{}, &stubTokenRepo{}, jwt.NewJWTManager("secret", 1))

	_, err := svc.Login(&dto.LoginRequest{Email: user.Email, Password: "wrong"})
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestLogin_InactiveUser_Rejected(t *testing.T) {
	user := verifiedUser(t, "p")
	user.IsActive = false
	svc := newSvc(&stubUserRepo{user: user}, &stubCodeRepo{}, &stubTokenRepo{}, jwt.NewJWTManager("secret", 1))

	_, err := svc.Login(&dto.LoginRequest{Email: user.Email, Password: "p"})
	if !errors.Is(err, ErrUserNotActive) {
		t.Fatalf("expected ErrUserNotActive, got %v", err)
	}
}

func TestLogin_UnknownUser_Rejected(t *testing.T) {
	svc := newSvc(&stubUserRepo{findErr: repository.ErrUserNotFound}, &stubCodeRepo{}, &stubTokenRepo{}, jwt.NewJWTManager("secret", 1))

	_, err := svc.Login(&dto.LoginRequest{Email: "nobody@uni.kz", Password: "p"})
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("expected ErrInvalidCredentials (no user enumeration), got %v", err)
	}
}

// ── e-mail verification by code ──

func TestVerifyEmail_ValidCode_MarksVerifiedAndIssuesTokens(t *testing.T) {
	user := verifiedUser(t, "p")
	user.IsEmailVerified = false
	uRepo := &stubUserRepo{user: user}
	svc := newSvc(uRepo, &stubCodeRepo{}, &stubTokenRepo{}, jwt.NewJWTManager("secret", 1))

	resp, err := svc.VerifyEmail(&dto.VerifyEmailRequest{Email: user.Email, Code: "123456"})
	if err != nil {
		t.Fatalf("VerifyEmail: %v", err)
	}
	if resp.Tokens.AccessToken == "" {
		t.Error("expected tokens after verification")
	}
	if uRepo.updated == nil || !uRepo.updated.IsEmailVerified {
		t.Error("expected the user to be marked email-verified")
	}
}

func TestVerifyEmail_InvalidCode_Rejected(t *testing.T) {
	svc := newSvc(&stubUserRepo{}, &stubCodeRepo{findErr: repository.ErrCodeNotFound}, &stubTokenRepo{}, jwt.NewJWTManager("secret", 1))

	_, err := svc.VerifyEmail(&dto.VerifyEmailRequest{Email: "student@uni.kz", Code: "000000"})
	if !errors.Is(err, ErrInvalidCode) {
		t.Fatalf("expected ErrInvalidCode, got %v", err)
	}
}

// ── refresh token rotation & revocation ──

func TestRefreshToken_RotatesAndRevokesOld(t *testing.T) {
	mgr := jwt.NewJWTManager("secret", 1)
	user := &models.User{ID: uuid.New(), Email: "student@uni.kz", Role: models.RoleStudent, IsActive: true}
	_, refresh, oldJTI, err := mgr.GenerateTokenPair(user.ID, user.Email, string(user.Role), "")
	if err != nil {
		t.Fatalf("GenerateTokenPair: %v", err)
	}
	tk := &stubTokenRepo{exists: true}
	svc := newSvc(&stubUserRepo{user: user}, &stubCodeRepo{}, tk, mgr)

	resp, err := svc.RefreshToken(refresh)
	if err != nil {
		t.Fatalf("RefreshToken: %v", err)
	}
	if resp.AccessToken == "" || resp.RefreshToken == "" {
		t.Error("expected a fresh token pair")
	}
	if len(tk.deleted) != 1 || tk.deleted[0] != oldJTI {
		t.Errorf("rotation must revoke old JTI %s, deleted=%v", oldJTI, tk.deleted)
	}
	if len(tk.stored) != 1 || tk.stored[0] == oldJTI {
		t.Errorf("rotation must store a new JTI, stored=%v", tk.stored)
	}
}

func TestRefreshToken_Revoked_Rejected(t *testing.T) {
	mgr := jwt.NewJWTManager("secret", 1)
	_, refresh, _, _ := mgr.GenerateTokenPair(uuid.New(), "student@uni.kz", "student", "")
	tk := &stubTokenRepo{exists: false} // absent from store = revoked / already used
	svc := newSvc(&stubUserRepo{user: &models.User{IsActive: true}}, &stubCodeRepo{}, tk, mgr)

	if _, err := svc.RefreshToken(refresh); err == nil {
		t.Fatal("expected error for a revoked refresh token")
	}
}

func TestRefreshToken_AccessTokenRejected(t *testing.T) {
	mgr := jwt.NewJWTManager("secret", 1)
	access, _ := mgr.GenerateAccessToken(uuid.New(), "student@uni.kz", "student", "")
	svc := newSvc(&stubUserRepo{}, &stubCodeRepo{}, &stubTokenRepo{exists: true}, mgr)

	if _, err := svc.RefreshToken(access); err == nil {
		t.Fatal("expected error when using an access token to refresh")
	}
}

func TestLogout_RevokesRefreshToken(t *testing.T) {
	mgr := jwt.NewJWTManager("secret", 1)
	_, refresh, jti, _ := mgr.GenerateTokenPair(uuid.New(), "student@uni.kz", "student", "")
	tk := &stubTokenRepo{}
	svc := newSvc(&stubUserRepo{}, &stubCodeRepo{}, tk, mgr)

	if err := svc.Logout(refresh); err != nil {
		t.Fatalf("Logout: %v", err)
	}
	if len(tk.deleted) != 1 || tk.deleted[0] != jti {
		t.Errorf("Logout must revoke JTI %s, deleted=%v", jti, tk.deleted)
	}
}
