package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"employer-service/internal/dto"
	"employer-service/internal/models"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

const vacancyCacheTTL = 30 * time.Second
const vacancyByIDTTL = 5 * time.Minute

type cachedVacancyService struct {
	inner VacancyService
	rdb   *redis.Client
}

func NewCachedVacancyService(inner VacancyService, rdb *redis.Client) VacancyService {
	return &cachedVacancyService{inner: inner, rdb: rdb}
}

type vacancySearchResult struct {
	Vacancies []models.Vacancy `json:"vacancies"`
	Total     int64            `json:"total"`
}

func searchCacheKey(params SearchParams) string {
	return fmt.Sprintf("vacancies:search:%s:%s:%s:%d:%d",
		params.Search, params.JobType, params.Location, params.Page, params.PageSize)
}

func vacancyIDCacheKey(id uuid.UUID) string {
	return fmt.Sprintf("vacancies:id:%s", id)
}

func (s *cachedVacancyService) GetAllVacancies(params SearchParams) ([]models.Vacancy, int64, error) {
	ctx := context.Background()
	key := searchCacheKey(params)

	if cached, err := s.rdb.Get(ctx, key).Result(); err == nil {
		var result vacancySearchResult
		if json.Unmarshal([]byte(cached), &result) == nil {
			log.Printf("[Cache] HIT vacancies:search %+v", params)
			return result.Vacancies, result.Total, nil
		}
	}

	vacancies, total, err := s.inner.GetAllVacancies(params)
	if err != nil {
		return nil, 0, err
	}

	if data, jsonErr := json.Marshal(vacancySearchResult{Vacancies: vacancies, Total: total}); jsonErr == nil {
		s.rdb.Set(ctx, key, data, vacancyCacheTTL)
		log.Printf("[Cache] SET vacancies:search %+v (TTL=%s)", params, vacancyCacheTTL)
	}
	return vacancies, total, nil
}

func (s *cachedVacancyService) GetVacancyByID(id uuid.UUID) (*models.Vacancy, error) {
	ctx := context.Background()
	key := vacancyIDCacheKey(id)

	if cached, err := s.rdb.Get(ctx, key).Result(); err == nil {
		var v models.Vacancy
		if json.Unmarshal([]byte(cached), &v) == nil {
			log.Printf("[Cache] HIT vacancies:id %s", id)
			return &v, nil
		}
	}

	vacancy, err := s.inner.GetVacancyByID(id)
	if err != nil {
		return nil, err
	}

	if data, jsonErr := json.Marshal(vacancy); jsonErr == nil {
		s.rdb.Set(ctx, key, data, vacancyByIDTTL)
		log.Printf("[Cache] SET vacancies:id %s (TTL=%s)", id, vacancyByIDTTL)
	}
	return vacancy, nil
}

func (s *cachedVacancyService) CreateVacancy(employerID uuid.UUID, req *dto.CreateVacancyRequest) (*models.Vacancy, error) {
	vacancy, err := s.inner.CreateVacancy(employerID, req)
	if err != nil {
		return nil, err
	}
	s.invalidateSearchCache()
	return vacancy, nil
}

func (s *cachedVacancyService) UpdateVacancy(id uuid.UUID, employerID uuid.UUID, req *dto.UpdateVacancyRequest) (*models.Vacancy, error) {
	vacancy, err := s.inner.UpdateVacancy(id, employerID, req)
	if err != nil {
		return nil, err
	}
	ctx := context.Background()
	s.rdb.Del(ctx, vacancyIDCacheKey(id))
	s.invalidateSearchCache()
	return vacancy, nil
}

func (s *cachedVacancyService) DeleteVacancy(id uuid.UUID, employerID uuid.UUID) error {
	if err := s.inner.DeleteVacancy(id, employerID); err != nil {
		return err
	}
	ctx := context.Background()
	s.rdb.Del(ctx, vacancyIDCacheKey(id))
	s.invalidateSearchCache()
	return nil
}

func (s *cachedVacancyService) GetMyVacancies(employerID uuid.UUID) ([]models.Vacancy, error) {
	return s.inner.GetMyVacancies(employerID)
}

// invalidateSearchCache сбрасывает все кэшированные результаты поиска вакансий
func (s *cachedVacancyService) invalidateSearchCache() {
	ctx := context.Background()
	iter := s.rdb.Scan(ctx, 0, "vacancies:search:*", 100).Iterator()
	for iter.Next(ctx) {
		s.rdb.Del(ctx, iter.Val())
	}
	log.Println("[Cache] INVALIDATED vacancies:search:*")
}
