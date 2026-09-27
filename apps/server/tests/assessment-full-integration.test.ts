import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { kitRepository } from '../src/repositories/kit.repository.js';
import { authService } from '../src/services/auth.service.js';
import { ResearchOrchestrator } from '../src/pipeline/research-orchestrator.js';
import { PageFetcher } from '../src/core/retrieval/page-fetcher.js';
import { CompanyCrawler } from '../src/core/retrieval/company-crawler.js';
import { KitAppendixASchema } from '@prep-kit/shared';
import dns from 'node:dns/promises';

describe('Assessment Full Integration & Lifecycle Suite', () => {
  const app = createApp();

  const usersStore = new Map<string, any>();
  const kitsStore = new Map<string, any>();

  beforeEach(() => {
    usersStore.clear();
    kitsStore.clear();
    vi.restoreAllMocks();

    vi.spyOn(dns, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as any);

    // Mock userRepository
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
      const _id = '507f1f77bcf86cd799439011';
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

    const normalizeKit = (id: string, kit: any) => {
      const kitIdStr = typeof kit._id === 'object' && kit._id?.toString ? kit._id.toString() : String(kit._id || id);
      const rawUserId = kit.user_id;
      const userIdStr = typeof rawUserId === 'object' && rawUserId?.toString ? rawUserId.toString() : String(rawUserId);
      return {
        ...kit,
        _id: { toString: () => kitIdStr },
        user_id: { toString: () => userIdStr },
        save: async function () {
          kitsStore.set(kitIdStr, {
            ...this,
            _id: kitIdStr,
            user_id: userIdStr,
          });
          return this;
        },
        toAppendixA: () => ({
          source: kit.source,
          company_brief: kit.company_brief,
          role: kit.role,
          questions: kit.questions,
          flashcards: kit.flashcards,
          schedule: kit.schedule,
          coverage: kit.coverage,
        }),
      };
    };

    // Mock kitRepository
    vi.spyOn(kitRepository, 'findById').mockImplementation(async (id: string) => {
      const kit = kitsStore.get(id);
      if (!kit) return null;
      return normalizeKit(id, kit) as any;
    });

    vi.spyOn(kitRepository, 'findByIdAndUserId').mockImplementation(async (id: string, userId: string) => {
      const kit = kitsStore.get(id);
      if (!kit) return null;
      const doc = normalizeKit(id, kit);
      if (doc.user_id.toString() !== userId) return null;
      return doc as any;
    });

    vi.spyOn(kitRepository, 'create').mockImplementation(async (kitData: any) => {
      const _id = kitData._id ? kitData._id.toString() : '507f1f77bcf86cd799439099';
      const doc = normalizeKit(_id, { ...kitData, _id });
      kitsStore.set(_id, doc);
      return doc as any;
    });
  });

  it('executes the complete interview prep kit user lifecycle end-to-end', async () => {
    // 1. User Registration
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'candidate@company.com', password: 'Password123!' });

    expect(regRes.status).toBe(201);
    const token = regRes.body.data.token;
    expect(token).toBeDefined();

    // 2. Pre-seed a verified kit for user
    const kitId = '507f1f77bcf86cd799439099';
    kitsStore.set(kitId, {
      _id: kitId,
      user_id: '507f1f77bcf86cd799439011',
      title: 'Stripe - Staff Infrastructure Engineer',
      source: {
        company: 'Stripe',
        company_url: 'https://stripe.com',
        role: 'Staff Infrastructure Engineer',
        location: 'Remote',
        jd_chars: 500,
        researched_at: new Date().toISOString(),
        pages_used: ['https://stripe.com'],
      },
      company_brief: {
        summary: 'Stripe powers online commerce and economic infrastructure.',
        what_they_do: 'Global financial infrastructure and payment APIs.',
        sources: ['https://stripe.com'],
        is_edited: false,
        is_pinned: false,
      },
      role: {
        title: 'Staff Infrastructure Engineer',
        seniority: 'Staff',
        responsibilities: ['Architect high availability payment systems'],
        requirements: [
          { id: 'req-1', text: 'Distributed consensus (Raft/Paxos)', kind: 'technical', priority: 'must', origin: 'generated', is_edited: false, is_pinned: false, is_deleted: false },
          { id: 'req-2', text: 'High throughput idempotency', kind: 'technical', priority: 'must', origin: 'generated', is_edited: false, is_pinned: false, is_deleted: false },
        ],
      },
      questions: [
        {
          id: 'q-orig-1',
          requirement_ids: ['req-1'],
          category: 'technical',
          prompt: 'Original technical question',
          answer_outline: 'Original outline',
          difficulty: 3,
          origin: 'generated',
          is_edited: false,
          is_pinned: false,
          order_index: 0,
        },
      ],
      flashcards: [
        {
          id: 'f-1',
          front: 'What is idempotency?',
          back: 'An operation produces identical state when applied multiple times.',
          requirement_ids: ['req-2'],
          confidence_score: undefined,
          review_count: 0,
          origin: 'generated',
          is_edited: false,
          is_pinned: false,
          is_deleted: false,
          is_covered: false,
        },
      ],
      schedule: {
        days_available: 5,
        days: [
          { day: 1, focus: 'Core Systems', question_ids: ['q-orig-1'], minutes: 60 },
          { day: 2, focus: 'Idempotency', question_ids: [], minutes: 60 },
          { day: 3, focus: 'Review', question_ids: [], minutes: 45 },
          { day: 4, focus: 'Review', question_ids: [], minutes: 45 },
          { day: 5, focus: 'Final Mock', question_ids: [], minutes: 30 },
        ],
      },
      coverage: { uncovered_requirement_ids: ['req-2'], passes: 1 },
      tombstones: { deleted_ids: [], deleted_question_prompts: [] },
    });

    // 3. Get Kit (Verified Ownership)
    const getRes = await request(app)
      .get(`/api/kits/${kitId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.kit.title).toContain('Stripe');

    // 4. Inline Question Edit
    const editRes = await request(app)
      .patch(`/api/kits/${kitId}/questions/q-orig-1`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        prompt: 'User customized prompt for distributed consensus',
        is_pinned: true,
      });

    expect(editRes.status).toBe(200);
    const updatedKit = editRes.body.data.kit;
    const editedQ = updatedKit.questions.find((q: any) => q.id === 'q-orig-1');
    expect(editedQ.prompt).toBe('User customized prompt for distributed consensus');
    expect(editedQ.is_edited).toBe(true);
    expect(editedQ.is_pinned).toBe(true);

    // 5. Add User Created Question
    const addQRes = await request(app)
      .post(`/api/kits/${kitId}/questions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        requirement_ids: ['req-2'],
        category: 'technical',
        prompt: 'How to build distributed idempotency locks with Redis and Raft?',
        answer_outline: 'Explain lease times, fences, and monotonic counters.',
        difficulty: 3,
      });

    expect([200, 201]).toContain(addQRes.status);
    const kitAfterAdd = addQRes.body.data.kit;
    expect(kitAfterAdd.questions.length).toBe(2);
    const userQ = kitAfterAdd.questions.find((q: any) => q.origin === 'user_created');
    expect(userQ).toBeDefined();

    // 6. Section Regeneration with Edit & User-Created Question Preservation
    const regenRes = await request(app)
      .post(`/api/kits/${kitId}/regenerate`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        target: 'category',
        category: 'technical',
      });

    expect(regenRes.status).toBe(200);
    const kitAfterRegen = regenRes.body.data.kit;

    // Both the edited question AND the user-created question MUST have survived
    const survivedEdited = kitAfterRegen.questions.find((q: any) => q.id === 'q-orig-1');
    expect(survivedEdited).toBeDefined();
    expect(survivedEdited.prompt).toBe('User customized prompt for distributed consensus');

    const survivedUserCreated = kitAfterRegen.questions.find((q: any) => q.origin === 'user_created');
    expect(survivedUserCreated).toBeDefined();

    // 7. Practice Mode: Review Flashcard & Progress Tracking
    const reviewRes = await request(app)
      .post(`/api/kits/${kitId}/flashcards/f-1/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        confidence: 4,
        is_covered: true,
      });

    expect(reviewRes.status).toBe(200);
    const cardAfterReview = reviewRes.body.data.kit.flashcards.find((f: any) => f.id === 'f-1');
    expect(cardAfterReview.confidence_score).toBe(4);
    expect(cardAfterReview.is_covered).toBe(true);
    expect(cardAfterReview.review_count).toBe(1);

    // 8. Cross-User Authorization Rejection
    // User B attempts to access User A's kit
    const userBId = '507f1f77bcf86cd799439022';
    usersStore.set(userBId, {
      _id: userBId,
      email: 'attacker@evil.com',
      passwordHash: 'dummy_hash',
    });
    const userBToken = authService.generateToken(userBId);

    const unauthorizedRes = await request(app)
      .get(`/api/kits/${kitId}`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(unauthorizedRes.status).toBe(403);
    expect(unauthorizedRes.body.code).toBe('FORBIDDEN_KIT_ACCESS');

    // 9. Non-existent Kit returns 404 Not Found
    const notFoundRes = await request(app)
      .get('/api/kits/non_existent_kit_999')
      .set('Authorization', `Bearer ${token}`);

    expect(notFoundRes.status).toBe(404);
    expect(notFoundRes.body.code).toBe('KIT_NOT_FOUND');
  }, 25000);
});
