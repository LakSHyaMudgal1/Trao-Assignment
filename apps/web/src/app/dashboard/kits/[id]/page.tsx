'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Download,
  Building2,
  Briefcase,
  HelpCircle,
  Layers,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { ProtectedRoute } from '../../../../components/auth/ProtectedRoute';
import { api } from '../../../../lib/api-client';
import { CompanyBriefSection } from '../../../../components/kit/builder/CompanyBriefSection';
import { RoleSection } from '../../../../components/kit/builder/RoleSection';
import { QuestionsSection } from '../../../../components/kit/builder/QuestionsSection';
import { FlashcardsSection } from '../../../../components/kit/builder/FlashcardsSection';
import { ScheduleSection } from '../../../../components/kit/builder/ScheduleSection';
import { CoverageSection } from '../../../../components/kit/builder/CoverageSection';
import { PageSkeleton } from '../../../../components/ui/Skeleton';

type SectionTab = 'all' | 'brief' | 'role' | 'questions' | 'flashcards' | 'schedule' | 'coverage';

export default function KitBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const kitId = params.id as string;

  const [kit, setKit] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Active section tab
  const [activeTab, setActiveTab] = useState<SectionTab>('all');

  // Persistence / Saving State
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const kitRef = useRef<any>(kit);
  kitRef.current = kit;

  // 1. Load Kit from Backend API
  const loadKit = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await api.getKit(kitId);
      setKit(data);
      setIsDirty(false);
      setLastSavedAt(new Date());
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load preparation kit.');
    } finally {
      setIsLoading(false);
    }
  }, [kitId]);

  useEffect(() => {
    loadKit();
  }, [loadKit]);

  // 2. Save Changes (Optimistic Local State synced with Backend)
  const saveChanges = useCallback(async () => {
    if (!kitRef.current || isSaving) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      // Recompute coverage dynamically before saving
      const currentKit = kitRef.current;
      const reqIds = new Set<string>((currentKit.role?.requirements || []).map((r: any) => String(r.id)));
      const referenced = new Set<string>();
      for (const q of currentKit.questions || []) {
        for (const rId of q.requirement_ids || []) {
          referenced.add(String(rId));
        }
      }
      const uncovered: string[] = Array.from(reqIds).filter((id: string) => !referenced.has(id));

      const payload = {
        ...currentKit,
        coverage: {
          ...currentKit.coverage,
          uncovered_requirement_ids: uncovered,
        },
      };

      const updated = await api.updateKit(kitId, payload);
      setKit(updated);
      setIsDirty(false);
      setLastSavedAt(new Date());
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  }, [kitId, isSaving]);

  // 3. Keyboard Shortcut: Ctrl+S / Cmd+S to Save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveChanges();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveChanges]);

  // 4. Auto-save debounce effect (saves 2.5s after editing stops)
  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => {
      saveChanges();
    }, 2500);
    return () => clearTimeout(timer);
  }, [isDirty, kit, saveChanges]);

  // Section Change Handlers (Optimistic Updates)
  const handleBriefChange = (updatedBrief: any) => {
    setKit((prev: any) => ({ ...prev, company_brief: updatedBrief }));
    setIsDirty(true);
  };

  const handleRoleChange = (updatedRole: any) => {
    setKit((prev: any) => ({ ...prev, role: updatedRole }));
    setIsDirty(true);
  };

  const handleQuestionsChange = (updatedQuestions: any[]) => {
    setKit((prev: any) => {
      // Also sync coverage uncovered list
      const reqIds = new Set<string>((prev.role?.requirements || []).map((r: any) => String(r.id)));
      const referenced = new Set<string>();
      for (const q of updatedQuestions) {
        for (const rId of q.requirement_ids || []) {
          referenced.add(String(rId));
        }
      }
      const uncovered: string[] = Array.from(reqIds).filter((id: string) => !referenced.has(id));

      return {
        ...prev,
        questions: updatedQuestions,
        coverage: {
          ...prev.coverage,
          uncovered_requirement_ids: uncovered,
        },
      };
    });
    setIsDirty(true);
  };

  const handleFlashcardsChange = (updatedFlashcards: any[]) => {
    setKit((prev: any) => ({ ...prev, flashcards: updatedFlashcards }));
    setIsDirty(true);
  };

  const handleScheduleChange = (updatedSchedule: any) => {
    setKit((prev: any) => ({ ...prev, schedule: updatedSchedule }));
    setIsDirty(true);
  };

  const handleRecordFlashcardReview = async (cardId: string, confidence: number) => {
    try {
      await api.recordFlashcardReview(kitId, cardId, confidence);
    } catch (err) {
      console.error('Failed to persist review rating to server:', err);
    }
  };

  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);

  const handleRegenerateSection = async (
    target: 'company_brief' | 'category' | 'schedule',
    category?: string
  ) => {
    if (isRegenerating) return;
    setIsRegenerating(true);
    try {
      if (isDirty) {
        await saveChanges();
      }
      const result = await api.regenerateSection(kitId, target, category);
      if (result.kit) {
        setKit(result.kit);
        setIsDirty(false);
        setLastSavedAt(new Date());
      }
    } catch (err: any) {
      alert(`Regeneration failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleExportAppendixA = async () => {
    try {
      const appendixAData = await api.exportAppendixA(kitId);
      const jsonStr = JSON.stringify(appendixAData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${kit?.source?.company || 'prep-kit'}-appendix-a.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  // Loading Screen with Complete Page Skeleton
  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#090d16] text-slate-100 py-6">
          <PageSkeleton />
        </div>
      </ProtectedRoute>
    );
  }

  // Error Screen
  if (loadError || !kit) {
    return (
      <ProtectedRoute>
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-4">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-white">Kit Not Found or Unauthorized</h2>
          <p className="text-sm text-slate-400 mt-2">{loadError || 'This interview kit does not exist or you do not have permission to view it.'}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={loadKit}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Retry</span>
            </button>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const coveredReqIds = new Set<string>();
  for (const q of kit.questions || []) {
    for (const rId of q.requirement_ids || []) {
      coveredReqIds.add(rId);
    }
  }

  const totalReqCount = kit.role?.requirements?.length || 0;
  const coveragePercent =
    totalReqCount > 0 ? Math.round((coveredReqIds.size / totalReqCount) * 100) : 100;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#090d16] text-slate-100 pb-20">
        {/* Sticky Top Header Dock */}
        <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#090d16]/90 backdrop-blur-md">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between gap-4">
              {/* Left: Back & Title */}
              <div className="flex items-center gap-3 truncate">
                <Link
                  href="/dashboard"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors shrink-0"
                  title="Back to Dashboard"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>

                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <h1 className="text-sm sm:text-base font-bold text-white truncate">
                      {kit.source?.company || 'Interview Kit'}
                    </h1>
                    <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300 shrink-0">
                      {kit.role?.title || 'Engineer'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>{kit.schedule?.days_available || 5} Day Plan</span>
                    <span>•</span>
                    <span className="font-mono text-emerald-400">{coveragePercent}% Covered</span>
                  </div>
                </div>
              </div>

              {/* Right: Saving Indicator, Save Button, Export */}
              <div className="flex items-center gap-2.5 shrink-0">
                {/* Save State Badge */}
                <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono">
                  {isSaving ? (
                    <span className="flex items-center gap-1.5 text-indigo-400">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving...</span>
                    </span>
                  ) : saveError ? (
                    <span className="flex items-center gap-1.5 text-rose-400" title={saveError}>
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>Save Error (Retry)</span>
                    </span>
                  ) : isDirty ? (
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                      <span>Unsaved</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Saved</span>
                    </span>
                  )}
                </div>

                {/* Manual Save Button */}
                <button
                  type="button"
                  onClick={saveChanges}
                  disabled={isSaving || !isDirty}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition-all ${
                    isDirty
                      ? 'bg-indigo-600 text-white hover:bg-indigo-500 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                  }`}
                  title="Save Kit (Ctrl+S / Cmd+S)"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save</span>
                </button>

                {/* Export Appendix A Button */}
                <button
                  type="button"
                  onClick={handleExportAppendixA}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
                  title="Export official Appendix A formatted JSON"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Export Appendix A</span>
                  <span className="md:hidden">Export</span>
                </button>

                {/* Practice Mode Button */}
                <Link
                  href={`/dashboard/kits/${kitId}/practice`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-950/40 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-900/60 hover:text-white transition-colors"
                  title="Enter interactive flashcard practice mode"
                >
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">Practice Mode</span>
                  <span className="sm:hidden">Practice</span>
                </Link>
              </div>
            </div>

            {/* Section Tab Bar */}
            <nav className="flex space-x-1 overflow-x-auto pb-2 scrollbar-none" role="tablist" aria-label="Kit Sections">
              {[
                { key: 'all', label: 'All Sections', icon: Layers },
                { key: 'brief', label: 'Company Brief', icon: Building2 },
                { key: 'role', label: 'Role & Skills', icon: Briefcase },
                {
                  key: 'questions',
                  label: `Questions (${kit.questions?.length || 0})`,
                  icon: HelpCircle,
                },
                {
                  key: 'flashcards',
                  label: `Flashcards (${kit.flashcards?.length || 0})`,
                  icon: Layers,
                },
                {
                  key: 'schedule',
                  label: `Schedule (${kit.schedule?.days_available || 5}d)`,
                  icon: Calendar,
                },
                {
                  key: 'coverage',
                  label: `Coverage (${coveragePercent}%)`,
                  icon: ShieldCheck,
                },
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setActiveTab(tab.key as SectionTab)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                      isSelected
                        ? 'bg-slate-800 text-white font-semibold shadow-inner border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 opacity-70" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-12">
          {/* Save Error Alert Banner */}
          {saveError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-rose-950/20"
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>
                  <strong className="font-semibold text-rose-200">Unable to save changes:</strong> {saveError}
                </span>
              </div>
              <button
                onClick={saveChanges}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-white hover:bg-rose-500 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSaving ? 'animate-spin' : ''}`} />
                <span>Retry Save</span>
              </button>
            </div>
          )}

          {/* Section 1: Company Brief */}
          {(activeTab === 'all' || activeTab === 'brief') && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-indigo-400" />
                  <h2 className="text-lg font-bold text-white">1. Company Brief</h2>
                </div>
              </div>
              <CompanyBriefSection
                companyBrief={kit.company_brief}
                sourceCompany={kit.source?.company}
                companyUrl={kit.source?.company_url}
                crawlStatus={kit.crawl_status}
                onChange={handleBriefChange}
                onRegenerate={() => handleRegenerateSection('company_brief')}
              />
            </section>
          )}

          {/* Section 2: Role */}
          {(activeTab === 'all' || activeTab === 'role') && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-indigo-400" />
                  <h2 className="text-lg font-bold text-white">2. Role & Extracted Requirements</h2>
                </div>
              </div>
              <RoleSection
                role={kit.role}
                coveredRequirementIds={coveredReqIds}
                onChange={handleRoleChange}
              />
            </section>
          )}

          {/* Section 3: Questions */}
          {(activeTab === 'all' || activeTab === 'questions') && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-indigo-400" />
                  <h2 className="text-lg font-bold text-white">
                    3. Categorized Interview Questions ({kit.questions?.length || 0})
                  </h2>
                </div>
              </div>
              <QuestionsSection
                questions={kit.questions || []}
                requirements={kit.role?.requirements || []}
                onChange={handleQuestionsChange}
                onRegenerateCategory={(cat) => handleRegenerateSection('category', cat)}
              />
            </section>
          )}

          {/* Section 4: Flashcards */}
          {(activeTab === 'all' || activeTab === 'flashcards') && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-indigo-400" />
                  <h2 className="text-lg font-bold text-white">
                    4. Flashcards & Recall Drills ({kit.flashcards?.length || 0})
                  </h2>
                </div>
              </div>
              <FlashcardsSection
                kitId={kitId}
                flashcards={kit.flashcards || []}
                requirements={kit.role?.requirements || []}
                onChange={handleFlashcardsChange}
                onRecordReview={handleRecordFlashcardReview}
              />
            </section>
          )}

          {/* Section 5: Schedule */}
          {(activeTab === 'all' || activeTab === 'schedule') && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-400" />
                  <h2 className="text-lg font-bold text-white">
                    5. Deterministic Study Schedule ({kit.schedule?.days_available || 5} Days)
                  </h2>
                </div>
              </div>
              <ScheduleSection
                schedule={kit.schedule}
                questions={kit.questions || []}
                onChange={handleScheduleChange}
                onRegenerate={() => handleRegenerateSection('schedule')}
              />
            </section>
          )}

          {/* Section 6: Coverage */}
          {(activeTab === 'all' || activeTab === 'coverage') && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                  <h2 className="text-lg font-bold text-white">6. Deterministic Coverage Audit</h2>
                </div>
              </div>
              <CoverageSection
                coverage={kit.coverage}
                requirements={kit.role?.requirements || []}
                questions={kit.questions || []}
                onAddQuestionForReq={(reqId) => {
                  setActiveTab('questions');
                  // Quick scroll to questions
                  const el = document.getElementById('section-questions');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
              />
            </section>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
