# LMS — Каталог курсів (стартер для студентів)

Це стартовий каркас для курсової роботи **«Модуль каталогу курсів системи керування навчальним процесом університету»**.

**Що ви отримуєте:**
- **Повноцінний бекенд** (Node + Fastify + Prisma + SQLite) з детальною Swagger-документацією.
- **React-клієнт із готовою авторизацією** (Login, Register, AuthContext, RequireAuth, RequireRole, axios-клієнт з JWT-інтерсептором, React Query).
- **Заглушки внутрішніх екранів** у `client/src/routes/` — це те, що ви маєте реалізувати.

## Вимоги

- Node.js **≥ 18.18** (рекомендовано LTS 20)
- npm 9+

## Швидкий старт

```bash
# 1. Встановити залежності
npm install

# 2. Створити SQLite-базу
cd server && npx prisma migrate dev --name init && cd ..

# 3. Заповнити демо-даними (студенти, курси, оцінки, …)
npm run seed

# 4. Запустити сервер (:4000) та клієнт (:5173) одночасно
npm run dev
```

Після старту:

| URL                           | Що там                                      |
| ----------------------------- | ------------------------------------------- |
| <http://localhost:5173>       | Ваш React-клієнт (зайдіть і побачите список маршрутів-заглушок) |
| <http://localhost:4000/docs>  | **Swagger UI з усіма endpoint-ами** — головний орієнтир |

Скинути БД до початкового стану (наприклад, після експериментів):
```bash
npm run reset
```

## Демо-облікові записи

| Роль     | Email                     | Пароль        |
| -------- | ------------------------- | ------------- |
| Викладач | `instructor@example.com`  | `password123` |
| Студент  | `student@example.com`     | `password123` |

## Що вже зроблено та НЕ змінюйте

Цей шар уже працює — фокусуйтеся на наповненні внутрішніх сторінок:

- **`server/`** — повністю реалізований бекенд. Усі endpoints задокументовані в Swagger. **Не модифікуйте код сервера.** Якщо знайшли баг — повідомте викладача.
- **`client/src/main.jsx`** — React-точка входу з усіма провайдерами (Theme, BrowserRouter, QueryClient, AuthProvider).
- **`client/src/api/client.js`** — налаштований axios-екземпляр з JWT та обробником 401.
- **`client/src/api/queryClient.js`** — TanStack Query клієнт.
- **`client/src/api/auth.js`** — endpoints логіну та реєстрації.
- **`client/src/auth/*`** — `AuthContext`, `useAuth`, `RequireAuth`, `RequireRole`.
- **`client/src/routes/auth/Login.jsx`** та **`Register.jsx`** — повністю реалізовані екрани авторизації.

## Що ви реалізуєте

Усе в `client/src/routes/` (крім `auth/`) — це **заглушки**, що показують лише ім'я файлу:

```
src/routes/
  catalog/CourseCatalog.jsx, CourseDetail.jsx
  builder/CourseBuilder.jsx
  enrollments/CourseStudents.jsx
  lesson/LessonView.jsx, LessonEdit.jsx
  assignment/AssignmentView.jsx, AssignmentSubmit.jsx
  grading/SubmissionsList.jsx, GradeSubmission.jsx
  gradebook/CourseGradebook.jsx, MyGrades.jsx
  dashboard/StudentDashboard.jsx, InstructorDashboard.jsx
  communications/Announcements.jsx, CommentsThread.jsx
  calendar/CalendarView.jsx
  library/MaterialsLibrary.jsx
  profile/Profile.jsx, Notifications.jsx
  users/UsersList.jsx
```

Папки `api/`, `layout/`, `components/`, `ws/`, `utils/` — порожні (тільки `.gitkeep`). Вам належить наповнити їх:
- `api/` — функції-обгортки над endpoint-ами, що ви використовуватимете (через `apiClient` з `api/client.js`)
- `layout/` — `AppShell` із навігаційною шторкою та bell-нотифікаціями
- `components/` — повторно використовувані UI-компоненти (Pagination, MarkdownView, LoadingState, …)
- `ws/` — гачок-обгортка над WebSocket для real-time нотифікацій
- `utils/` — формат дат, утиліти експорту, тощо

## API-конвенції (як читати Swagger)

- **Базовий шлях:** `/api/v1`
- **Auth header:** `Authorization: Bearer <JWT>` (axios-клієнт додає автоматично)
- **Пагінація:** `?page=N&pageSize=M` → `{ data: [...], meta: { total, page, pageSize, totalPages } }`
- **Помилки:** `{ error: { code, message, details? } }`
- **Сортування:** `?sort=field&order=asc|desc`
- **Файли:** multipart-upload; URL віддається як `/uploads/<file>`

## Скрипти

| Команда                | Опис                                              |
| ---------------------- | ------------------------------------------------- |
| `npm install`          | Встановити залежності в обох воркспейсах          |
| `npm run dev`          | Запустити сервер та клієнт паралельно             |
| `npm run dev:server`   | Тільки сервер (`:4000`)                           |
| `npm run dev:client`   | Тільки клієнт (`:5173`)                           |
| `npm run seed`         | Заповнити БД демо-даними                          |
| `npm run reset`        | Скинути БД (drop + migrate + clear uploads + seed)|
| `npm run build`        | Production-білд клієнта                           |

## Підказки

- Тримайте Swagger UI відкритим у сусідній вкладці — там видно всі параметри запитів та форму відповіді.
- Демо-юзери мають заповнені дані: `instructor@example.com` володіє 4 курсами з оголошеннями та неоціненими роботами; `student@example.com` записаний на 6 курсів, має 10 зданих робіт, 7 оцінок, 32 пройдених уроки.
- Для роботи зі станом серверу рекомендую TanStack Query (`useQuery` / `useMutation`) — клієнт уже налаштований.
- Не забувайте про `RequireRole` для викладацьких маршрутів (`<RequireRole role="Instructor">...`).

Успіхів!
