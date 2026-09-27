import { z } from 'zod';

export const RegisterRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

export const LoginRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const UserResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  createdAt: z.string(),
});

export const AuthResponseSchema = z.object({
  user: UserResponseSchema,
  token: z.string(),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
