import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { userRepository, UserRepository } from '../repositories/user.repository.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import type { RegisterRequest, LoginRequest, AuthResponse } from '@prep-kit/shared';

export class AuthService {
  constructor(private userRepo: UserRepository = userRepository) {}

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) {
      throw AppError.conflict('An account with this email already exists', 'EMAIL_ALREADY_EXISTS');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const newUser = await this.userRepo.create({
      email: data.email,
      passwordHash,
    });

    const token = this.generateToken(newUser._id.toString());

    return {
      user: {
        id: newUser._id.toString(),
        email: newUser.email,
        createdAt: newUser.createdAt.toISOString(),
      },
      token,
    };
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    const user = await this.userRepo.findByEmail(data.email);
    if (!user) {
      throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const token = this.generateToken(user._id.toString());

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        createdAt: user.createdAt.toISOString(),
      },
      token,
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found', 'USER_NOT_FOUND');
    }

    return {
      id: user._id.toString(),
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    };
  }

  generateToken(userId: string): string {
    return jwt.sign({ sub: userId }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
    });
  }

  verifyToken(token: string): { sub: string } {
    try {
      return jwt.verify(token, env.JWT_SECRET) as { sub: string };
    } catch {
      throw AppError.unauthorized('Invalid or expired authentication session', 'INVALID_TOKEN');
    }
  }
}

export const authService = new AuthService();
