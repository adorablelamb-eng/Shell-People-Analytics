import {
  EmployeeRecord,
  FilterState,
  RiskDriver,
  RiskTier,
  ScoredEmployee,
} from '../types/employee';

export interface ScoringRuleItem {
  factor: string;
  condition: string;
  maxPoints: number;
  rationale: string;
}

export const FLIGHT_RISK_RULES: ScoringRuleItem[] = [
  {
    factor: 'Promotion Stagnation',
    condition: '≥5 yrs since promo (+25) · 3–4 yrs (+15) · 1–2 yrs (+5)',
    maxPoints: 25,
    rationale: 'Extended time without progression is a primary driver of mid-tenure exits.',
  },
  {
    factor: 'Travel Frequency',
    condition: 'Travel_Frequently (+20) · Travel_Rarely (+8)',
    maxPoints: 20,
    rationale: 'Frequent site/client travel accelerates burnout and work-life friction.',
  },
  {
    factor: 'Pay vs. Level Peer Median',
    condition: '>10% below level median (+15) · below median (+8)',
    maxPoints: 15,
    rationale: 'Compensation lag relative to UK peer benchmarks creates external pull risk.',
  },
  {
    factor: 'Commute Distance',
    condition: '≥30 km from site (+15) · 20–29 km (+8)',
    maxPoints: 15,
    rationale: 'Long daily commutes raise attrition propensity across operational sites.',
  },
  {
    factor: 'Tenure Vulnerability',
    condition: '≤1 yr onboarding (+15) · ≥8 yrs in same role & ≥4 yrs no promo (+10)',
    maxPoints: 15,
    rationale: 'Both early onboarding gaps and entrenched role plateaus elevate exit odds.',
  },
  {
    factor: 'Manager & Contract Stability',
    condition: '≤1 yr with manager (+10) · Part-Time/Contract (+10)',
    maxPoints: 20,
    rationale: 'New manager transitions and contingent arrangements increase turnover sensitivity.',
  },
];

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

export function computeLevelMedians(records: EmployeeRecord[]): Record<number, number> {
  const byLevel: Record<number, number[]> = {};
  for (const r of records) {
    if (!byLevel[r.JobLevel]) byLevel[r.JobLevel] = [];
    byLevel[r.JobLevel].push(r.MonthlyIncome_GBP);
  }
  const medians: Record<number, number> = {};
  for (const [lvl, incomes] of Object.entries(byLevel)) {
    medians[Number(lvl)] = median(incomes);
  }
  return medians;
}

export function scoreEmployees(
  records: EmployeeRecord[],
  levelMedians: Record<number, number>
): ScoredEmployee[] {
  return records.map((emp) => {
    const drivers: RiskDriver[] = [];

    // 1. Promotion stagnation
    if (emp.YearsSinceLastPromotion >= 5) {
      drivers.push({ label: `${emp.YearsSinceLastPromotion}y since promo`, points: 25 });
    } else if (emp.YearsSinceLastPromotion >= 3) {
      drivers.push({ label: `${emp.YearsSinceLastPromotion}y since promo`, points: 15 });
    } else if (emp.YearsSinceLastPromotion >= 1) {
      drivers.push({ label: `${emp.YearsSinceLastPromotion}y since promo`, points: 5 });
    }

    // 2. Travel burden
    if (emp.BusinessTravel === 'Travel_Frequently') {
      drivers.push({ label: 'Frequent travel', points: 20 });
    } else if (emp.BusinessTravel === 'Travel_Rarely') {
      drivers.push({ label: 'Occasional travel', points: 8 });
    }

    // 3. Pay vs Level median
    const peerMedian = levelMedians[emp.JobLevel] ?? 0;
    if (peerMedian > 0) {
      if (emp.MonthlyIncome_GBP < peerMedian * 0.9) {
        drivers.push({ label: `>10% below L${emp.JobLevel} median`, points: 15 });
      } else if (emp.MonthlyIncome_GBP < peerMedian) {
        drivers.push({ label: `Below L${emp.JobLevel} median`, points: 8 });
      }
    }

    // 4. Commute distance
    if (emp.DistanceFromHome_km >= 30) {
      drivers.push({ label: `${emp.DistanceFromHome_km} km commute`, points: 15 });
    } else if (emp.DistanceFromHome_km >= 20) {
      drivers.push({ label: `${emp.DistanceFromHome_km} km commute`, points: 8 });
    }

    // 5. Tenure vulnerability
    if (emp.YearsAtCompany <= 1) {
      drivers.push({ label: `Early tenure (${emp.YearsAtCompany}y)`, points: 15 });
    } else if (emp.YearsInCurrentRole >= 8 && emp.YearsSinceLastPromotion >= 4) {
      drivers.push({ label: `${emp.YearsInCurrentRole}y in role`, points: 10 });
    }

    // 6. Manager & contract stability
    if (emp.YearsWithCurrManager <= 1) {
      drivers.push({ label: `New manager (${emp.YearsWithCurrManager}y)`, points: 10 });
    }
    if (emp.EmploymentType !== 'Full-Time') {
      drivers.push({ label: emp.EmploymentType, points: 10 });
    }

    const rawScore = drivers.reduce((sum, d) => sum + d.points, 0);
    const riskScore = Math.min(100, rawScore);
    const riskTier: RiskTier =
      riskScore >= 60 ? 'High' : riskScore >= 35 ? 'Medium' : 'Low';

    drivers.sort((a, b) => b.points - a.points);

    return {
      ...emp,
      riskScore,
      riskTier,
      riskDrivers: drivers,
    };
  });
}

export function filterEmployees(
  records: ScoredEmployee[],
  filters: FilterState
): ScoredEmployee[] {
  return records.filter((r) => {
    if (filters.department !== 'All' && r.Department !== filters.department) return false;
    if (filters.location !== 'All' && r.Location !== filters.location) return false;
    if (filters.employmentType !== 'All' && r.EmploymentType !== filters.employmentType) return false;
    if (filters.gender !== 'All' && r.Gender !== filters.gender) return false;
    if (filters.attrition !== 'All' && r.Attrition !== filters.attrition) return false;
    return true;
  });
}

export interface GroupStats {
  label: string;
  total: number;
  active: number;
  leavers: number;
  attritionRate: number;
  avgIncome: number;
}

export function groupByField(
  records: ScoredEmployee[],
  getter: (r: ScoredEmployee) => string,
  orderedLabels?: string[]
): GroupStats[] {
  const map = new Map<string, ScoredEmployee[]>();
  for (const r of records) {
    const key = getter(r);
    const list = map.get(key);
    if (list) list.push(r);
    else map.set(key, [r]);
  }

  const keys = orderedLabels
    ? orderedLabels.filter((k) => map.has(k))
    : Array.from(map.keys()).sort((a, b) => {
        const lenDiff = (map.get(b)?.length ?? 0) - (map.get(a)?.length ?? 0);
        return lenDiff !== 0 ? lenDiff : a.localeCompare(b);
      });

  return keys.map((label) => {
    const items = map.get(label) ?? [];
    const leavers = items.filter((i) => i.Attrition === 'Yes').length;
    const active = items.length - leavers;
    return {
      label,
      total: items.length,
      active,
      leavers,
      attritionRate: items.length > 0 ? (leavers / items.length) * 100 : 0,
      avgIncome: mean(items.map((i) => i.MonthlyIncome_GBP)),
    };
  });
}

export interface InsightItem {
  id: string;
  category: string;
  headline: string;
  detail: string;
  severity: 'high' | 'medium' | 'positive';
  metricValue: string;
}

export interface RecommendedAction {
  id: string;
  priority: 'Immediate' | 'Near-Term' | 'Monitor';
  title: string;
  targetScope: string;
  rationale: string;
  impactedCount: number;
}

export function generateInsightsAndActions(
  filtered: ScoredEmployee[],
  levelMedians: Record<number, number>
): { insights: InsightItem[]; actions: RecommendedAction[] } {
  if (filtered.length === 0) {
    return { insights: [], actions: [] };
  }

  const total = filtered.length;
  const leavers = filtered.filter((e) => e.Attrition === 'Yes');
  const active = filtered.filter((e) => e.Attrition === 'No');
  const overallAttrRate = (leavers.length / total) * 100;

  const insights: InsightItem[] = [];
  const actions: RecommendedAction[] = [];

  // 1. Department hotspot
  const deptStats = groupByField(filtered, (e) => e.Department).filter((d) => d.total >= 2);
  if (deptStats.length > 0) {
    const topDept = [...deptStats].sort((a, b) => b.attritionRate - a.attritionRate)[0];
    const lowestDept = [...deptStats].sort((a, b) => a.attritionRate - b.attritionRate)[0];
    insights.push({
      id: 'dept-hotspot',
      category: 'Department Attrition',
      headline: `${topDept.label} leads attrition at ${topDept.attritionRate.toFixed(1)}%`,
      detail: `${topDept.leavers} of ${topDept.total} staff exited in ${topDept.label}, compared to ${overallAttrRate.toFixed(
        1
      )}% across the filtered workforce${
        lowestDept.label !== topDept.label
          ? ` and ${lowestDept.attritionRate.toFixed(1)}% in ${lowestDept.label}.`
          : '.'
      }`,
      severity: topDept.attritionRate > overallAttrRate * 1.25 ? 'high' : 'medium',
      metricValue: `${topDept.attritionRate.toFixed(1)}%`,
    });

    if (topDept.leavers > 0) {
      actions.push({
        id: 'action-dept',
        priority: topDept.attritionRate >= 20 ? 'Immediate' : 'Near-Term',
        title: `Run targeted retention & exit review in ${topDept.label}`,
        targetScope: `${topDept.label} (${topDept.active} active)`,
        rationale: `Attrition is ${(topDept.attritionRate - overallAttrRate).toFixed(
          1
        )} percentage points above the filtered baseline; review manager span, workload, and role progression.`,
        impactedCount: topDept.active,
      });
    }
  }

  // 2. Location hotspot
  const locStats = groupByField(filtered, (e) => e.Location).filter((l) => l.total >= 2);
  if (locStats.length > 0) {
    const topLoc = [...locStats].sort((a, b) => b.attritionRate - a.attritionRate)[0];
    insights.push({
      id: 'loc-hotspot',
      category: 'UK Site Concentration',
      headline: `${topLoc.label} records highest site turnover (${topLoc.attritionRate.toFixed(1)}%)`,
      detail: `${topLoc.leavers} exits out of ${topLoc.total} employees based in ${topLoc.label}, with average monthly pay of £${Math.round(
        topLoc.avgIncome
      ).toLocaleString('en-GB')}.`,
      severity: topLoc.attritionRate >= 20 ? 'high' : 'medium',
      metricValue: `${topLoc.leavers}/${topLoc.total}`,
    });
  }

  // 3. Early tenure vs promotion stagnation
  const earlyTenure = filtered.filter((e) => e.YearsAtCompany <= 2);
  const earlyAttrRate =
    earlyTenure.length > 0
      ? (earlyTenure.filter((e) => e.Attrition === 'Yes').length / earlyTenure.length) * 100
      : 0;
  const stalledActive = active.filter((e) => e.YearsSinceLastPromotion >= 5);

  insights.push({
    id: 'tenure-promo',
    category: 'Tenure & Progression',
    headline:
      earlyAttrRate > overallAttrRate
        ? `Early-tenure attrition reaches ${earlyAttrRate.toFixed(1)}% within first 2 years`
        : `${stalledActive.length} active staff have waited 5+ years for promotion`,
    detail: `Employees with ≤2 years tenure show ${earlyAttrRate.toFixed(
      1
    )}% attrition (${earlyTenure.filter((e) => e.Attrition === 'Yes').length}/${
      earlyTenure.length
    }). Meanwhile, ${stalledActive.length} active employees (${
      active.length > 0 ? ((stalledActive.length / active.length) * 100).toFixed(1) : '0.0'
    }%) have ≥5 years since their last promotion.`,
    severity: earlyAttrRate > overallAttrRate * 1.2 || stalledActive.length >= 15 ? 'high' : 'medium',
    metricValue: earlyAttrRate > overallAttrRate ? `${earlyAttrRate.toFixed(1)}%` : `${stalledActive.length}`,
  });

  if (earlyTenure.filter((e) => e.Attrition === 'No').length > 0 && earlyAttrRate > overallAttrRate) {
    const earlyActiveCount = earlyTenure.filter((e) => e.Attrition === 'No').length;
    actions.push({
      id: 'action-onboarding',
      priority: 'Immediate',
      title: 'Strengthen 90-day & 18-month onboarding check-ins',
      targetScope: `≤2 yrs tenure (${earlyActiveCount} active)`,
      rationale: `First-24-month attrition (${earlyAttrRate.toFixed(
        1
      )}%) outpaces the overall rate (${overallAttrRate.toFixed(
        1
      )}%). Pair new hires with senior site mentors and clarify 12-month role milestones.`,
      impactedCount: earlyActiveCount,
    });
  }

  if (stalledActive.length > 0) {
    actions.push({
      id: 'action-promo',
      priority: stalledActive.length >= 20 ? 'Immediate' : 'Near-Term',
      title: 'Audit career progression for 5+ year promotion-stalled staff',
      targetScope: `Active staff ≥5y since promotion`,
      rationale: `${stalledActive.length} active employees have not progressed in 5+ years, accounting for a large share of elevated flight-risk scores.`,
      impactedCount: stalledActive.length,
    });
  }

  // 4. Travel & commute strain
  const freqTravel = filtered.filter((e) => e.BusinessTravel === 'Travel_Frequently');
  const nonTravel = filtered.filter((e) => e.BusinessTravel === 'Non-Travel');
  const freqAttr =
    freqTravel.length > 0
      ? (freqTravel.filter((e) => e.Attrition === 'Yes').length / freqTravel.length) * 100
      : 0;
  const nonAttr =
    nonTravel.length > 0
      ? (nonTravel.filter((e) => e.Attrition === 'Yes').length / nonTravel.length) * 100
      : 0;
  const longCommuteHighTravel = active.filter(
    (e) => e.BusinessTravel === 'Travel_Frequently' && e.DistanceFromHome_km >= 25
  );

  insights.push({
    id: 'travel-commute',
    category: 'Travel & Commute Strain',
    headline:
      freqAttr > nonAttr
        ? `Frequent travellers exit at ${freqAttr.toFixed(1)}% vs ${nonAttr.toFixed(1)}% non-travel`
        : `Travel workload balanced (${freqAttr.toFixed(1)}% frequent vs ${nonAttr.toFixed(1)}% non-travel)`,
    detail: `${freqTravel.length} employees travel frequently (${
      freqTravel.filter((e) => e.Attrition === 'Yes').length
    } exited). ${longCommuteHighTravel.length} active staff combine frequent travel with a ≥25 km commute.`,
    severity: freqAttr > nonAttr + 4 ? 'high' : 'medium',
    metricValue: `${freqAttr.toFixed(1)}%`,
  });

  if (longCommuteHighTravel.length > 0) {
    actions.push({
      id: 'action-travel',
      priority: 'Near-Term',
      title: 'Introduce travel rotation & hybrid flexibility for long-commute staff',
      targetScope: `Active frequent travellers ≥25 km away`,
      rationale: `${longCommuteHighTravel.length} active employees face compounding travel fatigue and long site commutes.`,
      impactedCount: longCommuteHighTravel.length,
    });
  }

  // 5. Pay parity & below-median exposure
  const femaleAvg = mean(filtered.filter((e) => e.Gender === 'Female').map((e) => e.MonthlyIncome_GBP));
  const maleAvg = mean(filtered.filter((e) => e.Gender === 'Male').map((e) => e.MonthlyIncome_GBP));
  const payGapPct = maleAvg > 0 ? ((femaleAvg - maleAvg) / maleAvg) * 100 : 0;
  const underpaidActive = active.filter(
    (e) => (levelMedians[e.JobLevel] ?? 0) > 0 && e.MonthlyIncome_GBP < levelMedians[e.JobLevel] * 0.9
  );

  insights.push({
    id: 'pay-parity',
    category: 'Compensation & Equity',
    headline:
      femaleAvg > 0 && maleAvg > 0
        ? `Gender pay delta is ${payGapPct >= 0 ? '+' : ''}${payGapPct.toFixed(1)}% (Female vs Male avg)`
        : `Average monthly pay is £${Math.round(mean(filtered.map((e) => e.MonthlyIncome_GBP))).toLocaleString('en-GB')}`,
    detail: `${
      femaleAvg > 0 && maleAvg > 0
        ? `Female avg £${Math.round(femaleAvg).toLocaleString('en-GB')}/mo vs Male avg £${Math.round(
            maleAvg
          ).toLocaleString('en-GB')}/mo. `
        : ''
    }${underpaidActive.length} active employees sit >10% below their job-level peer median.`,
    severity: underpaidActive.length >= 15 || Math.abs(payGapPct) >= 8 ? 'medium' : 'positive',
    metricValue: `${underpaidActive.length} under`,
  });

  if (underpaidActive.length > 0) {
    actions.push({
      id: 'action-comp',
      priority: underpaidActive.length >= 15 ? 'Immediate' : 'Monitor',
      title: 'Review compensation bands for below-median active performers',
      targetScope: `>10% below Job Level median`,
      rationale: `${underpaidActive.length} active employees earn at least 10% under their Job Level peer median, raising external poaching risk.`,
      impactedCount: underpaidActive.length,
    });
  }

  // 6. Employment type check
  const nonFt = filtered.filter((e) => e.EmploymentType !== 'Full-Time');
  const ft = filtered.filter((e) => e.EmploymentType === 'Full-Time');
  const nonFtAttr =
    nonFt.length > 0 ? (nonFt.filter((e) => e.Attrition === 'Yes').length / nonFt.length) * 100 : 0;
  const ftAttr =
    ft.length > 0 ? (ft.filter((e) => e.Attrition === 'Yes').length / ft.length) * 100 : 0;

  if (nonFt.length > 0) {
    insights.push({
      id: 'emp-type',
      category: 'Workforce Mix',
      headline: `Non-full-time staff (${nonFt.length}) show ${nonFtAttr.toFixed(1)}% attrition vs ${ftAttr.toFixed(
        1
      )}% full-time`,
      detail: `Part-Time and Contract staff make up ${((nonFt.length / total) * 100).toFixed(
        1
      )}% of the filtered workforce with ${nonFt.filter((e) => e.Attrition === 'Yes').length} exits recorded.`,
      severity: nonFtAttr > ftAttr + 5 ? 'high' : 'positive',
      metricValue: `${nonFtAttr.toFixed(1)}%`,
    });
  }

  return { insights, actions };
}
