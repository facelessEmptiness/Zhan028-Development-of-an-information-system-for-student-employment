# Документация по фронтенду — CareerBond
### Подготовка к защите диплома

---

## СОДЕРЖАНИЕ

1. [Обзор архитектуры фронтенда](#1-обзор-архитектуры)
2. [Веб-приложение (React 19 + Vite)](#2-веб-приложение)
3. [Мобильное приложение (React Native + Expo)](#3-мобильное-приложение)
4. [Сравнительная таблица Web vs Mobile](#4-сравнение-web-и-mobile)
5. [Вопросы комиссии и ответы](#5-вопросы-и-ответы)

---

## 1. ОБЗОР АРХИТЕКТУРЫ

```
┌─────────────────────────────────────────────────────────────┐
│                     КЛИЕНТСКИЙ СЛОЙ                         │
│                                                             │
│  Web (React 19 + Vite + TypeScript + Tailwind CSS)          │
│  ├── nginx:80 → раздаёт статику dist/                       │
│  └── проксирует /api и /ws → api-gateway:8080               │
│                                                             │
│  Mobile (React Native 0.76 + Expo SDK 54 + TypeScript)      │
│  ├── iOS / Android APK                                      │
│  └── HTTP + WebSocket → api-gateway напрямую                │
└─────────────────────────────────────────────────────────────┘
```

**Оба фронтенда общаются ТОЛЬКО с одной точкой входа — api-gateway:8080.**
Все запросы к микросервисам (Go gRPC) проходят через него.

---

## 2. ВЕБ-ПРИЛОЖЕНИЕ

### 2.1 Технологический стек

| Технология | Версия | Назначение |
|---|---|---|
| React | 19.2 | UI-библиотека |
| TypeScript | 5.9 | Строгая типизация |
| Vite | 7.2 | Сборщик + dev-server |
| React Router | 7 | Клиентская маршрутизация (SPA) |
| Tailwind CSS | 4.1 | Utility-first CSS |
| react-i18next | 17 | Интернационализация (RU/EN/KZ) |
| sonner | 2.0 | Toast-уведомления |
| nginx | alpine | Prod-сервер + reverse-proxy |

### 2.2 Структура проекта

```
web/src/
├── context/
│   └── AuthContext.tsx        # Глобальное состояние аутентификации
├── pages/                     # Страницы (маршруты)
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── VerifyEmailPage.tsx
│   ├── ForgotPasswordPage.tsx
│   ├── ResetPasswordPage.tsx
│   ├── HomePage.tsx           # Дашборд (роль-зависимый)
│   ├── BrowseJobsPage.tsx     # Поиск вакансий
│   ├── JobDetailsPage.tsx
│   ├── StudentProfilePage.tsx # Профиль + заявки + документы
│   ├── EmployerDashboardPage.tsx
│   ├── CandidateDetailPage.tsx
│   ├── UniversityAnalyticsPage.tsx
│   └── NotFoundPage.tsx
├── components/
│   ├── ChatModal.tsx          # WebSocket чат
│   ├── ProtectedRoute.tsx     # Гард авторизации
│   ├── RoleBasedRoute.tsx     # Гард по роли
│   ├── LanguageSelector.tsx   # Переключатель языка
│   ├── MatchIndex.tsx         # Индикатор % совпадения навыков
│   ├── Header.tsx
│   └── Icon.tsx
├── services/                  # API-клиенты
│   ├── authService.ts
│   ├── applicationService.ts
│   ├── jobService.ts
│   ├── chatService.ts
│   ├── documentService.ts
│   ├── interviewService.ts
│   ├── notificationService.ts
│   ├── employmentService.ts
│   └── complianceService.ts
├── utils/
│   ├── apiClient.ts           # fetch-обёртка с авто-рефрешем
│   └── index.ts               # parseSkills, calculateSkillMatch, debounce
├── i18n/
│   └── locales/
│       ├── ru.json
│       ├── en.json
│       └── kz.json
└── routes/
    └── index.tsx              # Определение маршрутов
```

### 2.3 Маршрутизация (React Router 7)

**Принцип:** Single Page Application. Все URL → index.html, React Router рендерит нужный компонент.

```tsx
// Публичные маршруты (без авторизации)
/login           → LoginPage
/register        → RegisterPage
/verify-email    → VerifyEmailPage
/forgot-password → ForgotPasswordPage
/reset-password  → ResetPasswordPage

// Защищённые маршруты (ProtectedRoute)
/                → HomePage (dashboard, зависит от роли)
/jobs            → BrowseJobsPage
/job/:id         → JobDetailsPage

// Только студент
/profile         → StudentProfilePage

// Только работодатель (RoleBasedRoute role="employer")
/employer-dashboard  → EmployerDashboardPage
/candidate/:id       → CandidateDetailPage

// Только университет
/analytics       → UniversityAnalyticsPage
```

**Защита маршрутов — двухуровневая:**

```tsx
// Уровень 1 — проверка авторизации
<ProtectedRoute>   // если !user → redirect /login
  // Уровень 2 — проверка роли
  <RoleBasedRoute allowedRoles={['employer']}>
    <EmployerDashboardPage />
  </RoleBasedRoute>
</ProtectedRoute>
```

### 2.4 Управление состоянием (AuthContext)

**Хранение токенов: localStorage**

```typescript
localStorage['access_token']   // JWT, короткоживущий (~15 мин)
localStorage['refresh_token']  // JWT, долгоживущий (~7 дней)
localStorage['last_activity']  // Timestamp последней активности
```

**Жизненный цикл сессии:**

```
1. Вход:
   POST /api/auth/login → access_token + refresh_token → localStorage

2. Загрузка приложения:
   Читаем токены из localStorage →
   GET /api/auth/me (валидация) →
   Если 401 → POST /api/auth/refresh → новые токены
   Если refresh тоже 401 → разлогиниться

3. Каждый запрос:
   apiClient добавляет "Authorization: Bearer {access_token}"
   Если 401 → авто-рефреш → повторить запрос

4. Таймаут бездействия (30 мин):
   Слушаем: mousedown, keydown, scroll, touchstart
   Каждое событие → сбрасываем таймер
   Через 30 мин без действий → clearSession() → /login
```

### 2.5 API-клиент (apiClient.ts)

Тонкая обёртка над `fetch` с двумя ключевыми возможностями:

1. **Авто-добавление токена** ко всем запросам
2. **Авто-рефреш** при получении 401 (очередь запросов)

```typescript
// Паттерн очереди при рефреше
let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];

async function apiFetch(url, options) {
  const token = localStorage.getItem('access_token');
  // Добавляем токен
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}` } });

  if (response.status === 401) {
    if (isRefreshing) {
      // Ставим в очередь — ждём нового токена
      return new Promise(resolve => pendingRequests.push(resolve));
    }
    isRefreshing = true;
    const newToken = await refreshTokens();  // POST /api/auth/refresh
    isRefreshing = false;
    pendingRequests.forEach(cb => cb(newToken));
    pendingRequests = [];
    // Повторяем исходный запрос с новым токеном
    return apiFetch(url, options);
  }
  return response;
}
```

### 2.6 Алгоритм расчёта совпадения навыков

**Файл:** `web/src/utils/index.ts`

```typescript
function calculateSkillMatch(studentSkills: string[], vacancySkills: string[]): number {
  // Если вакансия не требует навыков → нейтральный балл 50
  if (vacancySkills.length === 0) return 50;
  // Если у студента нет навыков → минимальный балл 10
  if (studentSkills.length === 0) return 10;

  let matched = 0;
  for (const required of vacancySkills) {
    // Нечёткое совпадение: "Python" === "python" (case-insensitive + substring)
    const found = studentSkills.some(s =>
      s.toLowerCase().includes(required.toLowerCase()) ||
      required.toLowerCase().includes(s.toLowerCase())
    );
    if (found) matched++;
  }
  return Math.round((matched / vacancySkills.length) * 100);
}
```

**Визуализация (MatchIndex компонент):**
- 80–100% → Зелёный ✅ Отличное совпадение
- 60–79% → Синий 🔵 Хорошее совпадение
- 40–59% → Жёлтый ⚠️ Частичное совпадение
- <40% → Красный ❌ Низкое совпадение

### 2.7 Реальное время: WebSocket чат + SSE уведомления

#### WebSocket чат (`ChatModal.tsx`)

```typescript
// Подключение
const ws = new WebSocket(
  `${proto}://${location.host}/ws/chat/${applicationId}?token=${accessToken}`
);
// Токен передаётся в URL (браузер не поддерживает custom headers для WS)

// Обработка входящих сообщений
ws.onmessage = (e) => {
  const data = JSON.parse(e.data);

  // Presence-событие (онлайн-статус)
  if (data.type === 'presence') {
    if (data.user_id !== user.id) setOtherOnline(data.online);
    return;
  }

  // Обычное сообщение
  setMessages(prev =>
    prev.some(m => m.id === data.id) ? prev : [...prev, data]
  );
};

// Авто-реконнект при разрыве
ws.onclose = () => setTimeout(connect, 3000);
```

**Presence (статус онлайн/оффлайн):**
- Бэкенд Hub отслеживает подключённых пользователей по `UserID`
- При подключении → `broadcastPresence(online: true)` всем в комнате
- При отключении → `broadcastPresence(online: false)`
- Фронтенд обрабатывает `type: "presence"` отдельно от сообщений

#### SSE уведомления

Уведомления приходят через Server-Sent Events:
```
GET /api/notifications/stream   (Content-Type: text/event-stream)
```
Когда новое уведомление → SSE-событие → обновление бейджа в header.

### 2.8 Интернационализация (i18n)

**Файлы переводов:** `web/src/i18n/locales/{ru,en,kz}.json`

```typescript
// Инициализация
i18next.init({
  lng: 'ru',           // Язык по умолчанию — русский
  fallbackLng: 'ru',   // Фолбек
  resources: { ru, en, kz }
});

// Использование в компоненте
const { t, i18n } = useTranslation();
t('login.title')            // → "Войти" / "Sign In" / "Кіру"
i18n.changeLanguage('kz')   // Переключить язык
```

**На вебе язык не сохраняется** (только для текущей сессии).
На мобиле — сохраняется в AsyncStorage.

### 2.9 Docker + nginx

**Двухэтапная сборка (multi-stage build):**

```dockerfile
# Этап 1: Сборка React-приложения
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build          # tsc -b && vite build → dist/

# Этап 2: Production nginx-сервер
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**nginx.conf — ключевые блоки:**

```nginx
# SPA-роутинг: все URL → index.html
location / {
  try_files $uri $uri/ /index.html;
}

# Проксирование API
location /api {
  proxy_pass http://api-gateway:8080;
}

# WebSocket для чата (обязательно upgrade-заголовки!)
location /ws {
  proxy_pass http://api-gateway:8080;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 3600s;
}
```

---

## 3. МОБИЛЬНОЕ ПРИЛОЖЕНИЕ

### 3.1 Технологический стек

| Технология | Версия | Назначение |
|---|---|---|
| React Native | 0.76 | UI для Android/iOS |
| Expo SDK | 54 | Managed workflow + нативные модули |
| TypeScript | 5.x | Типизация |
| React Navigation | 7 | Стек/таб навигация |
| react-i18next | 17 | i18n с AsyncStorage-персистентностью |
| expo-secure-store | ~14 | Шифрованное хранилище токенов |
| expo-document-picker | ~13 | Загрузка PDF/документов |
| expo-notifications | ~0.32 | Push-уведомления |
| react-native-safe-area-context | — | Безопасные отступы (notch/Dynamic Island) |
| EAS Build | — | Облачная сборка APK/AAB |

### 3.2 Навигационная архитектура

```
App.tsx
└── NavigationContainer (ref для push-навигации)
    └── RootStack
        ├── MainTabs (на основе user.role)
        │   ├── StudentTabs (синий #2563EB)
        │   │   ├── HomeStack: Home → JobDetail → Employment
        │   │   ├── JobsStack: Jobs → JobDetail → Chat
        │   │   ├── ApplicationsStack: Applications → Interviews → Chat
        │   │   ├── ChatsStack: ChatsList → Chat
        │   │   └── Profile: StudentProfileEdit
        │   ├── EmployerTabs (фиолетовый #7C3AED)
        │   │   ├── VacanciesStack: Vacancies → Form → Applications → CandidateDetail → Chat
        │   │   ├── ChatsStack: ChatsList → Chat
        │   │   ├── Interviews (прямой экран)
        │   │   ├── CompanyProfile (прямой экран)
        │   │   └── Account
        │   └── UniversityTabs (зелёный #059669)
        │       ├── AnalyticsStack: Analytics → Students
        │       └── Account
        └── NotificationsScreen (модальный оверлей)
```

### 3.3 Хранение токенов: SecureStore vs AsyncStorage

| | SecureStore | AsyncStorage |
|---|---|---|
| Шифрование | ✅ Аппаратное (Keychain/Keystore) | ❌ Открытый текст |
| Доступ других приложений | ❌ Заблокирован | ⚠️ Потенциально доступен |
| Используется для | access_token, refresh_token, user | language (i18n), кэш API |

```typescript
// Сохранение при входе
await SecureStore.setItemAsync('access_token', tokens.access_token);
await SecureStore.setItemAsync('refresh_token', tokens.refresh_token);
await SecureStore.setItemAsync('user', JSON.stringify(user));

// Чтение при запросе
const token = await SecureStore.getItemAsync('access_token');

// Удаление при выходе
await SecureStore.deleteItemAsync('access_token');
await SecureStore.deleteItemAsync('refresh_token');
```

### 3.4 Рефреш токенов на мобиле (очередь запросов)

```typescript
let isRefreshing = false;
const pendingQueue: Array<(token: string) => void> = [];

async function apiFetch(path: string, options: RequestInit) {
  const token = await SecureStore.getItemAsync('access_token');
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: { 'Authorization': `Bearer ${token}`, ...options.headers }
  });

  if (response.status === 401) {
    if (isRefreshing) {
      // Ждём завершения рефреша
      return new Promise<Response>(resolve => {
        pendingQueue.push((newToken) => resolve(apiFetch(path, options)));
      });
    }

    isRefreshing = true;
    try {
      const refresh = await SecureStore.getItemAsync('refresh_token');
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refresh })
      });
      const { access_token } = await res.json();
      await SecureStore.setItemAsync('access_token', access_token);
      pendingQueue.forEach(cb => cb(access_token));
      pendingQueue.length = 0;
      return apiFetch(path, options); // Повторяем с новым токеном
    } catch {
      // Рефреш не удался → разлогиниться
      await SecureStore.deleteItemAsync('access_token');
      setUser(null);
    } finally {
      isRefreshing = false;
    }
  }

  return response;
}
```

### 3.5 Push-уведомления (полный цикл)

```
[Mobile App]                    [Backend]                    [Expo Push API]
    │                               │                               │
    │ Вход пользователя             │                               │
    │──requestPermissions()────────>│                               │
    │<──────────granted─────────────│                               │
    │──getExpoPushTokenAsync()──────>EAS servers                    │
    │<──"ExponentPushToken[xxx]"────│                               │
    │                               │                               │
    │──POST /api/notifications/──>  │                               │
    │   push-token                  │ Сохраняет в push_tokens БД   │
    │                               │                               │
    │           Событие: смена статуса / новое сообщение            │
    │                               │──POST https://exp.host/─────>│
    │                               │   --/api/v2/push/send        │
    │                               │   {to: token, title, body}   │
    │<──────────────────────────────Системное уведомление───────────│
    │                               │                               │
    │ Тап по уведомлению            │                               │
    │──addNotificationResponseReceivedListener()                    │
    │──navigate("Applications")     │                               │
```

**Обработка при убитом приложении:**
```typescript
// В App.tsx — один раз при запуске
Notifications.getLastNotificationResponseAsync().then(response => {
  if (!response) return;
  const screen = response.notification.request.content.data?.screen;
  setTimeout(() => navigationRef.current?.navigate(screen), 500);
  // 500мс задержка — дать NavigationContainer смонтироваться
});
```

### 3.6 Загрузка документов

```typescript
// 1. Выбор файла
const result = await DocumentPicker.getDocumentAsync({
  type: ['application/pdf', 'image/*'],
  copyToCacheDirectory: true
});

// 2. Формирование FormData
const formData = new FormData();
formData.append('file', {
  uri: result.uri,
  name: result.name,
  type: result.mimeType ?? 'application/octet-stream'
} as any);
formData.append('type', docType); // 'cv' | 'diploma' | 'certificate'

// 3. Загрузка (Content-Type НЕ устанавливаем вручную!)
// React Native автоматически ставит multipart/form-data с boundary
const response = await fetch(`${API_BASE}/api/documents/upload`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  // НЕТ Content-Type — fetch сам поставит boundary
  body: formData
});
```

**Важно:** Если вручную поставить `Content-Type: multipart/form-data`, то boundary не будет указан → сервер не сможет распарсить форму. React Native fetch ставит корректный boundary автоматически.

### 3.7 Таймаут бездействия на мобиле

На мобиле нельзя слушать DOM-события (mousedown, keydown). Используется `AppState`:

```typescript
AppState.addEventListener('change', (nextState) => {
  if (nextState === 'active') {
    // Приложение вернулось на передний план
    const now = Date.now();
    const lastActivity = getLastActivity(); // из AsyncStorage
    const idleTime = now - lastActivity;

    if (idleTime >= 30 * 60 * 1000) {
      logout(); // 30 минут неактивности → выход
    }
  }
});
```

---

## 4. СРАВНЕНИЕ WEB И MOBILE

| Аспект | Web | Mobile |
|---|---|---|
| **Хранение токенов** | localStorage | expo-secure-store (шифрование) |
| **Сохранение языка** | Только сессия | AsyncStorage (постоянно) |
| **State management** | Context API | Context API |
| **WebSocket чат** | WS + HTTP fallback | WS + HTTP fallback |
| **Offline-режим** | Нет | apiFetch кэш (AsyncStorage) |
| **Маршрутизация** | React Router 7 | React Navigation (stack/tab) |
| **Push-уведомления** | SSE (server push) | Expo Notifications (нативные) |
| **Таймаут неактивности** | DOM-события (30 мин) | AppState (30 мин) |
| **Загрузка файлов** | input[type=file] | expo-document-picker |
| **CSS/Стили** | Tailwind CSS | StyleSheet.create() |
| **Сборка** | Docker + nginx | EAS Build (APK/AAB) |
| **Типизация** | TypeScript strict | TypeScript strict |

---

## 5. ВОПРОСЫ И ОТВЕТЫ

---

### БЛОК 1: АРХИТЕКТУРА

**Q: Почему выбрали два отдельных фронтенда (web + mobile), а не один React Native Web?**

A: Разные требования к пользовательскому опыту. Веб-приложение предназначено для работы за компьютером (детальные таблицы аналитики, форматирование резюме), где нужен полноэкранный интерфейс и богатый CSS. Мобильное — для студентов, которые просматривают вакансии и переписываются в чате "на ходу". React Native Web даёт компромисс, который работает везде посредственно. Два отдельных проекта позволили оптимизировать UX для каждой платформы. Код при этом переиспользуется через общий API-контракт.

---

**Q: Почему не использовали Redux или MobX для управления состоянием?**

A: Приложение не требует сложного глобального состояния. Единственное реально глобальное состояние — это данные авторизованного пользователя (user, tokens). Всё остальное — локальное состояние каждой страницы (список вакансий, форма профиля). Context API покрывает эту задачу без лишней сложности и зависимостей. Redux оправдан когда: много компонентов делят одно состояние, требуется time-travel debugging, очень сложные цепочки обновлений. Ни одного из этих случаев в нашем проекте нет.

---

**Q: Почему для веба выбрали Vite, а не Create React App?**

A: Create React App устарел и заморожен в разработке. Vite на порядок быстрее: HMR (горячая замена модулей) за миллисекунды против секунд, потому что использует нативные ES-модули браузера вместо webpack-бандлинга в режиме разработки. Production-сборка использует Rollup — оптимизирует tree-shaking и разбивку на чанки.

---

### БЛОК 2: АУТЕНТИФИКАЦИЯ И БЕЗОПАСНОСТЬ

**Q: Почему токены на вебе хранятся в localStorage, а не в HttpOnly cookie?**

A: Компромисс: localStorage уязвим к XSS-атакам, зато прост в реализации для SPA. HttpOnly cookie лучше защищает от XSS, но создаёт проблемы с CORS и требует настройки SameSite/Secure атрибутов на бэкенде. Для учебного проекта выбран localStorage с компенсирующими мерами: строгий CSP (Content Security Policy), инактивити-логаут, короткоживущий access_token (15 мин). В продакшн-системе предпочтительнее HttpOnly cookie.

---

**Q: Почему на мобиле используется expo-secure-store, а не AsyncStorage?**

A: SecureStore шифрует данные через аппаратный Keychain (iOS) или Keystore (Android). Другое приложение не может получить доступ к этим данным даже при root-доступе к устройству. AsyncStorage — обычный незашифрованный текстовый файл. Хранить JWT в AsyncStorage — всё равно что хранить пароль в открытом файле. Токены доступа к API относятся к секретным данным → только SecureStore.

---

**Q: Как реализована авто-выдача нового access_token при его истечении?**

A: Паттерн "очередь запросов при рефреше":
1. Первый запрос получает 401 → начинает рефреш, ставит флаг `isRefreshing = true`
2. Другие запросы, которые пришли в это время → не делают параллельный рефреш, а встают в очередь `pendingQueue`
3. После успешного рефреша → новый токен рассылается по очереди, все запросы повторяются
4. При ошибке рефреша → пользователь выходит из системы

Без этого паттерна при одновременных запросах происходит "гонка рефрешей" — несколько параллельных POST /auth/refresh, что приводит к инвалидации рефреш-токена.

---

**Q: Как работает таймаут бездействия 30 минут?**

A: На вебе — через DOM-события. Слушаем `mousedown`, `keydown`, `scroll`, `touchstart`. Каждое событие сбрасывает таймер. Если 30 минут без событий → `clearSession()`. Время последней активности пишем в localStorage для возможности восстановить после перезагрузки страницы.

На мобиле — через `AppState` API. При переходе в фоновый режим сохраняем timestamp. При возврате — проверяем разницу. Если > 30 мин → logout.

---

### БЛОК 3: ВЗАИМОДЕЙСТВИЕ С БЭКЕНДОМ

**Q: Как фронтенд общается с микросервисами? Напрямую или через gateway?**

A: Только через api-gateway. Фронтенд никогда не знает о существовании отдельных микросервисов. Все запросы идут на один адрес — `api-gateway:8080`. Gateway проверяет JWT, извлекает `user_id` и `role`, добавляет их как заголовки (`X-User-ID`, `X-User-Role`) и проксирует запрос в нужный микросервис. Это центральная точка контроля безопасности.

---

**Q: Как реализован реальный чат? Почему WebSocket, а не HTTP-поллинг?**

A: HTTP-поллинг — это когда клиент каждые N секунд спрашивает "есть новые сообщения?". Это:
- Лишняя нагрузка на сервер (99% запросов холостые)
- Задержка до N секунд
- Расход трафика и батареи на мобиле

WebSocket — постоянное двустороннее соединение. Сервер сам проталкивает сообщение в момент его появления. Задержка < 100мс, нет лишних запросов. В нашем проекте: клиент подключается к `/ws/chat/{id}?token=jwt`, сервер держит соединение и мгновенно рассылает сообщения всем участникам чата.

Есть HTTP-фолбек для случаев, когда WebSocket недоступен (корпоративные прокси, некоторые сети).

---

**Q: Как на фронтенде обрабатываются presence-события (онлайн/оффлайн статус)?**

A: Бэкенд Hub отслеживает все активные WebSocket-соединения по `UserID`. При подключении нового клиента — бродкастит `{"type":"presence","user_id":"...","online":true}` всем в комнате. При отключении — `online:false`.

Фронтенд в обработчике `ws.onmessage` сначала проверяет `data.type`:
```typescript
if (data.type === 'presence') {
  if (data.user_id !== user.id) setOtherOnline(data.online);
  return; // не добавляем в список сообщений!
}
// Иначе — обычное сообщение
```

Важно: presence-события НЕ должны попасть в список сообщений, иначе появится "Invalid Date" (поле `created_at` отсутствует).

---

**Q: Почему при загрузке файлов не устанавливается Content-Type вручную?**

A: Потому что при использовании FormData браузер (и React Native) АВТОМАТИЧЕСКИ устанавливает правильный Content-Type с boundary:
```
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxk
```
Если установить вручную `Content-Type: multipart/form-data` без boundary, сервер не сможет определить где заканчивается одна часть формы и начинается другая. Это распространённая ошибка — принудительная установка Content-Type для FormData.

---

### БЛОК 4: МОБИЛЬНОЕ ПРИЛОЖЕНИЕ

**Q: Как работает навигация на мобиле, как переключаются стеки по ролям?**

A: React Navigation строит дерево навигаторов. Корневой RootStack содержит `MainTabs`. `MainTabs` — это компонент, который читает `user.role` из AuthContext и рендерит разный Bottom Tab Navigator:
```tsx
function MainTabs() {
  const { user } = useAuth();
  if (user?.role === 'employer')   return <EmployerTabs />;
  if (user?.role === 'university') return <UniversityTabs />;
  return <StudentTabs />;  // по умолчанию — студент
}
```
Каждый таб содержит свой Stack Navigator для возможности перехода вглубь (например: Vacancies → Applications → CandidateDetail → Chat).

---

**Q: Как работают push-уведомления когда приложение закрыто?**

A: Это нативный механизм, не зависящий от JavaScript. При регистрации приложение получает Expo Push Token — уникальный идентификатор устройства в системе Expo. Этот токен сохраняется на сервере. Когда происходит событие (смена статуса заявки), сервер отправляет HTTP-запрос на `https://exp.host/--/api/v2/push/send` с токеном. Expo-серверы доставляют уведомление через FCM (Android) или APNs (iOS) напрямую в ОС. ОС показывает его как системное уведомление — приложение при этом не должно быть запущено.

При тапе по уведомлению: приложение запускается, в `App.tsx` вызывается `getLastNotificationResponseAsync()`, который возвращает данные уведомления — используем для навигации на нужный экран.

---

**Q: Почему сделали два разных переключателя языка для мобиле и веба?**

A: Одна библиотека (`react-i18next`) на обоих платформах, но разная персистентность. На вебе язык сбрасывается при обновлении страницы — это приемлемо (язык можно выбрать в настройках браузера/ОС). На мобиле пользователь не перезапускает приложение так часто, но ожидает что его выбор сохранится. Поэтому на мобиле язык сохраняется в AsyncStorage при каждом переключении и восстанавливается при запуске приложения через `AsyncStorage.getItem('@app_language')`.

---

**Q: Почему для мобилки использовали Expo Managed Workflow, а не Bare React Native?**

A: Managed Workflow — это когда Expo управляет нативными слоями (Java/Kotlin/Swift). Преимущества:
- Не нужен Android Studio / Xcode для обычной разработки
- Сборка через EAS Build в облаке
- Готовые нативные модули (expo-notifications, expo-secure-store, expo-document-picker) — проверенные и совместимые
- Быстрый старт

Для нашего проекта (студенческий диплом) Managed Workflow оптимален. Bare workflow нужен когда требуется кастомный нативный код на Java/Swift, которого у нас нет.

---

### БЛОК 5: ПРОИЗВОДИТЕЛЬНОСТЬ

**Q: Как оптимизирована загрузка веб-приложения (bundle size)?**

A: Несколько механизмов Vite:
1. **Tree-shaking**: Удаляет неиспользуемый код при сборке
2. **Code splitting**: React Router автоматически разбивает бандл на чанки по маршрутам (lazy loading страниц)
3. **Tailwind CSS purging**: В production только используемые CSS-классы попадают в бандл
4. **Multi-stage Docker**: nginx раздаёт сжатые статические файлы с Cache-Control заголовками

---

**Q: Как работает debounce при поиске вакансий?**

A: При каждом нажатии клавиши в поле поиска НЕ отправляется запрос. Функция `debounce(fn, 400)` из `utils/index.ts` ждёт 400мс после последнего нажатия и только тогда вызывает API. Это снижает количество запросов с одного на символ до одного на завершённое слово. Реализация через `clearTimeout/setTimeout`.

---

**Q: Как предотвращаются дублирующиеся сообщения в чате?**

A: При получении сообщения через WebSocket проверяем его `id`:
```typescript
setMessages(prev =>
  prev.some(m => m.id === msg.id) ? prev : [...prev, msg]
);
```
Это защищает от ситуации когда:
- Пользователь отправил через WebSocket
- Сервер вернул сообщение через broadcast
- А HTTP-фолбек тоже вернул копию

---

### БЛОК 6: ИНТЕРНАЦИОНАЛИЗАЦИЯ

**Q: Как реализована поддержка трёх языков (RU/EN/KZ)?**

A: Библиотека `react-i18next`. Каждый язык — JSON-файл с вложенной структурой ключей. Примерно 1100 ключей на язык. Компоненты используют хук `useTranslation()` и функцию `t('ключ')`. При смене языка через `i18n.changeLanguage()` все компоненты, использующие `t()`, автоматически перерисовываются с новым переводом без перезагрузки страницы. Казахский язык (`kk-KZ` locale) использует кириллицу.

---

**Q: Как определяется язык при первом запуске мобильного приложения?**

A: При инициализации `initI18n()`:
1. Читаем из AsyncStorage ключ `@app_language`
2. Если есть сохранённый язык → используем его
3. Если нет (первый запуск) → язык по умолчанию `'ru'`

Можно было бы определять по системному языку устройства через `expo-localization`, но для учебного проекта выбран простой подход — явный выбор пользователем.

---

### БЛОК 7: ТЕСТИРОВАНИЕ И СБОРКА

**Q: Как собирается APK для Android?**

A: Через Expo Application Services (EAS Build):
```bash
eas build -p android --profile preview
```
Профиль `preview` в `eas.json` настроен на `buildType: "apk"` — тестовый APK без подписи Play Store. Сборка происходит на серверах Expo в облаке (не нужен Android Studio локально). `requireCommit: true` в конфигурации — все изменения должны быть закоммичены перед сборкой.

---

**Q: Как проверить что фронтенд не сломан после изменений?**

A: Несколько уровней проверки:
1. `tsc -b` — TypeScript-компиляция. Строгий режим: `noUnusedLocals`, `noUnusedParameters`, `strict: true`
2. `vite build` — финальная сборка. Если TypeScript прошёл, Vite собирает оптимизированный бандл
3. `docker compose build frontend` — финальная проверка Docker-сборки
4. Ручное тестирование в браузере через `npx expo start` (мобиле) или `npm run dev` (веб)

---

### БЛОК 8: ДОПОЛНИТЕЛЬНЫЕ ВОПРОСЫ

**Q: Какие уязвимости у текущей реализации и как их можно улучшить?**

A: 
1. **Web localStorage**: XSS может украсть токены. Улучшение: перейти на HttpOnly Secure cookies.
2. **JWT в URL для WebSocket**: `?token=...` попадает в логи nginx. Улучшение: передавать токен в первом WebSocket-сообщении после установки соединения.
3. **Нет rate limiting на фронтенде**: Нет ограничений на количество попыток входа на клиенте. Это должно решаться на бэкенде (Redis-счётчик попыток).
4. **Отсутствие CSP**: Нет Content Security Policy заголовков. Улучшение: добавить в nginx.conf.

---

**Q: Как реализован offline-режим на мобиле?**

A: Простое кэширование GET-запросов. При каждом успешном GET-запросе ответ сохраняется в AsyncStorage с ключом по URL. При повторном запросе и ошибке сети — возвращаем кэшированный ответ с заголовком `X-From-Cache: 1`. Это позволяет открыть список вакансий или уведомлений без интернета. Мутирующие запросы (POST/PUT/DELETE) не кэшируются и требуют сети.

---

**Q: Как разные роли видят разный интерфейс?**

A: Три уровня разделения:
1. **Навигация**: Разные Tab Navigator-ы для student/employer/university (`MainNavigator.tsx`)
2. **Маршруты (веб)**: `RoleBasedRoute` блокирует доступ к чужим страницам
3. **Компоненты**: Например, кнопка "Откликнуться" видна только студентам, кнопка "Изменить статус" — только работодателям. Проверка через `user?.role === 'student'`
4. **Бэкенд**: Независимо от фронтенда, api-gateway проверяет роль для каждого endpoint и блокирует несанкционированные действия

---

**Q: Что такое MatchIndex и как он рассчитывается?**

A: Это показатель совместимости студента с вакансией по навыкам. Алгоритм: берём список требуемых навыков вакансии, для каждого проверяем — есть ли аналог в навыках студента (case-insensitive substring). Количество совпадений делим на общее количество требований. Результат в процентах. Например: вакансия требует [Python, Django, SQL], студент знает [Python, Django, React] → 2/3 = 67% (хорошее совпадение, синий индикатор).

---

**Q: Как строится диаграмма трудоустройства для университета?**

A: На фронтенде (страница аналитики) запрашиваем `GET /api/employment/university`. Бэкенд возвращает агрегированные данные: процент трудоустроенных выпускников, топ-работодатели, статистика по специальностям, количество выполненных грантовых обязательств. На фронтенде эти данные визуализируются прогресс-барами, процентными показателями и таблицами. Внешние графические библиотеки не используются — всё реализовано на CSS (Tailwind) и React.

---

*Документ подготовлен для защиты дипломной работы "Информационная система трудоустройства студентов — CareerBond"*
