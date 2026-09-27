'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, CheckCircle2, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { ProtectedRoute } from '../../../components/auth/ProtectedRoute';
import { Card, CardTitle, CardHeader } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { api } from '../../../lib/api-client';

const PIPELINE_STAGES = [
  'Validate Input Parameters',
  'Extract Core Requirements from JD',
  'Fetch Company Homepage',
  'Crawl & Rank Architectural Links',
  'Extract Product & About Intel',
  'Discover Hiring & Culture Pages',
  'Search Public Interview Intel',
  'Clean & Consolidate Research',
  'Synthesize Company Brief',
  'Generate Categorized Questions',
  'Generate Spaced Repetition Flashcards',
  'Deterministic Coverage Audit (Pass 1)',
  'Second-Pass Question Generation',
  'Deterministic Coverage Verification (Pass 2)',
  'Deterministic Schedule Allocation',
  'Validate Appendix A Schema',
  'Persist Verified Prep Kit',
];

export default function NewKitPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [companyUrl, setCompanyUrl] = useState('');
  const [jd, setJd] = useState('');
  const [days, setDays] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generation progress state
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [liveStages, setLiveStages] = useState<any[]>([]);
  const [liveWarnings, setLiveWarnings] = useState<string[]>([]);

  const pollJobStatus = async (jobId: string) => {
    try {
      const job = await api.getJobStatus(jobId);

      if (job.stages && Array.isArray(job.stages)) {
        setLiveStages(job.stages);
        const completedCount = job.stages.filter((s: any) => s.status === 'completed').length;
        setCurrentStageIndex(Math.min(completedCount, PIPELINE_STAGES.length - 1));
        const activeStage = job.stages.find((s: any) => s.status === 'running');
        if (activeStage) {
          setProgressMessage(`Running: ${activeStage.name}...`);
        }
      }

      if (job.warnings && Array.isArray(job.warnings) && job.warnings.length > 0) {
        setLiveWarnings(job.warnings);
      }

      if (job.status === 'completed' && job.result_kit_id) {
        setProgressMessage('Generation complete! Redirecting to kit builder...');
        router.push(`/dashboard/kits/${job.result_kit_id}`);
        return;
      }

      if (job.status === 'failed') {
        setIsLoading(false);
        setError(job.error || 'Kit generation failed during pipeline execution.');
        return;
      }

      // Continue polling every 1000ms
      setTimeout(() => pollJobStatus(jobId), 1000);
    } catch (err: any) {
      console.error('Error polling job status:', err);
      setTimeout(() => pollJobStatus(jobId), 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyUrl || !jd) {
      setError('Please provide both the company website URL and the job description.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setLiveWarnings([]);
    setLiveStages([]);
    setCurrentStageIndex(0);
    setProgressMessage('Initiating sequential 17-stage research pipeline...');

    try {
      const result = await api.generateKit({
        company_url: companyUrl,
        jd,
        days,
      });

      setCurrentJobId(result.jobId);
      pollJobStatus(result.jobId);
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Failed to initiate kit generation.');
    }
  };

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs font-mono text-indigo-400 mb-1">
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI-Powered Automated Research</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Create Interview Prep Kit
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Our sequential research orchestrator crawls the company, extracts core requirements, runs deterministic audits, and builds a phased study schedule.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 mb-8" role="tablist" aria-label="Creation Mode">
          <button
            role="tab"
            aria-selected={activeTab === 'single'}
            onClick={() => setActiveTab('single')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
              activeTab === 'single'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Single Job Posting
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'batch'}
            onClick={() => setActiveTab('batch')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
              activeTab === 'batch'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Batch Evaluation Mode (Cases JSON)
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300 flex items-start gap-3 shadow-lg shadow-rose-950/20"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-rose-200">Kit Generation Failed</p>
              <p className="mt-0.5 text-rose-300/90 leading-relaxed">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-rose-400 hover:text-rose-200 cursor-pointer text-xs font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Live Generation Progress Card & 17-Stage Pipeline Trace */}
        {isLoading && (
          <div className="mb-8 rounded-xl border border-indigo-500/40 bg-gradient-to-b from-slate-900 via-indigo-950/20 to-slate-900 p-5 sm:p-6 shadow-xl shadow-indigo-950/30 space-y-5">
            <div className="flex items-center justify-between border-b border-indigo-500/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">
                    Sequential Research Orchestration Active
                  </h3>
                  <p className="text-xs text-indigo-300/80 font-mono mt-0.5">
                    {progressMessage || PIPELINE_STAGES[currentStageIndex]}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-xs font-bold text-indigo-300">
                  {Math.round(((currentStageIndex + 1) / PIPELINE_STAGES.length) * 100)}%
                </span>
                <p className="font-mono text-[10px] text-slate-400">
                  Stage {currentStageIndex + 1} of {PIPELINE_STAGES.length}
                </p>
              </div>
            </div>

            {/* Glowing Progress bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950 border border-indigo-950">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 transition-all duration-300 shadow-sm shadow-indigo-500"
                style={{
                  width: `${Math.round(((currentStageIndex + 1) / PIPELINE_STAGES.length) * 100)}%`,
                }}
              />
            </div>

            {/* Partial Research Fallback Warnings */}
            {liveWarnings.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>Partial Research Notice (Pipeline Continues Honestly)</span>
                </div>
                {liveWarnings.map((w, i) => (
                  <p key={i} className="text-[11px] text-amber-200/90 pl-5">
                    • {w}
                  </p>
                ))}
              </div>
            )}

            {/* Sequential Stage Execution Trace */}
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {PIPELINE_STAGES.map((stageName, idx) => {
                const liveStage = liveStages.find((s) => s.name === stageName);
                const isCompleted = idx < currentStageIndex || liveStage?.status === 'completed';
                const isRunning = idx === currentStageIndex || liveStage?.status === 'running';

                return (
                  <div
                    key={stageName}
                    className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                      isRunning
                        ? 'bg-indigo-950/60 border border-indigo-500/40 text-indigo-200 font-semibold'
                        : isCompleted
                        ? 'bg-slate-900/60 text-slate-300'
                        : 'text-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {isCompleted ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      ) : isRunning ? (
                        <RefreshCw className="h-3.5 w-3.5 text-indigo-400 animate-spin shrink-0" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-slate-700 ml-1 mr-0.5 shrink-0" />
                      )}
                      <span className="truncate">{stageName}</span>
                    </div>

                    <span className="text-[10px] text-slate-500 shrink-0">
                      {isCompleted ? 'Done' : isRunning ? 'In Progress...' : 'Queued'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'single' ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-slate-200">1. Company Website</CardTitle>
                <p className="text-xs text-slate-400 mt-1">
                  Enter the company homepage. The crawler will discover hiring pages, culture notes, and public interview intel.
                </p>
              </CardHeader>
              <div>
                <label htmlFor="company-url" className="sr-only">Company URL</label>
                <input
                  id="company-url"
                  name="company_url"
                  type="url"
                  required
                  placeholder="https://acme.corp"
                  value={companyUrl}
                  onChange={(e) => setCompanyUrl(e.target.value)}
                  disabled={isLoading}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
                />
              </div>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base text-slate-200">2. Job Description</CardTitle>
                    <p className="text-xs text-slate-400 mt-1">
                      Paste the complete raw job posting. Our extractor will isolate must-have vs. nice-to-have requirements.
                    </p>
                  </div>
                  <span className="font-mono text-xs text-slate-500">
                    {jd.length} chars
                  </span>
                </div>
              </CardHeader>
              <div>
                <label htmlFor="jd-textarea" className="sr-only">Job Description</label>
                <textarea
                  id="jd-textarea"
                  name="jd"
                  required
                  rows={9}
                  disabled={isLoading}
                  placeholder="Paste the job description here... (e.g. Senior Backend Engineer, required skills, responsibilities)"
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3.5 text-sm text-slate-100 placeholder-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 font-mono leading-relaxed disabled:opacity-50"
                />
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base text-slate-200">3. Time Before Interview</CardTitle>
                <p className="text-xs text-slate-400 mt-1">
                  Arithmetic scheduler distributes topics across exactly this many days (1 to 60 days).
                </p>
              </CardHeader>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-200">
                    {days} {days === 1 ? 'Day' : 'Days'} Available
                  </span>
                  <div className="flex gap-1.5">
                    {[1, 3, 5, 7, 14, 30].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDays(preset)}
                        disabled={isLoading}
                        className={`rounded px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors ${
                          days === preset
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                        } disabled:opacity-50`}
                      >
                        {preset}d
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  type="range"
                  min={1}
                  max={60}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  disabled={isLoading}
                  className="w-full accent-indigo-500 cursor-pointer disabled:opacity-50"
                  aria-label="Days before interview"
                />
              </div>
            </Card>

            <div className="flex items-center justify-end gap-3 pt-4">
              <Button
                type="submit"
                size="lg"
                isLoading={isLoading}
                className="w-full sm:w-auto"
              >
                Start Automated Research & Generation
              </Button>
            </div>
          </form>
        ) : (
          <Card className="p-8 text-center border-dashed border-slate-800 bg-slate-900/40">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-400 mb-4">
              <Layers className="h-6 w-6" />
            </div>
            <CardTitle className="text-base text-slate-200">Upload JSON Cases File</CardTitle>
            <p className="mt-2 max-w-md mx-auto text-xs text-slate-400">
              Upload an array of description-and-company pairs matching the Appendix B format:
              <code className="block mt-2 rounded bg-slate-950 p-2 font-mono text-indigo-300 text-left">
                [{JSON.stringify({ id: "case-01", jd: "...", company_url: "...", days: 5 }, null, 2)}]
              </code>
            </p>
            <div className="mt-6">
              <Button variant="outline" size="sm">Choose File</Button>
            </div>
          </Card>
        )}
      </div>
    </ProtectedRoute>
  );
}
