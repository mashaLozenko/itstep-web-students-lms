import { z } from 'zod';

export const RegisterBody = z.object({
  email: z.string().email().describe('Електронна пошта користувача'),
  password: z.string().min(8).describe('Пароль (мінімум 8 символів)'),
  fullName: z.string().min(2).describe('Повне ім\'я'),
  role: z.enum(['Student', 'Instructor']).describe('Роль облікового запису'),
});

export const LoginBody = z.object({
  email: z.string().email().describe('Зареєстрована електронна пошта'),
  password: z.string().describe('Пароль облікового запису'),
});

export const UserPublic = z.object({
  id: z.string(),
  email: z.string(),
  fullName: z.string(),
  role: z.enum(['Student', 'Instructor']),
  avatarUrl: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const AuthResponse = z.object({
  user: UserPublic,
  token: z.string().describe('JWT Bearer токен — передавати в заголовку Authorization'),
});
