package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "test-secret"

func makeToken(secret, userID, role string) string {
	claims := jwt.MapClaims{
		"user_id": userID,
		"role":    role,
		"exp":     time.Now().Add(time.Hour).Unix(),
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	s, _ := tok.SignedString([]byte(secret))
	return s
}

func authRouter(secret string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/x", AuthMiddleware(secret), func(c *gin.Context) {
		// Echo the headers the middleware injects for downstream services.
		c.String(http.StatusOK, c.GetHeader("X-User-ID")+"|"+c.GetHeader("X-User-Role"))
	})
	return r
}

func req(r *gin.Engine, auth string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	rq := httptest.NewRequest(http.MethodGet, "/x", nil)
	if auth != "" {
		rq.Header.Set("Authorization", auth)
	}
	r.ServeHTTP(w, rq)
	return w
}

func TestAuthMiddleware_NoHeader401(t *testing.T) {
	if got := req(authRouter(testSecret), "").Code; got != http.StatusUnauthorized {
		t.Fatalf("no header: got %d, want 401", got)
	}
}

func TestAuthMiddleware_MalformedHeader401(t *testing.T) {
	if got := req(authRouter(testSecret), "Token abc").Code; got != http.StatusUnauthorized {
		t.Fatalf("malformed header: got %d, want 401", got)
	}
}

func TestAuthMiddleware_GarbageToken401(t *testing.T) {
	if got := req(authRouter(testSecret), "Bearer not.a.jwt").Code; got != http.StatusUnauthorized {
		t.Fatalf("garbage token: got %d, want 401", got)
	}
}

func TestAuthMiddleware_WrongSecret401(t *testing.T) {
	token := makeToken("other-secret", "u1", "student")
	if got := req(authRouter(testSecret), "Bearer "+token).Code; got != http.StatusUnauthorized {
		t.Fatalf("wrong secret: got %d, want 401", got)
	}
}

func TestAuthMiddleware_ValidTokenInjectsHeaders(t *testing.T) {
	token := makeToken(testSecret, "user-123", "employer")
	w := req(authRouter(testSecret), "Bearer "+token)
	if w.Code != http.StatusOK {
		t.Fatalf("valid token: got %d, want 200", w.Code)
	}
	if w.Body.String() != "user-123|employer" {
		t.Errorf("injected headers: got %q, want %q", w.Body.String(), "user-123|employer")
	}
}

func roleRouter(allowed ...string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	// Stand-in for AuthMiddleware: seed the role from a query param when present.
	seed := func(c *gin.Context) {
		if role := c.Query("role"); role != "" {
			c.Set("role", role)
		}
		c.Next()
	}
	r.GET("/x", seed, RoleMiddleware(allowed...), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	return r
}

func roleReq(r *gin.Engine, role string) int {
	w := httptest.NewRecorder()
	path := "/x"
	if role != "" {
		path += "?role=" + role
	}
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
	return w.Code
}

func TestRoleMiddleware_AllowedRolePasses(t *testing.T) {
	if got := roleReq(roleRouter("university", "admin"), "university"); got != http.StatusOK {
		t.Fatalf("allowed role: got %d, want 200", got)
	}
}

func TestRoleMiddleware_DisallowedRoleForbidden(t *testing.T) {
	if got := roleReq(roleRouter("university", "admin"), "student"); got != http.StatusForbidden {
		t.Fatalf("disallowed role: got %d, want 403", got)
	}
}

func TestRoleMiddleware_MissingRoleForbidden(t *testing.T) {
	if got := roleReq(roleRouter("student"), ""); got != http.StatusForbidden {
		t.Fatalf("missing role: got %d, want 403", got)
	}
}
