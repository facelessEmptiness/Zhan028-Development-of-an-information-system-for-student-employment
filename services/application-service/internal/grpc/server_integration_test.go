//go:build integration

// gRPC integration test: a real ApplicationServiceServer is served over an
// in-process bufconn connection and called with the real generated client,
// backed by a Testcontainers PostgreSQL. This exercises the whole vertical
// slice — protobuf (de)serialisation, the gRPC handler, the service, the
// repository and the database — including gRPC status-code mapping that
// unit tests with fakes cannot reach.
package grpc

import (
	"context"
	"fmt"
	"net"
	"strings"
	"testing"
	"time"

	"application-service/internal/config"
	"application-service/internal/grpc/pb"
	"application-service/internal/repository"
	"application-service/internal/service"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/testcontainers/testcontainers-go"
	tcpg "github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
	gormpg "gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func startPG(t *testing.T) *gorm.DB {
	t.Helper()
	ctx := context.Background()

	container, err := tcpg.Run(ctx, "postgres:17-alpine",
		tcpg.WithDatabase("application_db"),
		tcpg.WithUsername("postgres"),
		tcpg.WithPassword("admin"),
		testcontainers.WithWaitStrategy(
			wait.ForSQL("5432/tcp", "pgx", func(host, port string) string {
				port = strings.TrimSuffix(port, "/tcp")
				return fmt.Sprintf("postgres://postgres:admin@%s:%s/application_db?sslmode=disable", host, port)
			}).WithStartupTimeout(60*time.Second),
		),
	)
	if err != nil {
		t.Fatalf("start postgres container: %v", err)
	}
	t.Cleanup(func() { _ = container.Terminate(ctx) })

	host, _ := container.Host(ctx)
	port, _ := container.MappedPort(ctx, "5432")

	cfg := &config.Config{
		DBHost: host, DBPort: port.Port(),
		DBUser: "postgres", DBPassword: "admin",
		DBName: "application_db", DBSSLMode: "disable",
	}
	if err := config.RunMigrations(cfg); err != nil {
		t.Fatalf("run migrations: %v", err)
	}

	dsn := fmt.Sprintf("host=%s port=%s user=postgres password=admin dbname=application_db sslmode=disable", host, port.Port())
	db, err := gorm.Open(gormpg.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("gorm open: %v", err)
	}
	return db
}

// newGRPCClient wires the real gRPC server over bufconn and returns a client.
func newGRPCClient(t *testing.T, db *gorm.DB) pb.ApplicationServiceClient {
	t.Helper()
	repo := repository.NewApplicationRepository(db)
	srv := NewApplicationGRPCServer(service.NewApplicationService(repo), repo)

	lis := bufconn.Listen(1024 * 1024)
	grpcServer := grpc.NewServer()
	pb.RegisterApplicationServiceServer(grpcServer, srv)
	go func() { _ = grpcServer.Serve(lis) }()
	t.Cleanup(grpcServer.Stop)

	conn, err := grpc.NewClient("passthrough:///bufnet",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return lis.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		t.Fatalf("grpc client: %v", err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	return pb.NewApplicationServiceClient(conn)
}

func TestApplicationGRPC_ApplyFlow_Integration(t *testing.T) {
	client := newGRPCClient(t, startPG(t))
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	studentID := uuid.New().String()
	req := &pb.ApplyRequest{
		StudentId:   studentID,
		VacancyId:   uuid.New().String(),
		EmployerId:  uuid.New().String(),
		CoverLetter: "Please consider me",
		MatchScore:  80,
	}

	// First apply succeeds and round-trips through gRPC + the real DB.
	app, err := client.Apply(ctx, req)
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}
	if app.Status != "applied" || app.MatchScore != 80 || app.StudentId != studentID {
		t.Errorf("unexpected application: %+v", app)
	}

	// Re-applying to the same vacancy must surface as gRPC AlreadyExists.
	if _, err := client.Apply(ctx, req); status.Code(err) != codes.AlreadyExists {
		t.Errorf("duplicate apply: got code %v, want AlreadyExists", status.Code(err))
	}

	// GetMyApplications returns the persisted record.
	list, err := client.GetMyApplications(ctx, &pb.GetMyApplicationsRequest{StudentId: studentID})
	if err != nil {
		t.Fatalf("GetMyApplications: %v", err)
	}
	if len(list.Applications) != 1 {
		t.Fatalf("expected 1 application, got %d", len(list.Applications))
	}
}

func TestApplicationGRPC_InvalidUUID_Integration(t *testing.T) {
	client := newGRPCClient(t, startPG(t))
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err := client.Apply(ctx, &pb.ApplyRequest{
		StudentId:  "not-a-uuid",
		VacancyId:  uuid.New().String(),
		EmployerId: uuid.New().String(),
	})
	if status.Code(err) != codes.InvalidArgument {
		t.Errorf("invalid student_id: got code %v, want InvalidArgument", status.Code(err))
	}
}
