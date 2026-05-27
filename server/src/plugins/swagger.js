import fp from 'fastify-plugin';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

/**
 * Swagger plugin — mounts @fastify/swagger and @fastify/swagger-ui.
 * Uses fastify-type-provider-zod to transform Zod schemas → JSON Schema / OpenAPI.
 * Swagger UI is available at /docs; JSON spec at /docs/json.
 */
async function swaggerPlugin(fastify) {
  await fastify.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'API Каталогу Курсів LMS',
        version: '1.0.0',
        description: `
## Каталог Курсів LMS — Reference API

Цей API забезпечує роботу університетської системи управління навчанням (LMS). Студенти використовують його для перегляду курсів, здачі завдань та відстеження прогресу. Викладачі — для створення навчального контенту, оцінювання робіт та спілкування зі студентами.

### Автентифікація
Більшість ендпоінтів вимагають Bearer JWT токен. Отримайте його через **POST /api/v1/auth/login**.
Передавайте як: \`Authorization: Bearer <token>\`

### Пагінація
Усі ендпоінти зі списками приймають \`?page=N&pageSize=M\` (за замовчуванням: page=1, pageSize=20, макс. pageSize=100).
Відповіді містять об'єкт \`meta\`: \`{ total, page, pageSize, totalPages }\`.

### Формат помилок
Усі помилки повертаються у вигляді:
\`\`\`json
{
  "error": {
    "code": "NOT_FOUND | VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | CONFLICT | INTERNAL",
    "message": "Опис помилки",
    "details": []  // опціонально — помилки валідації полів Zod
  }
}
\`\`\`

### Демо-облікові записи
- **Викладач:** instructor@example.com / password123
- **Студент:** student@example.com / password123
        `.trim(),
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT токен, отриманий через POST /api/v1/auth/login',
          },
        },
      },
      tags: [
        { name: 'Auth', description: 'Реєстрація, вхід та отримання поточного профілю' },
        { name: 'Users', description: 'Профілі користувачів та управління обліковими записами' },
        { name: 'Courses', description: 'Каталог курсів — перегляд, створення та управління курсами' },
        { name: 'Enrollments', description: 'Запис на курс — запис, підтвердження та управління записами' },
        { name: 'Sections', description: 'Розділи курсу — організація уроків та завдань' },
        { name: 'Lessons', description: 'Уроки — вміст у форматі Markdown / rich-text у розділах курсу' },
        { name: 'Assignments', description: 'Завдання — оцінювані задачі у розділах курсу' },
        { name: 'Submissions', description: 'Здані роботи студентів — текст та завантаження файлів для завдань' },
        { name: 'Grades', description: 'Оцінювання — бал та відгук на здану роботу студента' },
        { name: 'Comments', description: 'Гілки обговорення до уроків та оцінок' },
        { name: 'Announcements', description: 'Оголошення в межах курсу від викладачів' },
        { name: 'Materials', description: 'Бібліотека навчальних матеріалів — відео, посилання та файли' },
        { name: 'Notifications', description: 'Сповіщення в застосунку про оцінки, коментарі та оголошення' },
        { name: 'Dashboard', description: 'Зведені огляди для кожної ролі' },
        { name: 'Calendar', description: 'Календар — найближчі дедлайни та дати публікації уроків' },
        { name: 'Gradebook', description: 'Журнал оцінок — матриця балів та експорт CSV для курсу' },
      ],
    },
    transform: jsonSchemaTransform,
  });

  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      persistAuthorization: true,
    },
    staticCSP: false,
  });
}

export default fp(swaggerPlugin, { name: 'swagger' });
