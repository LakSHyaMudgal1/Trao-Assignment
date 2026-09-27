import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { kitRepository } from '../src/repositories/kit.repository.js';
import { authService } from '../src/services/auth.service.js';
import bcrypt from 'bcryptjs';

describe('Authentication & Ownership Integration Suite', () => {
  const app = createApp();

  // In-memory mock stores for realistic end-to-end HTTP testing
  const usersStore = new Map<string, any>();
  const kitsStore = new Map<string, any>();

  beforeEach(() => {
    usersStore.clear();
    kitsStore.clear();

    // Mock userRepository methods
    vi.spyOn(userRepository, 'findByEmail').mockImplementation(async (email: string) => {
      const normalized = email.toLowerCase().trim();
      const user = Array.from(usersStore.values()).find((u) => u.email === normalized);
      return user ? { ...user, _id: { toString: () => user._id } } : null;
    });

    vi.spyOn(userRepository, 'findById').mockImplementation(async (id: string) => {
      const user = usersStore.get(id);
      return user ? { ...user, _id: { toString: () => user._id } } : null;
    });

    vi.spyOn(userRepository, 'create').mockImplementation(async (data: { email: string; passwordHash: string }) => {
      const _id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const userDoc = {
        _id,
        email: data.email.toLowerCase().trim(),
        passwordHash: data.passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      usersStore.set(_id, userDoc);
      return { ...userDoc, _id: { toString: () => _id } } as any;
    });

    // Mock kitRepository methods
    vi.spyOn(kitRepository, 'findById').mockImplementation(async (id: string) => {
      const kit = kitsStore.get(id);
      if (!kit) return null;
      return {
        ...kit,
        user_id: { toString: () => kit.user_id },
        toAppendixA: () => ({
          source: kit.source,
          company_brief: kit.company_brief,
          role: kit.role,
          questions: kit.questions,
          flashcards: kit.flashcards,
          schedule: kit.schedule,
          coverage: kit.coverage,
        }),
      } as any;
    });

    vi.spyOn(kitRepository, 'findByIdAndUserId').mockImplementation(async (id: string, userId: string) => {
      const kit = kitsStore.get(id);
      if (!kit || kit.user_id !== userId) return null;
      return {
        ...kit,
        user_id: { toString: () => kit.user_id },
      } as any;
    });

    vi.spyOn(kitRepository, 'findByUserId').mockImplementation(async (userId: string) => {
      return Array.from(kitsStore.values())
        .filter((k) => k.user_id === userId)
        .map((k) => ({ ...k, user_id: { toString: () => k.user_id } })) as any;
    });
  });

  describe('1. Registration Flow', () => {
    it('successfully registers a new user with hashed password and HTTP-only cookie', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'alice@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.user.email).toBe('alice@example.com');
      expect(res.body.data.user.id).toBeDefined();
      expect(res.body.data.token).toBeDefined();

      // Ensure password hash is NEVER exposed in response body
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.user.password).toBeUndefined();

      // Ensure HTTP-only cookie is set with appropriate security attributes
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/auth_token=/);
      expect(cookies[0]).toMatch(/HttpOnly/i);
      expect(cookies[0]).toMatch(/SameSite=Lax/i);
      expect(cookies[0]).toMatch(/Path=\//i);
    });

    it('rejects registration with duplicate email with 409 Conflict', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'bob@example.com', password: 'Password123!' });

      // Duplicate registration attempt
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'bob@example.com', password: 'DifferentPassword456!' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EMAIL_ALREADY_EXISTS');
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('rejects invalid email or short password via Zod validation', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: '123' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details).toBeDefined();
    });
  });

  describe('2. Login Flow', () => {
    beforeEach(async () => {
      // Pre-seed a test user
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash('Secret123!', salt);
      usersStore.set('user_charlie', {
        _id: 'user_charlie',
        email: 'charlie@example.com',
        passwordHash: hash,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('successfully logs in with valid credentials and sets HTTP-only cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'charlie@example.com',
          password: 'Secret123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.user.email).toBe('charlie@example.com');
      expect(res.body.data.token).toBeDefined();

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/auth_token=/);
      expect(cookies[0]).toMatch(/HttpOnly/i);
    });

    it('rejects login with incorrect password with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'charlie@example.com',
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.message).toMatch(/Invalid email or password/i);
    });

    it('rejects login with non-existent email with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('3. Protected Route & Session Handling', () => {
    let validToken: string;
    let validCookie: string;

    beforeEach(async () => {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash('Secret123!', salt);
      usersStore.set('user_dan', {
        _id: 'user_dan',
        email: 'dan@example.com',
        passwordHash: hash,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      validToken = authService.generateToken('user_dan');
      validCookie = `auth_token=${validToken}`;
    });

    it('rejects requests to protected route when no session or token is provided', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
      expect(res.body.message).toMatch(/Authentication required/i);
    });

    it('rejects requests with forged or invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer forged-invalid-token');

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_TOKEN');
    });

    it('allows access to protected route using HTTP-only cookie', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.user.email).toBe('dan@example.com');
      expect(res.body.data.user.id).toBe('user_dan');
    });

    it('allows access to protected route using Bearer Authorization header', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('dan@example.com');
    });

    it('supports /api/auth/session alias endpoint', async () => {
      const res = await request(app)
        .get('/api/auth/session')
        .set('Cookie', [validCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('dan@example.com');
    });
  });

  describe('4. Ownership Enforcement', () => {
    let tokenUserA: string;
    let cookieUserA: string;
    let tokenUserB: string;
    let cookieUserB: string;
    const kitAId = 'kit_belonging_to_user_a';

    beforeEach(async () => {
      // User A
      usersStore.set('user_a', {
        _id: 'user_a',
        email: 'user_a@example.com',
        passwordHash: 'dummy',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      tokenUserA = authService.generateToken('user_a');
      cookieUserA = `auth_token=${tokenUserA}`;

      // User B
      usersStore.set('user_b', {
        _id: 'user_b',
        email: 'user_b@example.com',
        passwordHash: 'dummy',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      tokenUserB = authService.generateToken('user_b');
      cookieUserB = `auth_token=${tokenUserB}`;

      // PrepKit owned strictly by User A
      kitsStore.set(kitAId, {
        _id: kitAId,
        user_id: 'user_a',
        title: "User A's Interview Kit",
        source: {
          company: 'Acme',
          company_url: 'https://acme.corp',
          role: 'Backend Dev',
          location: 'Remote',
          jd_chars: 100,
          researched_at: new Date().toISOString(),
          pages_used: [],
        },
        company_brief: { summary: 'Brief', what_they_do: 'Tech', sources: [] },
        role: { title: 'Backend', seniority: 'Senior', responsibilities: [], requirements: [] },
        questions: [],
        flashcards: [],
        schedule: { days_available: 5, days: [] },
        coverage: { uncovered_requirement_ids: [], passes: 1 },
      });
    });

    it('allows User A to access their own kit', async () => {
      const res = await request(app)
        .get(`/api/kits/${kitAId}`)
        .set('Cookie', [cookieUserA]);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.kit.title).toBe("User A's Interview Kit");
    });

    it('strictly forbids User B from querying User A’s kit with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/kits/${kitAId}`)
        .set('Cookie', [cookieUserB]);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_KIT_ACCESS');
      expect(res.body.message).toMatch(/only view or modify your own kits/i);
    });

    it('strictly forbids User B from modifying User A’s kit brief', async () => {
      const res = await request(app)
        .patch(`/api/kits/${kitAId}/brief`)
        .set('Cookie', [cookieUserB])
        .send({
          summary: 'Malicious modification',
          what_they_do: 'Hacked',
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_KIT_ACCESS');
    });

    it('strictly forbids User B from deleting User A’s kit', async () => {
      const res = await request(app)
        .delete(`/api/kits/${kitAId}`)
        .set('Cookie', [cookieUserB]);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_KIT_ACCESS');
    });
  });

  describe('5. Logout & Session Invalidation', () => {
    it('clears HTTP-only auth cookie and invalidates session upon logout', async () => {
      // 1. Log in or register to get active session
      const loginRes = await request(app)
        .post('/api/auth/register')
        .send({ email: 'eva@example.com', password: 'Password123!' });

      expect(loginRes.status).toBe(201);
      const authCookie = loginRes.headers['set-cookie'][0];

      // 2. Call logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [authCookie]);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.status).toBe('success');

      // Verify that logout clears the cookie with Max-Age=0 / expired date
      const clearedCookies = logoutRes.headers['set-cookie'];
      expect(clearedCookies).toBeDefined();
      expect(clearedCookies[0]).toMatch(/auth_token=;/);
      expect(clearedCookies[0]).toMatch(/Max-Age=0|expires=/i);

      // 3. Subsequent request with the cleared cookie fails
      const clearedCookieHeader = clearedCookies[0].split(';')[0]; // "auth_token="
      const checkRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [clearedCookieHeader]);

      expect(checkRes.status).toBe(401);
      expect(checkRes.body.code).toBe('UNAUTHORIZED');
    });
  });
});
