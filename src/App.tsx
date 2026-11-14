import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Moon,
  RefreshCw,
  RotateCcw,
  Sun,
  Upload,
  X,
} from 'lucide-react';
import {
  EMBEDDED_SHELL_CSV,
  GOOGLE_SHEET_GVIZ_URL,
} from './data/embeddedCsv';
import {
  DashboardTab,
  DataSyncState,
  EmployeeRecord,
  FilterState,
} from './types/employee';
import {
  computeLevelMedians,
  filterEmployees,
  scoreEmployees,
} from './utils/analytics';
import { fetchGoogleSheetCsv, parseEmployeeCsv } from './utils/csv';
import { OverviewTab } from './components/OverviewTab';
import { DeepDiveTab } from './components/DeepDiveTab';
import { InsightsTab } from './components/InsightsTab';

const DEFAULT_FILTERS: FilterState = {
  department: 'All',
  location: 'All',
  employmentType: 'All',
  gender: 'All',
  attrition: 'All',
};

function ShellEmblem() {
  return (
    <svg
      width="28"
      height="26"
      viewBox="0 0 32 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M16 2C8.8 2 3 7.6 3 14.5C3 19.3 5.7 23.4 9.8 25.5L11.2 28H20.8L22.2 25.5C26.3 23.4 29 19.3 29 14.5C29 7.6 23.2 2 16 2Z"
        fill="#FFC800"
        stroke="#F58220"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M16 5V24M16 24L9.5 7.5M16 24L22.5 7.5M16 24L5.5 13M16 24L26.5 13"
        stroke="#F58220"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('shell-pa-theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    } catch {
      return false;
    }
  });

  const [rawRecords, setRawRecords] = useState<EmployeeRecord[]>(() =>
    parseEmployeeCsv(EMBEDDED_SHELL_CSV)
  );
  const [syncState, setSyncState] = useState<DataSyncState>(() => ({
    source: 'embedded-snapshot',
    sourceLabel: 'Shell UK Snapshot (250 rows)',
    lastSyncedAt: null,
    isSyncing: false,
    error: null,
    rowCount: 250,
  }));

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync Tailwind .dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      document.body.className =
        'bg-[#0A0A0B] text-zinc-100 antialiased selection:bg-[#FFC800] selection:text-[#0A0A0B]';
    } else {
      root.classList.remove('dark');
      document.body.className =
        'bg-[#F7F7F5] text-[#0A0A0B] antialiased selection:bg-[#FFC800] selection:text-[#0A0A0B]';
    }
    try {
      localStorage.setItem('shell-pa-theme', isDark ? 'dark' : 'light');
    } catch {
      // ignore storage failure
    }
  }, [isDark]);

  const handleSyncSheet = useCallback(async () => {
    setSyncState((prev) => ({ ...prev, isSyncing: true, error: null }));
    try {
      const records = await fetchGoogleSheetCsv(GOOGLE_SHEET_GVIZ_URL);
      setRawRecords(records);
      setSyncState({
        source: 'google-sheet',
        sourceLabel: 'Live Google Sheet',
        lastSyncedAt: new Date().toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        isSyncing: false,
        error: null,
        rowCount: records.length,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to read Google Sheet via gviz endpoint.';
      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        error: `${message} Showing ${prev.sourceLabel}.`,
      }));
    }
  }, []);

  // Attempt live Google Sheet sync on initial mount
  useEffect(() => {
    void handleSyncSheet();
  }, [handleSyncSheet]);

  const handleUploadCsv = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        const parsed = parseEmployeeCsv(text);
        setRawRecords(parsed);
        setFilters(DEFAULT_FILTERS);
        setSyncState({
          source: 'csv-upload',
          sourceLabel: `Uploaded CSV (${file.name})`,
          lastSyncedAt: new Date().toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          isSyncing: false,
          error: null,
          rowCount: parsed.length,
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to parse uploaded CSV file.';
        setSyncState((prev) => ({
          ...prev,
          error: `CSV Upload Error (${file.name}): ${message}`,
        }));
      }
    };
    reader.onerror = () => {
      setSyncState((prev) => ({
        ...prev,
        error: `Could not read file "${file.name}". Please verify it is a valid UTF-8 CSV.`,
      }));
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Score entire dataset against dataset job-level medians for peer pay comparisons
  const levelMedians = useMemo(() => computeLevelMedians(rawRecords), [rawRecords]);
  const scoredRecords = useMemo(
    () => scoreEmployees(rawRecords, levelMedians),
    [rawRecords, levelMedians]
  );

  const filterOptions = useMemo(() => {
    const unique = (arr: string[]) =>
      Array.from(new Set(arr)).filter(Boolean).sort((a, b) => a.localeCompare(b));
    return {
      departments: unique(rawRecords.map((r) => r.Department)),
      locations: unique(rawRecords.map((r) => r.Location)),
      employmentTypes: unique(rawRecords.map((r) => r.EmploymentType)),
      genders: unique(rawRecords.map((r) => r.Gender)),
    };
  }, [rawRecords]);

  const filteredEmployees = useMemo(
    () => filterEmployees(scoredRecords, filters),
    [scoredRecords, filters]
  );

  const hasActiveFilters =
    filters.department !== 'All' ||
    filters.location !== 'All' ||
    filters.employmentType !== 'All' ||
    filters.gender !== 'All' ||
    filters.attrition !== 'All';

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <header className="bg-white dark:bg-[#111113] border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <ShellEmblem />
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-zinc-950 dark:text-white whitespace-nowrap truncate">
              Shell People Analytics
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => void handleSyncSheet()}
              disabled={syncState.isSyncing}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-[#FFC800] text-[#0A0A0B] hover:bg-[#eab700] disabled:opacity-70 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${syncState.isSyncing ? 'animate-spin' : ''}`}
              />
              <span>{syncState.isSyncing ? 'Syncing...' : 'Sync Sheet'}</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleUploadCsv}
              className="hidden"
              aria-label="Upload employee CSV file"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Upload CSV</span>
              <span className="sm:hidden">CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4 text-[#FFC800]" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-5">
        {/* Clear Error Banner if Google Sheet cannot be read or CSV fails */}
        {syncState.error && (
          <div
            role="alert"
            className="bg-orange-50 dark:bg-orange-950/35 border border-[#F58220]/60 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertTriangle className="w-4 h-4 text-[#F58220] shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 leading-snug">
                <span className="font-semibold">Sheet Read Notice: </span>
                <span className="text-zinc-700 dark:text-zinc-300">{syncState.error}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={() => void handleSyncSheet()}
                className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap cursor-pointer"
              >
                Retry Sync
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#F58220] text-white hover:bg-[#df7318] transition-colors whitespace-nowrap cursor-pointer"
              >
                Upload CSV
              </button>
              <button
                type="button"
                onClick={() => setSyncState((prev) => ({ ...prev, error: null }))}
                aria-label="Dismiss notice"
                className="p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Shared Filters Bar */}
        <section
          aria-label="Workforce filters"
          className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                Workforce Filters
              </span>
              <span aria-hidden="true">·</span>
              <span>{syncState.sourceLabel}</span>
              {syncState.lastSyncedAt && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">Updated {syncState.lastSyncedAt}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono-num text-zinc-600 dark:text-zinc-400">
                Showing {filteredEmployees.length} of {rawRecords.length}
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#D9480F] dark:text-[#FFC800] hover:underline whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <div>
              <label
                htmlFor="filter-department"
                className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1"
              >
                Department
              </label>
              <select
                id="filter-department"
                value={filters.department}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, department: e.target.value }))
                }
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#FFC800]"
              >
                <option value="All">All Departments</option>
                {filterOptions.departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-location"
                className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1"
              >
                UK Location
              </label>
              <select
                id="filter-location"
                value={filters.location}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, location: e.target.value }))
                }
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#FFC800]"
              >
                <option value="All">All Locations</option>
                {filterOptions.locations.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-employment-type"
                className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1"
              >
                Employment Type
              </label>
              <select
                id="filter-employment-type"
                value={filters.employmentType}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, employmentType: e.target.value }))
                }
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#FFC800]"
              >
                <option value="All">All Types</option>
                {filterOptions.employmentTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-gender"
                className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1"
              >
                Gender
              </label>
              <select
                id="filter-gender"
                value={filters.gender}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, gender: e.target.value }))
                }
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#FFC800]"
              >
                <option value="All">All Genders</option>
                {filterOptions.genders.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-attrition"
                className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1"
              >
                Attrition Status
              </label>
              <select
                id="filter-attrition"
                value={filters.attrition}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    attrition: e.target.value as FilterState['attrition'],
                  }))
                }
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#FFC800]"
              >
                <option value="All">All (Active &amp; Exited)</option>
                <option value="No">Active Only (No Attrition)</option>
                <option value="Yes">Exited Only (Attrition = Yes)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Three Tabs Navigation */}
        <div className="border-b border-zinc-200 dark:border-zinc-800">
          <nav
            role="tablist"
            aria-label="Analytics views"
            className="flex items-center gap-1 sm:gap-2 overflow-x-auto"
          >
            {(
              [
                { id: 'overview', label: 'Overview' },
                { id: 'deep-dive', label: 'Deep Dive' },
                { id: 'insights', label: 'Insights & Watchlist' },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-4 py-2.5 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    isActive
                      ? 'text-zinc-950 dark:text-white'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#FFC800]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Active Tab Viewport */}
        <div role="tabpanel">
          {activeTab === 'overview' && (
            <OverviewTab
              employees={filteredEmployees}
              isDark={isDark}
              onResetFilters={resetFilters}
            />
          )}
          {activeTab === 'deep-dive' && (
            <DeepDiveTab
              employees={filteredEmployees}
              isDark={isDark}
              onResetFilters={resetFilters}
            />
          )}
          {activeTab === 'insights' && (
            <InsightsTab
              employees={filteredEmployees}
              levelMedians={levelMedians}
              onResetFilters={resetFilters}
            />
          )}
        </div>
      </main>
    </div>
  );
}
