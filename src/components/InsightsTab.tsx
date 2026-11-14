import { useMemo } from 'react';
import { ScoredEmployee } from '../types/employee';
import {
  FLIGHT_RISK_RULES,
  generateInsightsAndActions,
} from '../utils/analytics';

interface InsightsTabProps {
  employees: ScoredEmployee[];
  levelMedians: Record<number, number>;
  onResetFilters: () => void;
}

export function InsightsTab({
  employees,
  levelMedians,
  onResetFilters,
}: InsightsTabProps) {
  const { insights, actions } = useMemo(
    () => generateInsightsAndActions(employees, levelMedians),
    [employees, levelMedians]
  );

  const watchlist = useMemo(() => {
    const active = employees.filter((e) => e.Attrition === 'No');
    const pool = active.length > 0 ? active : employees;
    const isActiveOnly = active.length > 0;

    const top10 = [...pool]
      .sort((a, b) => {
        if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
        if (b.YearsSinceLastPromotion !== a.YearsSinceLastPromotion) {
          return b.YearsSinceLastPromotion - a.YearsSinceLastPromotion;
        }
        return a.MonthlyIncome_GBP - b.MonthlyIncome_GBP;
      })
      .slice(0, 10);

    return { top10, isActiveOnly };
  }, [employees]);

  if (employees.length === 0) {
    return (
      <div className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 rounded-xl p-10 text-center">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          No records available for insights
        </h3>
        <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          Reset or adjust the shared filters above to compute retention findings and the top-10 flight-risk watchlist.
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
      {/* Auto-Generated Findings */}
      <section aria-label="Auto-generated workforce findings">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-3">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-zinc-950 dark:text-white">
              Automated Workforce Findings
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              Live diagnostics recalculated from the {employees.length} filtered employee records
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {insights.map((item) => {
            const severityColor =
              item.severity === 'high'
                ? 'text-[#D9480F] dark:text-[#FF9248]'
                : item.severity === 'medium'
                  ? 'text-amber-700 dark:text-[#FFC800]'
                  : 'text-emerald-700 dark:text-emerald-400';

            return (
              <article
                key={item.id}
                className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {item.category}
                    </span>
                    <span className={`text-sm font-bold font-mono-num ${severityColor}`}>
                      {item.metricValue}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-[15px] font-semibold text-zinc-950 dark:text-white leading-snug">
                    {item.headline}
                  </h3>
                  <p className="text-xs sm:text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {item.detail}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Top-10 Flight-Risk Watchlist */}
      <section
        aria-label="Top 10 flight-risk watchlist"
        className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden"
      >
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-zinc-950 dark:text-white">
              Top-10 Flight-Risk Watchlist
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              {watchlist.isActiveOnly
                ? 'Highest-risk active employees ranked by transparent 100-point retention scoring'
                : 'Attrition filter is set to exited employees — displaying top-10 exited profiles by retrospective risk score'}
            </p>
          </div>
          <span className="text-xs font-mono-num text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
            High ≥60 · Medium 35–59 · Low &lt;35
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                <th className="py-2.5 px-3 sm:px-4 whitespace-nowrap">Rank</th>
                <th className="py-2.5 px-3 sm:px-4 whitespace-nowrap">Employee</th>
                <th className="py-2.5 px-3 sm:px-4 whitespace-nowrap">Department &amp; Site</th>
                <th className="py-2.5 px-3 sm:px-4 whitespace-nowrap text-right">Tenure / Promo</th>
                <th className="py-2.5 px-3 sm:px-4 whitespace-nowrap text-right">Income</th>
                <th className="py-2.5 px-3 sm:px-4 whitespace-nowrap text-right">Risk Score</th>
                <th className="py-2.5 px-3 sm:px-4">Primary Risk Drivers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs sm:text-[13px]">
              {watchlist.top10.map((emp, idx) => {
                const scoreColor =
                  emp.riskTier === 'High'
                    ? 'text-[#D9480F] dark:text-[#FF9248]'
                    : emp.riskTier === 'Medium'
                      ? 'text-amber-700 dark:text-[#FFC800]'
                      : 'text-zinc-700 dark:text-zinc-300';

                return (
                  <tr
                    key={emp.EmployeeID}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors"
                  >
                    <td className="py-3 px-3 sm:px-4 font-mono-num font-semibold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      #{idx + 1}
                    </td>
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                      <div className="font-medium text-zinc-950 dark:text-white">
                        {emp.FullName}{' '}
                        <span className="font-mono-num text-[11px] text-zinc-500 dark:text-zinc-400">
                          ({emp.EmployeeID})
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {emp.JobTitle} · L{emp.JobLevel} · {emp.EmploymentType}
                      </div>
                    </td>
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                      <div className="text-zinc-800 dark:text-zinc-200">{emp.Department}</div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {emp.Location}
                      </div>
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-right font-mono-num text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                      {emp.YearsAtCompany}y · {emp.YearsSinceLastPromotion}y gap
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-right font-mono-num font-medium text-zinc-950 dark:text-white whitespace-nowrap">
                      £{emp.MonthlyIncome_GBP.toLocaleString('en-GB')}
                    </td>
                    <td className={`py-3 px-3 sm:px-4 text-right font-mono-num font-bold whitespace-nowrap ${scoreColor}`}>
                      {emp.riskScore}/100 ({emp.riskTier})
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-zinc-600 dark:text-zinc-400 min-w-[240px]">
                      {emp.riskDrivers
                        .slice(0, 4)
                        .map((d) => `${d.label} (+${d.points})`)
                        .join(' · ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recommended Actions + Transparent Scoring Rule */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        <section
          aria-label="Recommended HR actions"
          className="lg:col-span-7 bg-white dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5"
        >
          <h2 className="text-base sm:text-lg font-semibold text-zinc-950 dark:text-white">
            Recommended HR Actions
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            Prioritized retention interventions tailored to the filtered cohort
          </p>

          {actions.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 py-4">
              No elevated turnover interventions triggered for this selection. Continue routine manager check-ins.
            </p>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {actions.map((action, index) => {
                const priorityText =
                  action.priority === 'Immediate'
                    ? 'text-[#D9480F] dark:text-[#FF9248]'
                    : action.priority === 'Near-Term'
                      ? 'text-amber-700 dark:text-[#FFC800]'
                      : 'text-zinc-600 dark:text-zinc-400';

                return (
                  <div key={action.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        0{index + 1}. {action.targetScope}
                      </span>
                      <span className={`text-xs font-semibold ${priorityText}`}>
                        {action.priority} · {action.impactedCount} impacted
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                      {action.title}
                    </h3>
                    <p className="text-xs sm:text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {action.rationale}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section
          aria-label="Transparent flight-risk scoring rule"
          className="lg:col-span-5 bg-white dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5"
        >
          <h2 className="text-base sm:text-lg font-semibold text-zinc-950 dark:text-white">
            Transparent Scoring Rule
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            Deterministic 0–100 point model (capped at 100); scores ≥60 trigger High Risk
          </p>

          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {FLIGHT_RISK_RULES.map((rule) => (
              <div key={rule.factor} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs sm:text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                    {rule.factor}
                  </span>
                  <span className="text-xs font-mono-num font-semibold text-[#F58220] whitespace-nowrap">
                    up to +{rule.maxPoints} pts
                  </span>
                </div>
                <div className="text-xs font-mono-num text-zinc-600 dark:text-zinc-300 mt-0.5">
                  {rule.condition}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {rule.rationale}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
