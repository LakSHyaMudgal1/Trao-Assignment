'use client';

import React, { useState } from 'react';
import { ExternalLink, Plus, Trash2, CheckCircle2, Globe, Building2, Search, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../../ui/Card';

interface CompanyBriefData {
  summary: string;
  what_they_do: string;
  sources: string[];
  is_edited?: boolean;
}

interface CrawlStatusData {
  company_site_reachable: boolean;
  hiring_page_found: boolean;
  discussion_found: boolean;
  warnings?: string[];
}

interface CompanyBriefSectionProps {
  companyBrief: CompanyBriefData;
  sourceCompany?: string;
  companyUrl?: string;
  crawlStatus?: CrawlStatusData;
  onChange: (updatedBrief: CompanyBriefData) => void;
  onRegenerate?: () => void;
}

export function CompanyBriefSection({
  companyBrief,
  sourceCompany = 'Target Company',
  companyUrl = '',
  crawlStatus,
  onChange,
  onRegenerate,
}: CompanyBriefSectionProps) {
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [isAddingSource, setIsAddingSource] = useState(false);

  const handleSummaryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({
      ...companyBrief,
      summary: e.target.value,
      is_edited: true,
    });
  };

  const handleWhatTheyDoChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({
      ...companyBrief,
      what_they_do: e.target.value,
      is_edited: true,
    });
  };

  const handleAddSource = () => {
    const trimmed = newSourceUrl.trim();
    if (!trimmed) return;
    if (companyBrief.sources.includes(trimmed)) {
      setNewSourceUrl('');
      setIsAddingSource(false);
      return;
    }
    onChange({
      ...companyBrief,
      sources: [...companyBrief.sources, trimmed],
      is_edited: true,
    });
    setNewSourceUrl('');
    setIsAddingSource(false);
  };

  const handleRemoveSource = (indexToRemove: number) => {
    onChange({
      ...companyBrief,
      sources: companyBrief.sources.filter((_, idx) => idx !== indexToRemove),
      is_edited: true,
    });
  };

  return (
    <div className="space-y-6" id="section-company-brief">
      {/* Research Intelligence Status Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white text-base">{sourceCompany}</h3>
              {companyUrl && (
                <a
                  href={companyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <span>{new URL(companyUrl).hostname}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Verified corporate intelligence and architectural overview
            </p>
          </div>
        </div>

        {/* Crawl Status Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium border ${
              crawlStatus?.company_site_reachable !== false
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            {crawlStatus?.company_site_reachable !== false ? 'Site Verified' : 'Site Unreachable'}
          </span>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium border ${
              crawlStatus?.hiring_page_found
                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                : 'bg-slate-800/80 text-slate-400 border-slate-700'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {crawlStatus?.hiring_page_found ? 'Hiring Page Indexed' : 'Generic Careers Fallback'}
          </span>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium border ${
              crawlStatus?.discussion_found
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                : 'bg-slate-800/80 text-slate-400 border-slate-700'
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            {crawlStatus?.discussion_found ? 'Public Intel Discovered' : 'Limited Public Discussion'}
          </span>

          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-950/40 px-3 py-1 text-xs font-semibold text-indigo-300 hover:bg-indigo-900/60 hover:text-white transition-colors cursor-pointer"
              title="Regenerate company brief while preserving user sources"
            >
              <RefreshCw className="h-3.5 w-3.5 text-indigo-400" />
              <span>Regenerate Brief</span>
            </button>
          )}
        </div>
      </div>

      {/* Editor Grid: Summary and What They Do */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Executive Summary */}
        <Card className="flex flex-col">
          <CardHeader className="flex items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                1. Executive Summary
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Core company focus, market positioning, and tech vision
              </p>
            </div>
            {companyBrief.is_edited && (
              <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-400 border border-amber-500/20">
                Edited
              </span>
            )}
          </CardHeader>
          <div className="flex-1 pt-2">
            <textarea
              value={companyBrief.summary}
              onChange={handleSummaryChange}
              rows={6}
              aria-label="Executive Summary"
              placeholder="Enter company executive summary..."
              className="w-full h-full min-h-[140px] resize-y rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-sm text-slate-100 placeholder-slate-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 leading-relaxed font-sans"
            />
          </div>
        </Card>

        {/* What They Do */}
        <Card className="flex flex-col">
          <CardHeader className="flex items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                2. What They Do
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Flagship products, business model, and engineering scale
              </p>
            </div>
            {companyBrief.is_edited && (
              <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-400 border border-amber-500/20">
                Edited
              </span>
            )}
          </CardHeader>
          <div className="flex-1 pt-2">
            <textarea
              value={companyBrief.what_they_do}
              onChange={handleWhatTheyDoChange}
              rows={6}
              aria-label="What They Do"
              placeholder="Describe primary products, architecture, and technology..."
              className="w-full h-full min-h-[140px] resize-y rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-sm text-slate-100 placeholder-slate-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 leading-relaxed font-sans"
            />
          </div>
        </Card>
      </div>

      {/* Sources & Verified Pages */}
      <Card>
        <CardHeader className="flex items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              3. Verified Evidence Sources ({companyBrief.sources.length})
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Targeted pages discovered and analyzed by the crawler pipeline
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddingSource(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Source</span>
          </button>
        </CardHeader>

        {isAddingSource && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-950/20 p-2.5">
            <input
              type="url"
              value={newSourceUrl}
              onChange={(e) => setNewSourceUrl(e.target.value)}
              placeholder="https://company.com/about or /careers"
              className="flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddSource();
                if (e.key === 'Escape') setIsAddingSource(false);
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={handleAddSource}
              className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setIsAddingSource(false)}
              className="rounded border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {companyBrief.sources.map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              className="group flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-700 transition-colors"
            >
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-indigo-300 hover:text-indigo-200 truncate max-w-xs sm:max-w-md"
                title={url}
              >
                <span className="truncate">{url}</span>
                <ExternalLink className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
              </a>
              <button
                type="button"
                onClick={() => handleRemoveSource(idx)}
                aria-label={`Remove source ${url}`}
                className="text-slate-500 hover:text-rose-400 transition-colors p-0.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {companyBrief.sources.length === 0 && (
            <p className="text-xs text-slate-500 italic py-2">
              No specific sources linked yet. Click &quot;Add Source&quot; to append relevant reference links.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
