import Link from 'next/link';
import { Card } from '../components/ui/Card';

export default function HomePage() {
  const pipelineSteps = [
    {
      num: '01',
      title: 'SSRF-Safe Retrieval',
      desc: 'Crawls company website with heuristic link ranking, robots.txt checks, and public interview discussion search.',
      tag: 'Scraping',
    },
    {
      num: '02',
      title: 'Requirement Extraction',
      desc: 'Parses job descriptions into verified must-have and nice-to-have requirements with zero hallucinations.',
      tag: 'Extraction',
    },
    {
      num: '03',
      title: 'Categorized Generation',
      desc: 'Generates targeted questions across Technical, Behavioural, System Design, and Company Fit categories.',
      tag: 'LLM Generation',
    },
    {
      num: '04',
      title: 'Deterministic Coverage',
      desc: 'Pure TypeScript set logic compares generated questions against requirements and triggers a second remediation pass.',
      tag: 'Deterministic',
    },
    {
      num: '05',
      title: 'Arithmetic Scheduling',
      desc: 'Distributes study topics across exactly the available days, frontloading harder challenges and high-priority must-haves.',
      tag: 'Deterministic',
    },
    {
      num: '06',
      title: 'Surgical Builder & SRS',
      desc: 'Edit, reorder, and regenerate sections without clobbering manual edits. Practice flashcards with spaced repetition.',
      tag: 'Interactive Studio',
    },
  ];

  return (
    <div className="relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/10 blur-[128px]" />
      <div className="absolute top-1/3 right-1/4 -z-10 h-64 w-64 rounded-full bg-cyan-500/10 blur-[96px]" />

      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-4 pt-20 pb-16 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1 text-xs font-medium text-indigo-300 mb-6">
          <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
          Trao Full-Stack Engineering Assessment | FS-AI-INTERVIEW-01
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl md:text-7xl">
          The <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-300 to-cyan-400">AI Interview</span> Prep Kit
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300 leading-relaxed">
          Transform job postings and company sites into complete, personalized interview kits.
          Powered by verified company intelligence, deterministic coverage checking, and arithmetic scheduling.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/dashboard/new"
            className="rounded-lg bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Create Interview Kit
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-800 bg-slate-900/60 px-6 py-3.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Explore Dashboard
          </Link>
        </div>

        {/* Command callout */}
        <div className="mx-auto mt-12 max-w-xl rounded-xl border border-slate-800 bg-slate-950/80 p-3 shadow-inner text-left font-mono text-xs text-slate-400 flex items-center justify-between">
          <span className="text-slate-500 select-none">$</span>
          <span className="text-indigo-300 select-all">npm run evaluate -- --input cases.json --output kits.json</span>
          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">Mandatory Batch CLI</span>
        </div>
      </section>

      {/* Architecture Separation Section */}
      <section id="architecture" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 border-t border-slate-900">
        <div className="text-center mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Architectural Separation of Concerns
          </h2>
          <p className="mt-3 text-slate-400 max-w-xl mx-auto text-sm">
            Core requirements demand absolute separation between retrieval, extraction, generation, coverage verification, and arithmetic scheduling.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pipelineSteps.map((step) => (
            <Card key={step.num} className="relative overflow-hidden border-slate-800/80 bg-slate-900/40 hover:border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xl font-bold text-slate-600">{step.num}</span>
                <span className="rounded-full bg-slate-800/80 px-2.5 py-0.5 text-[11px] font-medium text-slate-300 border border-slate-700/60">
                  {step.tag}
                </span>
              </div>
              <h3 className="text-base font-semibold text-slate-100 mb-2">{step.title}</h3>
              <p className="text-xs leading-relaxed text-slate-400">{step.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Key Invariants Section */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 border-t border-slate-900">
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-950 p-8 sm:p-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-indigo-400">Strict Schema</h4>
              <p className="mt-2 text-2xl font-bold text-white">Appendix A</p>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Exact field conformity with verified question-requirement references and integer minute durations.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-cyan-400">Deterministic Logic</h4>
              <p className="mt-2 text-2xl font-bold text-white">Arithmetic & Set Math</p>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Topic distribution across days and gap detection are calculated purely in TypeScript without LLM interference.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-emerald-400">Builder Resilience</h4>
              <p className="mt-2 text-2xl font-bold text-white">State Preservation</p>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                User edits, manual additions, and pinned questions survive category and section-level regenerations.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
