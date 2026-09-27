import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { PrepKit } from '../src/models/kit.model.js';
import { User } from '../src/models/user.model.js';
import { SectionRegenerator, sectionRegenerator } from '../src/core/regeneration/section-regenerator.js';
import { authService } from '../src/services/auth.service.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { kitRepository } from '../src/repositories/kit.repository.js';
import type { QuestionItem, RequirementItem } from '@prep-kit/shared';

describe('Section-Level Regeneration & Edit Preservation Suite', () => {
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
        email: id === testUserId.toString() ? 'test@example.com' : 'other@example.com',
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
      title: 'Stripe - Staff Distributed Systems Engineer',
      source: {
        company: 'Stripe',
        company_url: 'https://stripe.com',
        role: 'Staff Distributed Systems Engineer',
        location: 'San Francisco, CA / Remote',
        jd_chars: 2450,
        researched_at: new Date().toISOString(),
        pages_used: ['https://stripe.com/about', 'https://stripe.com/jobs'],
      },
      company_brief: {
        summary: 'Original brief summary about global payments infrastructure.',
        what_they_do: 'Stripe builds financial infrastructure for the internet.',
        sources: ['https://stripe.com/about'],
        is_edited: true,
        is_pinned: false,
      },
      role: {
        title: 'Staff Distributed Systems Engineer',
        seniority: 'Staff (IC6)',
        responsibilities: [
          'Design multi-region active-active ledger systems',
          'Optimize low-latency database consensus protocols',
        ],
        requirements: [
          {
            id: 'r1',
            text: 'Deep mastery of distributed consensus protocols (Raft, Paxos)',
            kind: 'technical',
            priority: 'must',
          },
          {
            id: 'r2',
            text: 'Production experience with PostgreSQL partitioning and replication',
            kind: 'technical',
            priority: 'must',
          },
          {
            id: 'r3',
            text: 'Demonstrated technical leadership and incident management',
            kind: 'behavioural',
            priority: 'must',
          },
          {
            id: 'r4',
            text: 'Experience with Terraform and cloud orchestration',
            kind: 'technical',
            priority: 'nice',
          },
        ],
      },
      questions: [
        // 1. Technical: Generated, pristine (replaceable)
        {
          id: 'q_tech_pristine',
          requirement_ids: ['r1'],
          category: 'technical',
          prompt: 'How does Raft leader election handle split votes?',
          answer_outline: 'Randomized election timeouts break split vote ties.',
          difficulty: 3,
          origin: 'generated',
          is_edited: false,
          is_pinned: false,
          order_index: 0,
        },
        // 2. Technical: User-edited question (MUST SURVIVE)
        {
          id: 'q_tech_edited',
          requirement_ids: ['r2'],
          category: 'technical',
          prompt: 'MY CUSTOM EDITED PROMPT: Explain PostgreSQL MVCC isolation levels during distributed transactions.',
          answer_outline: 'MY CUSTOM EDITED OUTLINE: Snapshot isolation, transaction wraparound, SSI.',
          difficulty: 3,
          origin: 'generated',
          is_edited: true,
          is_pinned: false,
          order_index: 1,
        },
        // 3. Technical: User-created question (MUST SURVIVE)
        {
          id: 'q_tech_user_created',
          requirement_ids: ['r1', 'r2'],
          category: 'technical',
          prompt: 'USER CREATED: How would you debug replication lag in our specific Stripe sharded DB clusters?',
          answer_outline: 'Check replication slot wal_status, disk saturation, long-running transactions.',
          difficulty: 2,
          origin: 'user_created',
          is_edited: false,
          is_pinned: false,
          order_index: 2,
        },
        // 4. Technical: Pinned question (MUST SURVIVE)
        {
          id: 'q_tech_pinned',
          requirement_ids: ['r4'],
          category: 'technical',
          prompt: 'PINNED: Describe zero-downtime database migration strategies in cloud infrastructure.',
          answer_outline: 'Dual-write, backfill, verify, flip read, stop write.',
          difficulty: 2,
          origin: 'generated',
          is_edited: false,
          is_pinned: true,
          order_index: 3,
        },
        // 5. Behavioural: in another category (MUST NOT BE TOUCHED when technical is regenerated)
        {
          id: 'q_behav_1',
          requirement_ids: ['r3'],
          category: 'behavioural',
          prompt: 'Tell me about a high-severity SEV-0 outage you led remediation for.',
          answer_outline: 'Incident commander role, timeline, blameless post-mortem.',
          difficulty: 2,
          origin: 'generated',
          is_edited: false,
          is_pinned: false,
          order_index: 4,
        },
      ],
      flashcards: [
        {
          id: 'f1',
          front: 'What is linearizability vs serializability?',
          back: 'Linearizability is real-time consistency; Serializability is order-preserving transaction execution.',
          requirement_ids: ['r1'],
          review_count: 3,
          origin: 'generated',
        },
      ],
      schedule: {
        days_available: 3,
        days: [
          {
            day: 1,
            focus: 'Core Consensus & MVCC Architecture',
            question_ids: ['q_tech_pristine', 'q_tech_edited'],
            minutes: 90,
          },
          {
            day: 2,
            focus: 'Applied Sharding & Cloud Orchestration',
            question_ids: ['q_tech_user_created', 'q_tech_pinned'],
            minutes: 75,
          },
          {
            day: 3,
            focus: 'Leadership & Incident Retrospective',
            question_ids: ['q_behav_1'],
            minutes: 45,
          },
        ],
      },
      coverage: {
        uncovered_requirement_ids: [],
        passes: 1,
      },
      crawl_status: {
        company_site_reachable: true,
        hiring_page_found: true,
        discussion_found: true,
        warnings: [],
      },
      tombstones: {
        deleted_ids: ['q_old_deleted_1'],
        deleted_question_prompts: ['describe basic binary search on an array'],
      },
    });
  };

  describe('1. Core Unit Merge Strategy: Category Regeneration', () => {
    it('preserves user-edited questions when regenerating category', async () => {
      const kit = createSampleKitDoc();
      const regenerator = new SectionRegenerator();

      const { kit: updatedKit, report } = await regenerator.regenerateSection(kit, {
        target: 'category',
        category: 'technical',
      });

      // q_tech_edited MUST survive intact
      const editedQ = updatedKit.questions.find((q) => q.id === 'q_tech_edited');
      expect(editedQ).toBeDefined();
      expect(editedQ?.prompt).toBe(
        'MY CUSTOM EDITED PROMPT: Explain PostgreSQL MVCC isolation levels during distributed transactions.'
      );
      expect(editedQ?.is_edited).toBe(true);

      // Pristine question should have been replaced
      const pristineQ = updatedKit.questions.find((q) => q.id === 'q_tech_pristine');
      expect(pristineQ).toBeUndefined();

      expect(report.preservedQuestionsCount).toBe(3); // edited + user_created + pinned
      expect(report.replacedQuestionsCount).toBe(1); // pristine
      expect(report.freshQuestionsAddedCount).toBeGreaterThan(0);
    });

    it('preserves user-created questions when regenerating category', async () => {
      const kit = createSampleKitDoc();
      const regenerator = new SectionRegenerator();

      const { kit: updatedKit } = await regenerator.regenerateSection(kit, {
        target: 'category',
        category: 'technical',
      });

      const userCreatedQ = updatedKit.questions.find((q) => q.id === 'q_tech_user_created');
      expect(userCreatedQ).toBeDefined();
      expect(userCreatedQ?.origin).toBe('user_created');
      expect(userCreatedQ?.prompt).toContain('USER CREATED:');
    });

    it('preserves pinned questions when regenerating category', async () => {
      const kit = createSampleKitDoc();
      const regenerator = new SectionRegenerator();

      const { kit: updatedKit } = await regenerator.regenerateSection(kit, {
        target: 'category',
        category: 'technical',
      });

      const pinnedQ = updatedKit.questions.find((q) => q.id === 'q_tech_pinned');
      expect(pinnedQ).toBeDefined();
      expect(pinnedQ?.is_pinned).toBe(true);
      expect(pinnedQ?.prompt).toContain('PINNED:');
    });

    it('preserves questions with explicit metadata: origin="user", state="edited", state="pinned", and increments revision', async () => {
      const kit = createSampleKitDoc();
      // Add questions with explicit enum values
      kit.questions.push(
        {
          id: 'q_explicit_user',
          requirement_ids: ['r1'],
          category: 'technical',
          prompt: 'EXPLICIT USER ORIGIN: How does gossip protocol work in Cassandra?',
          answer_outline: 'Periodic peer-to-peer state exchange using Scuttlebutt algorithms.',
          difficulty: 2,
          origin: 'user',
          state: 'active',
          revision: 1,
          is_edited: false,
          is_pinned: false,
          is_deleted: false,
          order_index: 10,
        } as any,
        {
          id: 'q_explicit_pinned',
          requirement_ids: ['r2'],
          category: 'technical',
          prompt: 'EXPLICIT PINNED STATE: Deep dive into B-Tree vs LSM-Tree storage engines.',
          answer_outline: 'Read vs write amplification trade-offs.',
          difficulty: 3,
          origin: 'generated',
          state: 'pinned',
          revision: 2,
          is_edited: false,
          is_pinned: false,
          is_deleted: false,
          order_index: 11,
        } as any,
        {
          id: 'q_explicit_deleted',
          requirement_ids: ['r1'],
          category: 'technical',
          prompt: 'EXPLICIT DELETED STATE: Obsolete question that user removed.',
          answer_outline: 'Obsolete answer.',
          difficulty: 1,
          origin: 'generated',
          state: 'deleted',
          revision: 1,
          is_edited: false,
          is_pinned: false,
          is_deleted: true,
          order_index: 12,
        } as any
      );

      const regenerator = new SectionRegenerator();
      const { kit: updatedKit } = await regenerator.regenerateSection(kit, {
        target: 'category',
        category: 'technical',
      });

      // 1. origin: 'user' question survives with revision incremented
      const userQ = updatedKit.questions.find((q) => q.id === 'q_explicit_user');
      expect(userQ).toBeDefined();
      expect(userQ?.revision).toBe(2);

      // 2. state: 'pinned' question survives with state='pinned', is_pinned=true, and revision incremented
      const pinnedQ = updatedKit.questions.find((q) => q.id === 'q_explicit_pinned');
      expect(pinnedQ).toBeDefined();
      expect(pinnedQ?.state).toBe('pinned');
      expect(pinnedQ?.is_pinned).toBe(true);
      expect(pinnedQ?.revision).toBe(3);

      // 3. state: 'deleted' question is NOT in active questions, and its prompt is tombstoned
      const deletedQ = updatedKit.questions.find((q) => q.id === 'q_explicit_deleted');
      expect(deletedQ).toBeUndefined();
      expect(
        updatedKit.tombstones.deleted_question_prompts.some((p) =>
          p.includes('obsolete question that user removed')
        )
      ).toBe(true);
    });

    it('does NOT modify questions in unrelated categories when regenerating technical questions (Rule 1)', async () => {
      const kit = createSampleKitDoc();
      const regenerator = new SectionRegenerator();

      const originalBehavQuestion = kit.questions.find((q) => q.id === 'q_behav_1');
      expect(originalBehavQuestion).toBeDefined();

      const { kit: updatedKit } = await regenerator.regenerateSection(kit, {
        target: 'category',
        category: 'technical',
      });

      // Behavioural question remains completely untouched
      const afterBehavQuestion = updatedKit.questions.find((q) => q.id === 'q_behav_1');
      expect(afterBehavQuestion).toBeDefined();
      expect(afterBehavQuestion?.prompt).toBe(originalBehavQuestion?.prompt);
      expect(afterBehavQuestion?.category).toBe('behavioural');
    });

    it('strictly respects tombstones and never resurrects deleted prompts (Rule 4)', async () => {
      const kit = createSampleKitDoc();

      // Mock question generator to attempt returning the tombstoned prompt
      const mockQuestionGen = {
        generateCategoryQuestions: vi.fn().mockResolvedValue([
          {
            id: 'q_candidate_1',
            prompt: 'Describe basic binary search on an array', // Tombstoned!
            answer_outline: 'Binary search outline',
            category: 'technical',
            difficulty: 1,
            requirement_ids: ['r1'],
          },
          {
            id: 'q_candidate_2',
            prompt: 'Explain Paxos two-phase commit protocol under network partitions.',
            answer_outline: 'Prepare and accept phases with quorum consensus.',
            category: 'technical',
            difficulty: 3,
            requirement_ids: ['r1'],
          },
        ]),
      } as any;

      const regenerator = new SectionRegenerator(mockQuestionGen);

      const { kit: updatedKit, report } = await regenerator.regenerateSection(kit, {
        target: 'category',
        category: 'technical',
      });

      // Tombstoned prompt should NOT be present in questions
      const resurrected = updatedKit.questions.find((q) =>
        q.prompt.toLowerCase().includes('binary search')
      );
      expect(resurrected).toBeUndefined();

      // Non-tombstoned question MUST be added
      const accepted = updatedKit.questions.find((q) =>
        q.prompt.includes('Paxos two-phase commit')
      );
      expect(accepted).toBeDefined();

      expect(report.tombstonesHonoredCount).toBe(1);
    });

    it('synchronizes schedule day references when pristine questions are replaced', async () => {
      const kit = createSampleKitDoc();
      const regenerator = new SectionRegenerator();

      // In Day 1: 'q_tech_pristine' was scheduled
      expect(kit.schedule.days[0]!.question_ids).toContain('q_tech_pristine');

      const { kit: updatedKit } = await regenerator.regenerateSection(kit, {
        target: 'category',
        category: 'technical',
      });

      // Day 1 must NOT reference the replaced pristine question ID
      expect(updatedKit.schedule.days[0]!.question_ids).not.toContain('q_tech_pristine');

      // All scheduled IDs must reference valid existing questions
      const allQuestionIds = new Set(updatedKit.questions.map((q) => q.id));
      for (const day of updatedKit.schedule.days) {
        for (const qId of day.question_ids) {
          expect(allQuestionIds.has(qId)).toBe(true);
        }
      }
    });

    it('recomputes coverage deterministically after category merge', async () => {
      const kit = createSampleKitDoc();
      const regenerator = new SectionRegenerator();

      const { kit: updatedKit } = await regenerator.regenerateSection(kit, {
        target: 'category',
        category: 'technical',
      });

      expect(updatedKit.coverage).toBeDefined();
      expect(Array.isArray(updatedKit.coverage.uncovered_requirement_ids)).toBe(true);
    });
  });

  describe('2. Section Independence: Company Brief Regeneration', () => {
    it('regenerates company brief without modifying role, questions, flashcards, or schedule (Rule 1)', async () => {
      const kit = createSampleKitDoc();
      const originalQuestions = JSON.parse(JSON.stringify(kit.questions));
      const originalSchedule = JSON.parse(JSON.stringify(kit.schedule));
      const originalRole = JSON.parse(JSON.stringify(kit.role));
      const originalFlashcards = JSON.parse(JSON.stringify(kit.flashcards));

      const regenerator = new SectionRegenerator();

      const { kit: updatedKit } = await regenerator.regenerateSection(kit, {
        target: 'company_brief',
      });

      // Brief updated
      expect(updatedKit.company_brief.is_edited).toBe(false);

      // Unrelated sections MUST be 100% identical
      expect(JSON.stringify(updatedKit.questions)).toBe(JSON.stringify(originalQuestions));
      expect(JSON.stringify(updatedKit.schedule)).toBe(JSON.stringify(originalSchedule));
      expect(JSON.stringify(updatedKit.role)).toBe(JSON.stringify(originalRole));
      expect(JSON.stringify(updatedKit.flashcards)).toBe(JSON.stringify(originalFlashcards));
    });

    it('preserves pinned company brief without overwriting user content (Rule 4)', async () => {
      const kit = createSampleKitDoc();
      kit.company_brief.is_pinned = true;
      kit.company_brief.summary = 'User pinned specific brief summary.';
      kit.company_brief.what_they_do = 'User pinned specific product description.';

      const regenerator = new SectionRegenerator();

      const { kit: updatedKit } = await regenerator.regenerateSection(kit, {
        target: 'company_brief',
      });

      expect(updatedKit.company_brief.summary).toBe('User pinned specific brief summary.');
      expect(updatedKit.company_brief.what_they_do).toBe('User pinned specific product description.');
    });
  });

  describe('3. Section Independence: Schedule Regeneration', () => {
    it('regenerates schedule without modifying questions, role, brief, or flashcards (Rule 1)', async () => {
      const kit = createSampleKitDoc();
      const originalQuestions = JSON.parse(JSON.stringify(kit.questions));
      const originalBrief = JSON.parse(JSON.stringify(kit.company_brief));
      const originalRole = JSON.parse(JSON.stringify(kit.role));
      const originalFlashcards = JSON.parse(JSON.stringify(kit.flashcards));

      const regenerator = new SectionRegenerator();

      const { kit: updatedKit } = await regenerator.regenerateSection(kit, {
        target: 'schedule',
      });

      // Schedule is reallocated
      expect(updatedKit.schedule.days).toHaveLength(kit.schedule.days_available);
      for (const day of updatedKit.schedule.days) {
        expect(Number.isInteger(day.minutes)).toBe(true);
        expect(day.minutes).toBeGreaterThan(0);
      }

      // Questions and other sections MUST be 100% identical
      expect(JSON.stringify(updatedKit.questions)).toBe(JSON.stringify(originalQuestions));
      expect(JSON.stringify(updatedKit.company_brief)).toBe(JSON.stringify(originalBrief));
      expect(JSON.stringify(updatedKit.role)).toBe(JSON.stringify(originalRole));
      expect(JSON.stringify(updatedKit.flashcards)).toBe(JSON.stringify(originalFlashcards));
    });
  });

  describe('4. End-to-End API Regeneration Endpoints & Ownership Enforcement', () => {
    it('rejects regeneration requests with invalid target with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/kits/507f1f77bcf86cd799439011/regenerate')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ target: 'invalid_section' });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });

    it('requires category when target is "category"', async () => {
      const res = await request(app)
        .post('/api/kits/507f1f77bcf86cd799439011/regenerate')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ target: 'category' }); // missing category

      expect(res.status).toBe(400);
    });

    it('strictly forbids User B from triggering regeneration on User A’s kit with 403 Forbidden', async () => {
      // Kit owned by testUserId (User A), request sent with otherUserToken (User B)
      const res = await request(app)
        .post('/api/kits/507f1f77bcf86cd799439011/regenerate')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ target: 'schedule' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_KIT_ACCESS');
    });

    it('successfully regenerates technical category via API and preserves user edited questions', async () => {
      const res = await request(app)
        .post('/api/kits/507f1f77bcf86cd799439011/regenerate')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ target: 'category', category: 'technical' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.kit).toBeDefined();
      expect(res.body.data.report.preservedQuestionsCount).toBeGreaterThan(0);
    });
  });
});
