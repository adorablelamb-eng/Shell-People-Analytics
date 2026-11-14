import { useEffect, useMemo, useState } from 'react';
import type { ChartConfiguration } from 'chart.js/auto';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search } from 'lucide-react';
import { ScoredEmployee } from '../types/employee';
import { groupByField, mean, median } from '../utils/analytics';
import { exportEmployeesToCsv } from '../utils/csv';
import { ChartCanvas, getChartTheme } from './ChartCanvas';
import { KpiCard } from './KpiCard';

interface DeepDiveTabProps {
  employees: ScoredEmployee[];
  isDark: boolean;
  onResetFilters: () => void;
}

type SortKey =
  | 'EmployeeID'
  | 'FullName'
  | 'Department'
  | 'JobLevel'
  | 'Location'
  | 'EmploymentType'
  | 'YearsAtCompany'
  | 'YearsSinceLastPromotion'
  | 'MonthlyIncome_GBP'
  | 'riskScore'
  | 'Attrition';

const PAGE_SIZE = 15;

export function DeepDiveTab({
  employees,
  isDark,
  onResetFilters,
}: DeepDiveTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('riskScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [employees, searchQuery, sortKey, sortDir]);

  const kpis = useMemo(() => {
    const total = employees.length;
    const tenures = employees.map((e) => e.YearsAtCompany);
    const avgTenure = mean(tenures);
    const medTenure = median(tenures);

    const femaleCount = employees.filter((e) => e.Gender === 'Female').length;
    const femaleShare = total > 0 ? (femaleCount / total) * 100 : 0;

    const ptCount = employees.filter((e) => e.EmploymentType === 'Part-Time').length;
    const contractCount = employees.filter((e) => e.EmploymentType === 'Contract').length;
    const nonFtCount = ptCount + contractCount;
    const nonFtShare = total > 0 ? (nonFtCount / total) * 100 : 0;

    const avgSincePromo = mean(employees.map((e) => e.YearsSinceLastPromotion));
    const stalledCount = employees.filter((e) => e.YearsSinceLastPromotion >= 5).length;
    const stalledPct = total > 0 ? (stalledCount / total) * 100 : 0;

    const activeEmployees = employees.filter((e) => e.Attrition === 'No');
    const highRiskActive = activeEmployees.filter((e) => e.riskScore >= 60).length;
    const highRiskAll = employees.filter((e) => e.riskScore >= 60).length;
    const highRiskBase = activeEmployees.length > 0 ? activeEmployees.length : total;
    const highRiskCount = activeEmployees.length > 0 ? highRiskActive : highRiskAll;
    const highRiskPct = highRiskBase > 0 ? (highRiskCount / highRiskBase) * 100 : 0;

    return {
      avgTenure,
      medTenure,
      femaleCount,
      femaleShare,
      ptCount,
      contractCount,
      nonFtShare,
      avgSincePromo,
      stalledPct,
      highRiskCount,
      highRiskPct,
      showingActiveRisk: activeEmployees.length > 0,
    };
  }, [employees]);

  const theme = useMemo(() => getChartTheme(isDark), [isDark]);

  // 1. Age Bands & Attrition
  const ageConfig = useMemo<ChartConfiguration>(() => {
    const bands = ['<25', '25–34', '35–44', '45–54', '55+'];
    const bandFor = (age: number) => {
      if (age < 25) return '<25';
      if (age <= 34) return '25–34';
      if (age <= 44) return '35–44';
      if (age <= 54) return '45–54';
      return '55+';
    };
    const stats = groupByField(employees, (e) => bandFor(e.Age), bands);

    return {
      type: 'bar',
      data: {
        labels: bands,
        datasets: [
          {
            type: 'line',
            label: 'Attrition Rate (%)',
            data: stats.map((s) => Number(s.attritionRate.toFixed(1))),
            borderColor: theme.shellOrange,
            backgroundColor: theme.shellOrange,
            borderWidth: 2.5,
            pointRadius: 4,
            yAxisID: 'y1',
            order: 1,
          },
          {
            type: 'bar',
            label: 'Headcount',
            data: stats.map((s) => s.total),
            backgroundColor: theme.shellYellow,
            borderRadius: 4,
            barPercentage: 0.6,
            yAxisID: 'y',
            order: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              color: theme.textColor,
              boxWidth: 12,
              font: { family: theme.fontSans, size: 11 },
            },
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            borderColor: theme.shellYellow,
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: theme.textColor, font: { family: theme.fontMono, size: 11 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.mutedText,
              font: { family: theme.fontMono, size: 11 },
              precision: 0,
            },
          },
          y1: {
            position: 'right',
            beginAtZero: true,
            suggestedMax: 45,
            grid: { display: false },
            ticks: {
              color: theme.shellOrange,
              font: { family: theme.fontMono, size: 11 },
              callback: (v) => `${v}%`,
            },
          },
        },
      },
    };
  }, [employees, theme]);

  // 2. Tenure Bands & Attrition
  const tenureConfig = useMemo<ChartConfiguration>(() => {
    const bands = ['0–1 yr', '2–5 yrs', '6–10 yrs', '11–20 yrs', '21+ yrs'];
    const bandFor = (yrs: number) => {
      if (yrs <= 1) return '0–1 yr';
      if (yrs <= 5) return '2–5 yrs';
      if (yrs <= 10) return '6–10 yrs';
      if (yrs <= 20) return '11–20 yrs';
      return '21+ yrs';
    };
    const stats = groupByField(employees, (e) => bandFor(e.YearsAtCompany), bands);

    return {
      type: 'bar',
      data: {
        labels: bands,
        datasets: [
          {
            type: 'line',
            label: 'Attrition Rate (%)',
            data: stats.map((s) => Number(s.attritionRate.toFixed(1))),
            borderColor: theme.shellOrange,
            backgroundColor: theme.shellOrange,
            borderWidth: 2.5,
            pointRadius: 4,
            yAxisID: 'y1',
            order: 1,
          },
          {
            type: 'bar',
            label: 'Headcount',
            data: stats.map((s) => s.total),
            backgroundColor: isDark ? '#E4E4E7' : '#18181B',
            borderRadius: 4,
            barPercentage: 0.6,
            yAxisID: 'y',
            order: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              color: theme.textColor,
              boxWidth: 12,
              font: { family: theme.fontSans, size: 11 },
            },
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            borderColor: theme.shellYellow,
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: theme.textColor, font: { family: theme.fontMono, size: 11 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.mutedText,
              font: { family: theme.fontMono, size: 11 },
              precision: 0,
            },
          },
          y1: {
            position: 'right',
            beginAtZero: true,
            suggestedMax: 45,
            grid: { display: false },
            ticks: {
              color: theme.shellOrange,
              font: { family: theme.fontMono, size: 11 },
              callback: (v) => `${v}%`,
            },
          },
        },
      },
    };
  }, [employees, isDark, theme]);

  // 3. Income by Job Level
  const incomeByLevelConfig = useMemo<ChartConfiguration>(() => {
    const levels = [1, 2, 3, 4, 5];
    const activeAvg = levels.map((lvl) =>
      Math.round(
        mean(
          employees
            .filter((e) => e.JobLevel === lvl && e.Attrition === 'No')
            .map((e) => e.MonthlyIncome_GBP)
        )
      )
    );
    const leaverAvg = levels.map((lvl) =>
      Math.round(
        mean(
          employees
            .filter((e) => e.JobLevel === lvl && e.Attrition === 'Yes')
            .map((e) => e.MonthlyIncome_GBP)
        )
      )
    );

    return {
      type: 'bar',
      data: {
        labels: levels.map((l) => `Level ${l}`),
        datasets: [
          {
            label: 'Active Avg (£)',
            data: activeAvg,
            backgroundColor: theme.shellYellow,
            borderRadius: 4,
          },
          {
            label: 'Leavers Avg (£)',
            data: leaverAvg,
            backgroundColor: theme.shellOrange,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              color: theme.textColor,
              boxWidth: 12,
              font: { family: theme.fontSans, size: 11 },
            },
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            borderColor: theme.shellYellow,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: £${Number(ctx.raw).toLocaleString('en-GB')}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: theme.textColor, font: { family: theme.fontSans, size: 11 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.mutedText,
              font: { family: theme.fontMono, size: 11 },
              callback: (v) => `£${Number(v).toLocaleString('en-GB')}`,
            },
          },
        },
      },
    };
  }, [employees, theme]);

  // 4. Income by Department
  const incomeByDeptConfig = useMemo<ChartConfiguration>(() => {
    const stats = groupByField(employees, (e) => e.Department).sort(
      (a, b) => b.avgIncome - a.avgIncome
    );

    return {
      type: 'bar',
      data: {
        labels: stats.map((s) => s.label),
        datasets: [
          {
            label: 'Avg Monthly Income (£)',
            data: stats.map((s) => Math.round(s.avgIncome)),
            backgroundColor: isDark ? '#E4E4E7' : '#18181B',
            hoverBackgroundColor: theme.shellYellow,
            borderRadius: 4,
            barPercentage: 0.68,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            borderColor: theme.shellYellow,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => ` Avg Pay: £${Number(ctx.raw).toLocaleString('en-GB')}/mo`,
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.mutedText,
              font: { family: theme.fontMono, size: 11 },
              callback: (v) => `£${Number(v).toLocaleString('en-GB')}`,
            },
          },
          y: {
            grid: { display: false },
            ticks: { color: theme.textColor, font: { family: theme.fontSans, size: 11 } },
          },
        },
      },
    };
  }, [employees, isDark, theme]);

  // 5. Education Distribution & Attrition
  const educationConfig = useMemo<ChartConfiguration>(() => {
    const order = ['Below College', 'College', "Bachelor's", "Master's", 'Doctorate'];
    const stats = groupByField(employees, (e) => e.Education, order);

    return {
      type: 'bar',
      data: {
        labels: stats.map((s) => s.label),
        datasets: [
          {
            label: 'Active',
            data: stats.map((s) => s.active),
            backgroundColor: theme.shellYellow,
            borderRadius: 4,
          },
          {
            label: 'Attrition',
            data: stats.map((s) => s.leavers),
            backgroundColor: theme.shellOrange,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              color: theme.textColor,
              boxWidth: 12,
              font: { family: theme.fontSans, size: 11 },
            },
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            borderColor: theme.shellYellow,
            borderWidth: 1,
            callbacks: {
              afterBody: (items) => {
                const row = stats[items[0]?.dataIndex ?? 0];
                return row ? `Attrition Rate: ${row.attritionRate.toFixed(1)}%` : '';
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: theme.textColor, font: { family: theme.fontSans, size: 11 } },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.mutedText,
              font: { family: theme.fontMono, size: 11 },
              precision: 0,
            },
          },
        },
      },
    };
  }, [employees, theme]);

  // 6. Business Travel & Attrition
  const travelConfig = useMemo<ChartConfiguration>(() => {
    const order = ['Non-Travel', 'Travel_Rarely', 'Travel_Frequently'];
    const displayLabel = (k: string) =>
      k === 'Travel_Rarely'
        ? 'Travel Rarely'
        : k === 'Travel_Frequently'
          ? 'Travel Frequently'
          : 'Non-Travel';
    const stats = groupByField(employees, (e) => e.BusinessTravel, order);

    return {
      type: 'bar',
      data: {
        labels: stats.map((s) => displayLabel(s.label)),
        datasets: [
          {
            type: 'line',
            label: 'Attrition Rate (%)',
            data: stats.map((s) => Number(s.attritionRate.toFixed(1))),
            borderColor: theme.shellOrange,
            backgroundColor: theme.shellOrange,
            borderWidth: 2.5,
            pointRadius: 5,
            yAxisID: 'y1',
            order: 1,
          },
          {
            type: 'bar',
            label: 'Headcount',
            data: stats.map((s) => s.total),
            backgroundColor: isDark ? '#E4E4E7' : '#18181B',
            borderRadius: 4,
            barPercentage: 0.55,
            yAxisID: 'y',
            order: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              color: theme.textColor,
              boxWidth: 12,
              font: { family: theme.fontSans, size: 11 },
            },
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            borderColor: theme.shellYellow,
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: theme.textColor, font: { family: theme.fontSans, size: 11 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.mutedText,
              font: { family: theme.fontMono, size: 11 },
              precision: 0,
            },
          },
          y1: {
            position: 'right',
            beginAtZero: true,
            suggestedMax: 45,
            grid: { display: false },
            ticks: {
              color: theme.shellOrange,
              font: { family: theme.fontMono, size: 11 },
              callback: (v) => `${v}%`,
            },
          },
        },
      },
    };
  }, [employees, isDark, theme]);

  // 7. Income vs Tenure Scatter
  const scatterConfig = useMemo<ChartConfiguration>(() => {
    const activePts = employees
      .filter((e) => e.Attrition === 'No')
      .map((e) => ({
        x: e.YearsAtCompany,
        y: e.MonthlyIncome_GBP,
        meta: e,
      }));
    const leaverPts = employees
      .filter((e) => e.Attrition === 'Yes')
      .map((e) => ({
        x: e.YearsAtCompany,
        y: e.MonthlyIncome_GBP,
        meta: e,
      }));

    return {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Active',
            data: activePts,
            backgroundColor: isDark
              ? 'rgba(255, 200, 0, 0.72)'
              : 'rgba(24, 24, 27, 0.65)',
            pointRadius: 4.5,
            pointHoverRadius: 7,
          },
          {
            label: 'Attrition (Left)',
            data: leaverPts,
            backgroundColor: 'rgba(245, 130, 32, 0.9)',
            pointRadius: 5.5,
            pointHoverRadius: 8,
            pointStyle: 'triangle',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              color: theme.textColor,
              boxWidth: 12,
              font: { family: theme.fontSans, size: 11 },
            },
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            borderColor: theme.shellYellow,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => {
                const raw = ctx.raw as { x: number; y: number; meta?: ScoredEmployee };
                const emp = raw.meta;
                if (!emp) return '';
                return `${emp.FullName} (${emp.EmployeeID}) · L${emp.JobLevel} ${emp.JobTitle} · ${emp.YearsAtCompany}y · £${emp.MonthlyIncome_GBP.toLocaleString('en-GB')}`;
              },
            },
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Years at Company',
              color: theme.mutedText,
              font: { family: theme.fontSans, size: 11 },
            },
            beginAtZero: true,
            grid: { color: theme.gridColor },
            ticks: { color: theme.mutedText, font: { family: theme.fontMono, size: 11 } },
          },
          y: {
            title: {
              display: true,
              text: 'Monthly Income (£)',
              color: theme.mutedText,
              font: { family: theme.fontSans, size: 11 },
            },
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.mutedText,
              font: { family: theme.fontMono, size: 11 },
              callback: (v) => `£${Number(v).toLocaleString('en-GB')}`,
            },
          },
        },
      },
    };
  }, [employees, isDark, theme]);

  // Searchable & Sortable Table
  const searchedAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matched = q
      ? employees.filter(
          (e) =>
            e.EmployeeID.toLowerCase().includes(q) ||
            e.FullName.toLowerCase().includes(q) ||
            e.JobTitle.toLowerCase().includes(q) ||
            e.Department.toLowerCase().includes(q) ||
            e.Location.toLowerCase().includes(q)
        )
      : employees;

    const sorted = [...matched].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      let cmp = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        cmp = valA - valB;
      } else {
        cmp = String(valA).localeCompare(String(valB));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [employees, searchQuery, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(searchedAndSorted.length / PAGE_SIZE));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return searchedAndSorted.slice(start, start + PAGE_SIZE);
  }, [searchedAndSorted, page]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(
        key === 'MonthlyIncome_GBP' ||
          key === 'riskScore' ||
          key === 'YearsAtCompany' ||
          key === 'JobLevel'
          ? 'desc'
          : 'asc'
      );
    }
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-[#F58220]" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-[#F58220]" />
    );
  };

  if (employees.length === 0) {
    return (
      <div className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 rounded-xl p-10 text-center">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          No employees match the current filters
        </h3>
        <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          Reset or widen the shared filters above to inspect tenure, pay equity, and employee records.
        </p>
        <button
          type="button"
          onClick={onResetFilters}
          className="mt-4 px-4 py-2 text-sm font-medium rounded-lg bg-[#FFC800] text-[#0A0A0B] hover:bg-[#e6b400] transition-colors cursor-pointer"
        >
          Reset Filters
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 5 Deep Dive KPIs */}
      <section aria-label="Deep dive key performance indicators">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <KpiCard
            label="Average Tenure"
            value={`${kpis.avgTenure.toFixed(1)} yrs`}
            subtext={`Median ${kpis.medTenure.toFixed(1)} yrs`}
            highlight="neutral"
          />
          <KpiCard
            label="Female Share"
            value={`${kpis.femaleShare.toFixed(1)}%`}
            subtext={`${kpis.femaleCount} female employees`}
            highlight="yellow"
          />
          <KpiCard
            label="Non-Full-Time Share"
            value={`${kpis.nonFtShare.toFixed(1)}%`}
            subtext={`${kpis.ptCount} PT · ${kpis.contractCount} Contract`}
            highlight="neutral"
          />
          <KpiCard
            label="Years Since Promotion"
            value={`${kpis.avgSincePromo.toFixed(1)} yrs`}
            subtext={`${kpis.stalledPct.toFixed(1)}% waiting ≥5 yrs`}
            highlight="orange"
          />
          <KpiCard
            label="High Flight-Risk"
            value={kpis.highRiskCount.toLocaleString('en-GB')}
            subtext={
              kpis.showingActiveRisk
                ? `${kpis.highRiskPct.toFixed(1)}% of active (score ≥60)`
                : `${kpis.highRiskPct.toFixed(1)}% of filtered (score ≥60)`
            }
            highlight="orange"
          />
        </div>
      </section>

      {/* Age & Tenure Bands */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <article className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-semibold text-zinc-950 dark:text-white">
            Age Bands &amp; Attrition Rate
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            Headcount volume alongside cohort attrition percentage
          </p>
          <ChartCanvas
            config={ageConfig}
            heightClass="h-64 sm:h-72"
            ariaLabel="Combo chart of age bands and attrition rate"
          />
        </article>

        <article className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-semibold text-zinc-950 dark:text-white">
            Tenure Bands &amp; Attrition Rate
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            Retention curve across company tenure cohorts
          </p>
          <ChartCanvas
            config={tenureConfig}
            heightClass="h-64 sm:h-72"
            ariaLabel="Combo chart of tenure bands and attrition rate"
          />
        </article>
      </div>

      {/* Income by Level & Department */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <article className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-semibold text-zinc-950 dark:text-white">
            Monthly Income by Job Level
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            Active staff vs. exited employees across Levels 1–5
          </p>
          <ChartCanvas
            config={incomeByLevelConfig}
            heightClass="h-64 sm:h-72"
            ariaLabel="Bar chart of average monthly income by job level"
          />
        </article>

        <article className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-semibold text-zinc-950 dark:text-white">
            Average Monthly Income by Department
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            Mean monthly compensation in GBP across functions
          </p>
          <ChartCanvas
            config={incomeByDeptConfig}
            heightClass="h-64 sm:h-72"
            ariaLabel="Horizontal bar chart of average monthly income by department"
          />
        </article>
      </div>

      {/* Education, Business Travel & Scatter */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        <article className="lg:col-span-4 bg-white dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-semibold text-zinc-950 dark:text-white">
            Education &amp; Attrition
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            Qualification distribution by retention status
          </p>
          <ChartCanvas
            config={educationConfig}
            heightClass="h-64"
            ariaLabel="Stacked bar chart of education level and attrition"
          />
        </article>

        <article className="lg:col-span-4 bg-white dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-semibold text-zinc-950 dark:text-white">
            Business Travel &amp; Attrition
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            Turnover sensitivity by travel frequency
          </p>
          <ChartCanvas
            config={travelConfig}
            heightClass="h-64"
            ariaLabel="Combo chart of business travel frequency and attrition rate"
          />
        </article>

        <article className="lg:col-span-4 bg-white dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-semibold text-zinc-950 dark:text-white">
            Income vs. Tenure
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            Individual pay distribution by years at Shell
          </p>
          <ChartCanvas
            config={scatterConfig}
            heightClass="h-64"
            ariaLabel="Scatter plot of monthly income versus years at company"
          />
        </article>
      </div>

      {/* Searchable, Sortable Employee Table */}
      <section
        aria-label="Employee directory table"
        className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden"
      >
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-zinc-950 dark:text-white">
              Employee Directory &amp; Risk Ledger
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
              Showing {searchedAndSorted.length} matching records · Click any column header to sort
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:flex-none sm:w-64">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ID, name, role, site..."
                aria-label="Search employee records"
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#FFC800]"
              />
            </div>
            <button
              type="button"
              onClick={() => exportEmployeesToCsv(searchedAndSorted)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                <th className="py-2.5 px-3 sm:px-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('EmployeeID')}
                    className="inline-flex items-center gap-1 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                  >
                    ID {renderSortIcon('EmployeeID')}
                  </button>
                </th>
                <th className="py-2.5 px-3 sm:px-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('FullName')}
                    className="inline-flex items-center gap-1 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                  >
                    Employee {renderSortIcon('FullName')}
                  </button>
                </th>
                <th className="py-2.5 px-3 sm:px-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('Department')}
                    className="inline-flex items-center gap-1 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                  >
                    Department {renderSortIcon('Department')}
                  </button>
                </th>
                <th className="py-2.5 px-3 sm:px-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('JobLevel')}
                    className="inline-flex items-center gap-1 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                  >
                    Role &amp; Level {renderSortIcon('JobLevel')}
                  </button>
                </th>
                <th className="py-2.5 px-3 sm:px-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('Location')}
                    className="inline-flex items-center gap-1 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                  >
                    Location {renderSortIcon('Location')}
                  </button>
                </th>
                <th className="py-2.5 px-3 sm:px-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('EmploymentType')}
                    className="inline-flex items-center gap-1 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                  >
                    Type {renderSortIcon('EmploymentType')}
                  </button>
                </th>
                <th className="py-2.5 px-3 sm:px-4 whitespace-nowrap text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('YearsAtCompany')}
                    className="inline-flex items-center justify-end gap-1 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                  >
                    Tenure {renderSortIcon('YearsAtCompany')}
                  </button>
                </th>
                <th className="py-2.5 px-3 sm:px-4 whitespace-nowrap text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('YearsSinceLastPromotion')}
                    className="inline-flex items-center justify-end gap-1 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                  >
                    Promo Gap {renderSortIcon('YearsSinceLastPromotion')}
                  </button>
                </th>
                <th className="py-2.5 px-3 sm:px-4 whitespace-nowrap text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('MonthlyIncome_GBP')}
                    className="inline-flex items-center justify-end gap-1 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                  >
                    Income {renderSortIcon('MonthlyIncome_GBP')}
                  </button>
                </th>
                <th className="py-2.5 px-3 sm:px-4 whitespace-nowrap text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('riskScore')}
                    className="inline-flex items-center justify-end gap-1 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                  >
                    Flight Risk {renderSortIcon('riskScore')}
                  </button>
                </th>
                <th className="py-2.5 px-3 sm:px-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('Attrition')}
                    className="inline-flex items-center gap-1 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                  >
                    Status {renderSortIcon('Attrition')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs sm:text-[13px]">
              {pagedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="py-8 text-center text-zinc-500 dark:text-zinc-400"
                  >
                    No employees match "{searchQuery}".
                  </td>
                </tr>
              ) : (
                pagedRows.map((emp) => {
                  const riskColor =
                    emp.riskTier === 'High'
                      ? 'text-[#D9480F] dark:text-[#FF9248] font-semibold'
                      : emp.riskTier === 'Medium'
                        ? 'text-amber-700 dark:text-[#FFC800] font-medium'
                        : 'text-zinc-600 dark:text-zinc-400';

                  return (
                    <tr
                      key={emp.EmployeeID}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors"
                    >
                      <td className="py-2.5 px-3 sm:px-4 font-mono-num text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                        {emp.EmployeeID}
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 whitespace-nowrap">
                        <div className="font-medium text-zinc-950 dark:text-zinc-100">
                          {emp.FullName}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {emp.Gender} · Age {emp.Age}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-zinc-700 dark:text-zinc-300 max-w-[180px] truncate">
                        {emp.Department}
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 whitespace-nowrap">
                        <span className="text-zinc-900 dark:text-zinc-100">
                          {emp.JobTitle}
                        </span>
                        <span className="ml-1.5 text-[11px] font-mono-num text-zinc-500 dark:text-zinc-400">
                          L{emp.JobLevel}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                        {emp.Location}
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                        {emp.EmploymentType}
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-right font-mono-num text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
                        {emp.YearsAtCompany}y
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-right font-mono-num text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                        {emp.YearsSinceLastPromotion}y
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-right font-mono-num font-medium text-zinc-950 dark:text-white whitespace-nowrap">
                        £{emp.MonthlyIncome_GBP.toLocaleString('en-GB')}
                      </td>
                      <td
                        className={`py-2.5 px-3 sm:px-4 text-right font-mono-num whitespace-nowrap ${riskColor}`}
                        title={emp.riskDrivers.map((d) => `${d.label} (+${d.points})`).join(' · ')}
                      >
                        {emp.riskScore} · {emp.riskTier}
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 whitespace-nowrap">
                        {emp.Attrition === 'Yes' ? (
                          <span className="text-[#D9480F] dark:text-[#FF9248] font-medium">
                            Left
                          </span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                            Active
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-4 sm:px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4 text-xs text-zinc-600 dark:text-zinc-400">
          <span className="tabular-nums">
            Page {page} of {totalPages} · {searchedAndSorted.length} records
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
