import { describe, it, expect, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { PrepKit } from '../src/models/kit.model.js';
import { authService } from '../src/services/auth.service.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { kitRepository } from '../src/repositories/kit.repository.js';
import { kitService } from '../src/services/kit.service.js';
import {
  sortCardsForPractice,
  isCardCovered,
  type FlashcardPracticeItem,
} from '@prep-kit/shared';

describe('Practice Mode Subsystem Suite', () => {
  let app: any;
  let testUserId: mongoose.Types.ObjectId;
  let otherUserId: mongoose.Types.ObjectId;
  let testUserToken: string;
  let otherUserToken: string;

  beforeEach(async () => {
    app = createApp();

    testUserId = new mongoose.Types.ObjectId();
    otherUserId = new mongoose.Types.ObjectId();

    testUserToken = authService.generateToken(testUserId.toString());
    otherUserToken = authService.generateToken(otherUserId.toString());

    vi.spyOn(userRepository, 'findById').mockImplementation(async (id: string) => {
      return {
        _id: id,
        email: id === testUserId.toString() ? 'student@example.com' : 'other@example.com',
      } as any;
    });

    vi.spyOn(kitRepository, 'findById').mockImplementation(async (id: string) => {
      const doc = createSampleKitDoc();
      return doc as any;
    });

    vi.spyOn(kitRepository, 'findByIdAndUserId').mockImplementation(async (id: string, userId: string) => {
      const doc = createSampleKitDoc();
      doc.save = vi.fn().mockResolvedValue(doc);
      return doc as any;
    });
  });

  const createSampleKitDoc = () => {
    return new PrepKit({
      user_id: testUserId,
      title: 'Stripe Staff Distributed Systems Engineer Kit',
      source: {
        company: 'Stripe',
        company_url: 'https://stripe.com',
        role: 'Staff Distributed Systems Engineer',
        location: 'Remote',
        jd_chars: 1800,
        researched_at: new Date().toISOString(),
        pages_used: ['https://stripe.com/about'],
      },
      company_brief: {
        summary: 'Payments infrastructure provider.',
        what_they_do: 'Global financial platforms.',
        sources: ['https://stripe.com'],
      },
      role: {
        title: 'Staff Distributed Systems Engineer',
        seniority: 'Staff',
        responsibilities: ['Build ledger engine'],
        requirements: [{ id: 'r1', text: 'Consensus protocols', kind: 'technical', priority: 'must' }],
      },
      questions: [
        {
          id: 'q1',
          requirement_ids: ['r1'],
          category: 'technical',
          prompt: 'Explain Raft leader election.',
          answer_outline: 'Randomized timers prevent split votes.',
          difficulty: 3,
          origin: 'generated',
        },
      ],
      flashcards: [
        {
          id: 'f_never_1',
          front: 'What is Raft log compaction?',
          back: 'Snapshotting state machine state and discarding old WAL entries.',
          requirement_ids: ['r1'],
          confidence_score: undefined,
          review_count: 0,
          is_covered: false,
        },
        {
          id: 'f_weak_1',
          front: 'What is 2PC blocking vulnerability?',
          back: 'If coordinator crashes during prepare/commit, participants remain blocked holding locks.',
          requirement_ids: ['r1'],
          confidence_score: 1, // Very weak
          review_count: 2,
          last_reviewed_at: new Date('2026-09-20T10:00:00Z'),
          is_covered: true,
        },
        {
          id: 'f_strong_1',
          front: 'Explain Paxos ballot numbers.',
          back: 'Monotonically increasing integers ensuring unique proposal sequence across nodes.',
          requirement_ids: ['r1'],
          confidence_score: 5, // Very strong
          review_count: 5,
          last_reviewed_at: new Date('2026-09-18T10:00:00Z'),
          is_covered: true,
        },
      ],
      schedule: {
        days_available: 3,
        days: [
          { day: 1, focus: 'Consensus', question_ids: ['q1'], minutes: 60 },
          { day: 2, focus: 'Replication', question_ids: ['q1'], minutes: 60 },
          { day: 3, focus: 'Review', question_ids: ['q1'], minutes: 60 },
        ],
      },
      coverage: { uncovered_requirement_ids: [], passes: 1 },
      tombstones: { deleted_ids: [], deleted_question_prompts: [] },
    });
  };

  describe('1. Deterministic Confidence-Weighted Ordering Engine', () => {
    it('prioritizes never-practiced cards before all reviewed cards', () => {
      const cards: FlashcardPracticeItem[] = [
        {
          id: 'card_reviewed_high',
          front: 'Front A',
          back: 'Back A',
          confidence_score: 5,
          review_count: 3,
          last_reviewed_at: '2026-09-20T12:00:00Z',
          is_covered: true,
        },
        {
          id: 'card_never_practiced',
          front: 'Front B',
          back: 'Back B',
          confidence_score: undefined,
          review_count: 0,
          is_covered: false,
        },
        {
          id: 'card_reviewed_low',
          front: 'Front C',
          back: 'Back C',
          confidence_score: 2,
          review_count: 1,
          last_reviewed_at: '2026-09-21T12:00:00Z',
          is_covered: true,
        },
      ];

      const sorted = sortCardsForPractice(cards);
      expect(sorted[0]!.id).toBe('card_never_practiced');
    });

    it('prioritizes cards with lower confidence over higher confidence (Rule: 1 < 2 < 3 < 4 < 5)', () => {
      const cards: FlashcardPracticeItem[] = [
        {
          id: 'card_conf_5',
          front: 'Front 5',
          back: 'Back 5',
          confidence_score: 5,
          review_count: 1,
          last_reviewed_at: '2026-09-20T12:00:00Z',
          is_covered: true,
        },
        {
          id: 'card_conf_1',
          front: 'Front 1',
          back: 'Back 1',
          confidence_score: 1,
          review_count: 1,
          last_reviewed_at: '2026-09-20T12:00:00Z',
          is_covered: true,
        },
        {
          id: 'card_conf_3',
          front: 'Front 3',
          back: 'Back 3',
          confidence_score: 3,
          review_count: 1,
          last_reviewed_at: '2026-09-20T12:00:00Z',
          is_covered: true,
        },
        {
          id: 'card_conf_2',
          front: 'Front 2',
          back: 'Back 2',
          confidence_score: 2,
          review_count: 1,
          last_reviewed_at: '2026-09-20T12:00:00Z',
          is_covered: true,
        },
      ];

      const sorted = sortCardsForPractice(cards);
      expect(sorted.map((c) => c.id)).toEqual([
        'card_conf_1',
        'card_conf_2',
        'card_conf_3',
        'card_conf_5',
      ]);
    });

    it('prioritizes older reviews when confidence scores are equal', () => {
      const cards: FlashcardPracticeItem[] = [
        {
          id: 'card_recent',
          front: 'Recent',
          back: 'Recent',
          confidence_score: 2,
          review_count: 2,
          last_reviewed_at: '2026-09-25T10:00:00Z', // Recent
          is_covered: true,
        },
        {
          id: 'card_oldest',
          front: 'Oldest',
          back: 'Oldest',
          confidence_score: 2,
          review_count: 2,
          last_reviewed_at: '2026-09-10T10:00:00Z', // Oldest
          is_covered: true,
        },
        {
          id: 'card_middle',
          front: 'Middle',
          back: 'Middle',
          confidence_score: 2,
          review_count: 2,
          last_reviewed_at: '2026-09-18T10:00:00Z', // Middle
          is_covered: true,
        },
      ];

      const sorted = sortCardsForPractice(cards);
      expect(sorted.map((c) => c.id)).toEqual(['card_oldest', 'card_middle', 'card_recent']);
    });

    it('tiebreaks deterministically by card ID when all other attributes match', () => {
      const cards: FlashcardPracticeItem[] = [
        { id: 'f_gamma', front: 'G', back: 'G', confidence_score: 3, is_covered: true },
        { id: 'f_alpha', front: 'A', back: 'A', confidence_score: 3, is_covered: true },
        { id: 'f_beta', front: 'B', back: 'B', confidence_score: 3, is_covered: true },
      ];

      const sorted = sortCardsForPractice(cards);
      expect(sorted.map((c) => c.id)).toEqual(['f_alpha', 'f_beta', 'f_gamma']);
    });

    it('accurately identifies whether a card is covered using isCardCovered', () => {
      expect(isCardCovered({ id: '1', front: '', back: '' })).toBe(false);
      expect(isCardCovered({ id: '2', front: '', back: '', review_count: 0 })).toBe(false);
      expect(isCardCovered({ id: '3', front: '', back: '', is_covered: true })).toBe(true);
      expect(isCardCovered({ id: '4', front: '', back: '', review_count: 1 })).toBe(true);
      expect(isCardCovered({ id: '5', front: '', back: '', confidence_score: 4 })).toBe(true);
    });
  });

  describe('2. Practice State Persistence via Service & Repository', () => {
    it('persists confidence rating, timestamp, review count, and is_covered flag', async () => {
      const kit = createSampleKitDoc();
      const card = kit.flashcards[0]!;
      expect(card.is_covered).toBe(false);
      expect(card.review_count).toBe(0);

      const updated = await kitService.recordFlashcardReview(
        kit._id.toString(),
        card.id,
        testUserId.toString(),
        { confidence: 4 }
      );

      const targetCard = updated.flashcards.find((f) => f.id === card.id);
      expect(targetCard).toBeDefined();
      expect(targetCard?.confidence_score).toBe(4);
      expect(targetCard?.is_covered).toBe(true);
      expect(targetCard?.review_count).toBe(1);
      expect(targetCard?.last_reviewed_at).toBeDefined();
    });

    it('throws not found error when reviewing non-existent flashcard ID', async () => {
      const kit = createSampleKitDoc();
      await expect(
        kitService.recordFlashcardReview(
          kit._id.toString(),
          'non_existent_card_id',
          testUserId.toString(),
          { confidence: 3 }
        )
      ).rejects.toThrow('not found');
    });
  });

  describe('3. HTTP API Practice Endpoints & Ownership Protection', () => {
    it('successfully records flashcard review through POST /api/kits/:id/flashcards/:cardId/review', async () => {
      const res = await request(app)
        .post('/api/kits/507f1f77bcf86cd799439011/flashcards/f_weak_1/review')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ confidence: 4 });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.kit).toBeDefined();
    });

    it('rejects invalid confidence score outside 1-5 range with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/kits/507f1f77bcf86cd799439011/flashcards/f_weak_1/review')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ confidence: 6 }); // invalid score

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });

    it('strictly forbids User B from recording flashcard reviews on User A’s kit with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/kits/507f1f77bcf86cd799439011/flashcards/f_weak_1/review')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ confidence: 5 });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_KIT_ACCESS');
    });
  });
});
