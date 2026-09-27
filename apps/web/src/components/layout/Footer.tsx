export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 py-8 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-slate-300">AI Interview Prep Kit</span>
            <span className="text-slate-600">|</span>
            <span className="text-xs text-slate-500">Trao Full-Stack Engineering Assessment</span>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-500">
            <span>Deterministic Coverage & Scheduling</span>
            <span>Appendix A Conformance</span>
            <span>Free Tier Resilience</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
