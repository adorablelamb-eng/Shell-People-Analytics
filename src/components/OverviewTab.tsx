import { useMemo } from 'react';
import type { ChartConfiguration } from 'chart.js/auto';
import { ScoredEmployee } from '../types/employee';
import { groupByField, mean, median } from '../utils/analytics';
import { ChartCanvas, getChartTheme } from './ChartCanvas';
import { KpiCard } from './KpiCard';

interface OverviewTabProps {
  employees: ScoredEmployee[];
  isDark: boolean;
  onResetFilters: () => void;
}

export function OverviewTab({
  employees,
  isDark,
  onResetFilters,
}: OverviewTabProps) {
  const kpis = useMemo(() => {
    const headcount = employees.length;
    const leavers = employees.filter((e) => e.Attrition === 'Yes').length;
    const active = headcount - leavers;
    const attritionRate = headcount > 0 ? (leavers / headcount) * 100 : 0;
    const retentionRate = headcount > 0 ? (active / headcount) * 100 : 0;
    const incomes = employees.map((e) => e.MonthlyIncome_GBP);
    const avgIncome = mean(incomes);
    const medIncome = median(incomes);
    const totalPayroll = incomes.reduce((s, v) => s + v, 0);
    const activePayroll = employees
      .filter((e) => e.Attrition === 'No')
      .reduce((s, e) => s + e.MonthlyIncome_GBP, 0);
    const deptCount = new Set(employees.map((e) => e.Department)).size;
    const siteCount = new Set(employees.map((e) => e.Location)).size;

    return {
      headcount,
      leavers,
      active,
      attritionRate,
      retentionRate,
      avgIncome,
      medIncome,
      totalPayroll,
      activePayroll,
      deptCount,
      siteCount,
    };
  }, [employees]);

  const theme = useMemo(() => getChartTheme(isDark), [isDark]);

  // 1. Department Headcount & Attrition
  const deptConfig = useMemo<ChartConfiguration>(() => {
    const stats = groupByField(employees, (e) => e.Department);
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
            barPercentage: 0.72,
          },
          {
            label: 'Attrition (Left)',
            data: stats.map((s) => s.leavers),
            backgroundColor: theme.shellOrange,
            borderRadius: 4,
            barPercentage: 0.72,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              color: theme.textColor,
              boxWidth: 12,
              font: { family: theme.fontSans, size: 12 },
            },
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.shellYellow,
            borderWidth: 1,
            callbacks: {
              afterBody: (items) => {
                const idx = items[0]?.dataIndex ?? 0;
                const row = stats[idx];
                if (!row) return '';
                return `Total: ${row.total} · Attrition: ${row.attritionRate.toFixed(1)}%`;
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.mutedText,
              font: { family: theme.fontMono, size: 11 },
              precision: 0,
            },
          },
          y: {
            stacked: true,
            grid: { display: false },
            ticks: {
              color: theme.textColor,
              font: { family: theme.fontSans, size: 11 },
            },
          },
        },
      },
    };
  }, [employees, theme]);

  // 2. Location Breakdown
  const locationConfig = useMemo<ChartConfiguration>(() => {
    const stats = groupByField(employees, (e) => e.Location);
    return {
      type: 'bar',
      data: {
        labels: stats.map((s) => s.label),
        datasets: [
          {
            label: 'Active',
            data: stats.map((s) => s.active),
            backgroundColor: isDark ? '#E4E4E7' : '#18181B',
            borderRadius: 4,
            barPercentage: 0.65,
          },
          {
            label: 'Attrition (Left)',
            data: stats.map((s) => s.leavers),
            backgroundColor: theme.shellOrange,
            borderRadius: 4,
            barPercentage: 0.65,
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
              font: { family: theme.fontSans, size: 12 },
            },
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.shellYellow,
            borderWidth: 1,
            callbacks: {
              afterBody: (items) => {
                const idx = items[0]?.dataIndex ?? 0;
                const row = stats[idx];
                if (!row) return '';
                return `Site Headcount: ${row.total} · Attrition: ${row.attritionRate.toFixed(1)}%`;
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: {
              color: theme.textColor,
              font: { family: theme.fontSans, size: 11 },
            },
          },
          y: {
            stacked: true,
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
  }, [employees, isDark, theme]);

  // 3. Gender Split
  const genderConfig = useMemo<ChartConfiguration>(() => {
    const stats = groupByField(employees, (e) => e.Gender);
    const palette = [theme.shellYellow, isDark ? '#E4E4E7' : '#18181B', theme.shellOrange];
    return {
      type: 'doughnut',
      data: {
        labels: stats.map((s) => s.label),
        datasets: [
          {
            data: stats.map((s) => s.total),
            backgroundColor: stats.map((_, i) => palette[i % palette.length]),
            borderColor: theme.surfaceBg,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '64%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: theme.textColor,
              padding: 14,
              boxWidth: 12,
              font: { family: theme.fontSans, size: 12 },
            },
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.shellYellow,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => {
                const row = stats[ctx.dataIndex];
                if (!row) return '';
                const pct =
                  employees.length > 0
                    ? ((row.total / employees.length) * 100).toFixed(1)
                    : '0.0';
                return ` ${row.label}: ${row.total} (${pct}%) · Attrition ${row.attritionRate.toFixed(1)}%`;
              },
            },
          },
        },
      },
    };
  }, [employees, isDark, theme]);

  // 4. Employment Type Breakdown
  const empTypeConfig = useMemo<ChartConfiguration>(() => {
    const ordered = ['Full-Time', 'Part-Time', 'Contract'];
    const stats = groupByField(employees, (e) => e.EmploymentType, ordered);
    return {
      type: 'doughnut',
      data: {
        labels: stats.map((s) => s.label),
        datasets: [
          {
            data: stats.map((s) => s.total),
            backgroundColor: [
              isDark ? '#E4E4E7' : '#18181B',
              theme.shellYellow,
              theme.shellOrange,
            ],
            borderColor: theme.surfaceBg,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '64%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: theme.textColor,
              padding: 14,
              boxWidth: 12,
              font: { family: theme.fontSans, size: 12 },
            },
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.shellYellow,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => {
                const row = stats[ctx.dataIndex];
                if (!row) return '';
                const pct =
                  employees.length > 0
                    ? ((row.total / employees.length) * 100).toFixed(1)
                    : '0.0';
                return ` ${row.label}: ${row.total} (${pct}%) · Attrition ${row.attritionRate.toFixed(1)}%`;
              },
            },
          },
        },
      },
    };
  }, [employees, isDark, theme]);

  // 5. Hiring Trend by Hire Year
  const hiringTrendConfig = useMemo<ChartConfiguration>(() => {
    const yearMap = new Map<number, { total: number; leavers: number }>();
    for (const emp of employees) {
      const curr = yearMap.get(emp.HireYear) ?? { total: 0, leavers: 0 };
      curr.total += 1;
      if (emp.Attrition === 'Yes') curr.leavers += 1;
      yearMap.set(emp.HireYear, curr);
    }
    const years = Array.from(yearMap.keys()).sort((a, b) => a - b);

    return {
      type: 'bar',
      data: {
        labels: years.map(String),
        datasets: [
          {
            type: 'line',
            label: 'Total Hires',
            data: years.map((y) => yearMap.get(y)?.total ?? 0),
            borderColor: theme.shellYellow,
            backgroundColor: isDark
              ? 'rgba(255, 200, 0, 0.14)'
              : 'rgba(255, 200, 0, 0.22)',
            borderWidth: 2.5,
            pointRadius: 3,
            pointBackgroundColor: theme.shellYellow,
            tension: 0.25,
            fill: true,
            order: 1,
          },
          {
            type: 'bar',
            label: 'Cohort Exits',
            data: years.map((y) => yearMap.get(y)?.leavers ?? 0),
            backgroundColor: theme.shellOrange,
            borderRadius: 3,
            barPercentage: 0.55,
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
              font: { family: theme.fontSans, size: 12 },
            },
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.shellYellow,
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: theme.mutedText,
              font: { family: theme.fontMono, size: 10 },
              maxRotation: 0,
              autoSkip: true,
            },
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
        },
      },
    };
  }, [employees, isDark, theme]);

  if (employees.length === 0) {
    return (
      <div className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 rounded-xl p-10 text-center">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          No employees match the current filters
        </h3>
        <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          Adjust one or more filters above to view workforce headcount, pay, and hiring trends.
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
      {/* 5 Overview KPIs */}
      <section aria-label="Overview key performance indicators">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <KpiCard
            label="Total Headcount"
            value={kpis.headcount.toLocaleString('en-GB')}
            subtext={`${kpis.deptCount} depts · ${kpis.siteCount} UK sites`}
            highlight="yellow"
          />
          <KpiCard
            label="Attrition Rate"
            value={`${kpis.attritionRate.toFixed(1)}%`}
            subtext={`${kpis.leavers} exited employees`}
            highlight="orange"
          />
          <KpiCard
            label="Active Employees"
            value={kpis.active.toLocaleString('en-GB')}
            subtext={`${kpis.retentionRate.toFixed(1)}% retention`}
            highlight="neutral"
          />
          <KpiCard
            label="Average Income"
            value={`£${Math.round(kpis.avgIncome).toLocaleString('en-GB')}`}
            subtext={`Median £${Math.round(kpis.medIncome).toLocaleString('en-GB')}/mo`}
            highlight="yellow"
          />
          <KpiCard
            label="Monthly Payroll"
            value={`£${Math.round(kpis.totalPayroll).toLocaleString('en-GB')}`}
            subtext={`Active: £${Math.round(kpis.activePayroll).toLocaleString('en-GB')}`}
            highlight="neutral"
          />
        </div>
      </section>

      {/* Primary Charts Row: Department + Location */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <article className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-zinc-950 dark:text-white">
                Headcount &amp; Attrition by Department
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Active workforce vs. exited employees across UK functions
              </p>
            </div>
          </div>
          <ChartCanvas
            config={deptConfig}
            heightClass="h-72 sm:h-80"
            ariaLabel="Bar chart of headcount and attrition by department"
          />
        </article>

        <article className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-zinc-950 dark:text-white">
                Workforce by UK Location
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Regional concentration and attrition across Shell UK hubs
              </p>
            </div>
          </div>
          <ChartCanvas
            config={locationConfig}
            heightClass="h-72 sm:h-80"
            ariaLabel="Bar chart of workforce headcount and attrition by UK location"
          />
        </article>
      </div>

      {/* Secondary Charts Row: Gender + Employment Type + Hiring Trend */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 sm:gap-5">
        <article className="lg:col-span-3 bg-white dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-semibold text-zinc-950 dark:text-white">
            Gender Split
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            Workforce representation
          </p>
          <ChartCanvas
            config={genderConfig}
            heightClass="h-60"
            ariaLabel="Doughnut chart of gender split"
          />
        </article>

        <article className="lg:col-span-3 bg-white dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-semibold text-zinc-950 dark:text-white">
            Employment Type
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            Full-Time, Part-Time &amp; Contract
          </p>
          <ChartCanvas
            config={empTypeConfig}
            heightClass="h-60"
            ariaLabel="Doughnut chart of employment types"
          />
        </article>

        <article className="md:col-span-2 lg:col-span-6 bg-white dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-semibold text-zinc-950 dark:text-white">
            Hiring Trend by Year
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            Annual intake volume overlaid with cohort exits
          </p>
          <ChartCanvas
            config={hiringTrendConfig}
            heightClass="h-60"
            ariaLabel="Line and bar chart of hiring trend by hire year"
          />
        </article>
      </div>
    </div>
  );
}
