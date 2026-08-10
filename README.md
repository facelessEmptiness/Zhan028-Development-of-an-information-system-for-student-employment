# Информационная система трудоустройства студентов — CareerBond

Платформа для автоматизации процесса трудоустройства выпускников вузов Казахстана. Система связывает студентов, работодателей и университеты в едином цифровом пространстве. Доступна в виде веб-сайта и мобильного приложения (Android).

---

## Архитектура системы

```
┌─────────────────────────────────────────────────────────────┐
│                         Клиенты                             │
│  Веб (React 19 + Vite)       Мобилка (React Native + Expo)  │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP / WebSocket
               ┌────────▼────────┐
               │  nginx (:80)    │  ← TLS, WS upgrade (/ws)
               └────────┬────────┘
                        │
               ┌────────▼────────┐
               │  api-gateway    │  :8080 — JWT, маршрутизация
               └────────┬────────┘
         ┌──────────────┼──────────────────────┐
    gRPC │         gRPC │                 HTTP │
  ┌──────▼──┐   ┌───────▼──┐   ┌──────────────▼──────────┐
  │ student │   │ employer │   │   application-service    │
  │ service │   │ service  │   │  чат · интервью ·        │
  │  :50051 │   │  :50052  │   │  трудоустройство · notif │
  └─────────┘   └──────────┘   └─────────────────────────┘
  ┌─────────┐   ┌──────────┐
  │univers. │   │   auth   │
  │ service │   │ service  │
  │  :50053 │   │  :8081   │
  └─────────┘   └──────────┘
         │                │
  ┌──────▼────────────────▼──────────────────┐
  │  PostgreSQL × 5  │  Redis 7  │   MinIO   │
  └──────────────────────────────────────────┘
```

## Мой вклад

Проект командный. Моя часть:
- Спроектировал и реализовал API Gateway — единую точку входа с JWT-аутентификацией и RBAC-middleware
- Разработал auth-service: регистрация, вход, аутентификация
- Реализовал student-service
- Добавил state machine для обработки статусов грантовых обязательств (application-service)
- Написал unit-, интеграционные (Testcontainers) и e2e-тесты для ключевых сервисов
- Настроил Docker-контейнеризацию и сетевое взаимодействие сервисов
- Реализовал push-уведомления на мобильном приложении (FCM)

### Описание сервисов

| Сервис | Назначение | Транспорт |
|--------|-----------|-----------|
| **api-gateway** | Единая точка входа, JWT-аутентификация, маршрутизация | HTTP + WebSocket |
| **auth-service** | Регистрация, вход, email-верификация, JWT, сброс пароля | HTTP |
| **student-service** | Профиль студента, документы (CV, диплом, сертификаты), уведомления | gRPC + HTTP |
| **employer-service** | Профиль работодателя, вакансии, кэш в Redis | gRPC |
| **university-service** | Справочник университетов | gRPC |
| **application-service** | Заявки, чат, собеседования, трудоустройство, уведомления (SSE) | gRPC + HTTP + WebSocket |

---

## Технологический стек

**Backend:**
- Go 1.23 — все микросервисы
- gRPC + Protocol Buffers — межсервисная коммуникация
- Gin — HTTP-фреймворк
- gorilla/websocket — WebSocket чат
- GORM — ORM для PostgreSQL
- PostgreSQL 17 — хранение данных (5 независимых БД)
- Redis 7 — кэш вакансий, коды верификации
- MinIO — хранилище файлов (CV, дипломы)

**Веб-фронтенд:**
- React 19 + TypeScript
- Vite — сборщик
- Tailwind CSS — стилизация
- react-i18next — интернационализация (RU / EN / KZ)
- React Router 7
- nginx — раздача статики + проксирование API и WebSocket

**Мобильное приложение:**
- React Native 0.76 + Expo SDK 54
- TypeScript
- React Navigation 7 — навигация
- react-i18next — мультиязычность (RU / EN / KZ)
- expo-secure-store — хранение токенов
- expo-document-picker — загрузка документов

**Инфраструктура:**
- Docker + Docker Compose — оркестрация всего стека

---

## Требования

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 24+
- [Docker Compose](https://docs.docker.com/compose/) v2
- Gmail-аккаунт с [App Password](https://myaccount.google.com/apppasswords) для отправки email
- Node.js 20+ (только для локальной разработки веба/мобилки)

> Node.js и Go устанавливать **не нужно** для запуска через Docker.

---

## Быстрый старт

### 1. Клонировать репозиторий

```bash
git clone <url-репозитория>
cd Development-of-an-information-system-for-student-employment
```

### 2. Создать файл `.env`

```bash
cp .env.example .env
```

Открыть `.env` и заполнить значения:

```env
# Пароль для всех PostgreSQL баз
POSTGRES_PASSWORD=ваш_пароль

# Секрет для подписи JWT (минимум 32 символа)
JWT_SECRET=очень_длинный_и_случайный_секретный_ключ_32+

# Настройки Gmail SMTP для отправки писем
SMTP_USER=ваш_email@gmail.com
SMTP_PASSWORD=xxxx_xxxx_xxxx_xxxx   # 16-значный App Password от Google
SMTP_FROM=ваш_email@gmail.com

# MinIO (объектное хранилище)
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123

# Разрешённые origins для CORS
ALLOWED_ORIGINS=http://localhost:3000
```

> **Как получить Gmail App Password:**
> 1. Перейти на [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
> 2. Создать новый пароль для приложения
> 3. Скопировать 16-значный код в `SMTP_PASSWORD`

### 3. Запустить систему

```bash
docker compose up -d --build
```

Первый запуск занимает **3–5 минут** (сборка образов, загрузка зависимостей).

### 4. Проверить статус

```bash
docker compose ps
```

Все контейнеры должны иметь статус `running` или `healthy`.

### 5. Открыть приложение

| URL | Описание |
|---|---|
| [http://localhost:3000](http://localhost:3000) | Веб-приложение |
| [http://localhost:8000](http://localhost:8000) | API Gateway |
| [http://localhost:9001](http://localhost:9001) | MinIO Console |

---

## Мобильное приложение

### Локальная разработка

```bash
cd mobile
npm install
npx expo start
```

Отсканировать QR-код приложением **Expo Go**, или нажать `a` для Android-эмулятора.

### Конфигурация API

Перед запуском обновить [mobile/src/config.ts](mobile/src/config.ts):

```typescript
// Локальная разработка (IP вашей машины в локальной сети):
export const API_BASE = 'http://192.168.1.x:8000';

// Продакшн:
export const API_BASE = 'https://careerbond.app';
```

### Сборка APK (Android)

```bash
cd mobile
npx eas build -p android --profile preview
```

---

## Порты сервисов

| Сервис | Порт | Описание |
|--------|------|----------|
| Frontend (nginx) | `3000` | Веб-интерфейс |
| API Gateway | `8000` | REST API + WebSocket |
| Auth Service | `8081` | Аутентификация |
| Student Service HTTP | `8082` | Документы, уведомления |
| Application Service HTTP | `8083` | Чат, собеседования |
| Student Service gRPC | `50051` | gRPC |
| Employer Service gRPC | `50052` | gRPC |
| University Service gRPC | `50053` | gRPC |
| Application Service gRPC | `50054` | gRPC |
| users-db | `5432` | PostgreSQL |
| student-db | `5433` | PostgreSQL |
| employer-db | `5434` | PostgreSQL |
| university-db | `5435` | PostgreSQL |
| application-db | `5436` | PostgreSQL |
| Redis | `6379` | Кэш |
| MinIO API | `9000` | Объектное хранилище |
| MinIO Console | `9001` | Веб-интерфейс MinIO |

---

## Роли пользователей

| Роль | Возможности |
|------|------------|
| **Студент** | Профиль с навыками, загрузка документов (CV/диплом), поиск вакансий с % совпадения навыков, отклик, чат с работодателем, просмотр статуса заявок и собеседований |
| **Работодатель** | Создание вакансий, просмотр кандидатов, назначение собеседований, оформление трудоустройства, чат со студентами |
| **Университет** | Аналитика трудоустройства: % трудоустроенных, топ работодатели, статистика по специальностям |

---

## Статусы заявок

```
applied → review → shortlisted → interview → offered
                               ↘ rejected
```

---

## Чат и уведомления

**Чат:**
- Реализован через WebSocket: `ws://host/ws/chat/:application_id?token=<jwt>`
- Nginx проксирует `/ws` с заголовками `Upgrade` и `Connection: upgrade`
- REST fallback: `GET/POST /api/chat/:application_id`

**Уведомления:**
- Веб: Server-Sent Events (SSE) — `GET /api/notifications/stream`
- Мобилка: поллинг каждые 30 секунд + callback при получении WS-сообщения
- Типы: `application_received`, `status_updated`, `interview_scheduled`, `chat_message`

---

## Интернационализация (i18n)

Полная поддержка **RU / EN / KZ** в веб-сайте и мобильном приложении.

- Файлы переводов веб: `web/src/i18n/locales/{ru,en,kz}.json`
- Файлы переводов мобилки: `mobile/src/i18n/locales/{ru,en,kz}.json`
- Мобилка сохраняет выбранный язык в `AsyncStorage`
- Все даты отображаются в локали выбранного языка: `kk-KZ`, `en-US`, `ru-RU`

---

## Тестовый сценарий

1. Зарегистрироваться как **студент** → подтвердить email
2. Заполнить профиль (ИИН, специализация, навыки, ВУЗ)
3. Загрузить CV или диплом
4. Зарегистрироваться как **работодатель** → создать вакансию
5. Студент откликается на вакансию (система рассчитывает % совпадения навыков)
6. Работодатель меняет статус → студент получает уведомление
7. Работодатель назначает собеседование
8. Студент и работодатель общаются через чат
9. После найма работодатель создаёт запись о трудоустройстве
10. **Университет** видит аналитику на дашборде

---

## Структура проекта

```
.
├── services/
│   ├── api-gateway/          # Gin, JWT-middleware, WebSocket-прокси
│   ├── auth-service/         # Регистрация, вход, email, сброс пароля
│   ├── student-service/      # Профили и документы студентов, SSE уведомления
│   ├── employer-service/     # Вакансии и профили работодателей (Redis кэш)
│   ├── university-service/   # Справочник университетов
│   └── application-service/  # Заявки, чат (WS), собеседования, трудоустройство
├── web/                      # React 19 + TypeScript веб-приложение
│   ├── src/
│   │   ├── pages/            # Страницы маршрутизации
│   │   ├── components/       # Переиспользуемые UI-компоненты
│   │   ├── services/         # API-клиенты (по одному на домен)
│   │   ├── context/          # AuthContext, глобальное состояние
│   │   ├── utils/            # parseSkills, calculateSkillMatch, debounce
│   │   └── i18n/             # Переводы RU / EN / KZ
│   ├── nginx.conf
│   └── Dockerfile
├── mobile/                   # React Native + Expo мобильное приложение
│   ├── src/
│   │   ├── screens/          # Экраны по ролям
│   │   ├── components/       # Общие компоненты (Icon, etc.)
│   │   ├── services/         # API-сервисы с авторизацией и refresh токена
│   │   ├── navigation/       # React Navigation (стек + табы по ролям)
│   │   ├── context/          # AuthContext
│   │   ├── utils/            # langToLocale, dateUtils
│   │   └── i18n/             # Переводы RU / EN / KZ
│   ├── app.json
│   └── app.tsx
├── docker-compose.yml
└── .env.example
```

---

## Управление контейнерами

```bash
# Запустить все сервисы
docker compose up -d

# Остановить все сервисы (данные сохраняются)
docker compose down

# Остановить и удалить все данные (сброс БД)
docker compose down -v

# Пересобрать конкретный сервис
docker compose build <имя-сервиса> && docker compose up -d <имя-сервиса>

# Просмотр логов сервиса
docker compose logs -f <имя-сервиса>

# Примеры:
docker compose logs -f api-gateway
docker compose logs -f auth-service
docker compose logs -f frontend
```

---

## Устранение неполадок

**Контейнер не запускается:**
```bash
docker compose logs <имя-сервиса>
```

**Список университетов пуст при регистрации:**
Перезагрузить страницу — первый запрос после холодного старта может занять 5–10 секунд.

**Email-верификация не приходит:**
Проверить `SMTP_USER` и `SMTP_PASSWORD` в `.env`. Пароль должен быть App Password, не обычный пароль Google.

**WebSocket чат не подключается (статус "Подключение..."):**
Проверить, что в `web/nginx.conf` есть блок `location /ws` с заголовками `Upgrade` и `Connection: upgrade`. Пересобрать `frontend` контейнер после изменений nginx.

**Полный сброс системы (пересоздание БД):**
```bash
docker compose down -v
docker compose up -d --build
```
