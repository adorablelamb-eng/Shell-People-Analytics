import { EmployeeRecord } from '../types/employee';

const REQUIRED_COLUMNS = [
  'EmployeeID',
  'FirstName',
  'LastName',
  'Gender',
  'Age',
  'Department',
  'JobTitle',
  'JobLevel',
  'EmploymentType',
  'Location',
  'HireDate',
  'YearsAtCompany',
  'YearsSinceLastPromotion',
  'MonthlyIncome_GBP',
  'Attrition',
];

/**
 * RFC-4180 compliant CSV line parser supporting quoted fields with commas & escaped quotes.
 */
function parseCsvRows(rawCsv: string): string[][] {
  const text = rawCsv.replace(/^\uFEFF/, '').trim();
  if (!text) return [];

  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(current.trim());
        current = '';
      } else if (char === '\r' && next === '\n') {
        row.push(current.trim());
        rows.push(row);
        row = [];
        current = '';
        i++;
      } else if (char === '\n' || char === '\r') {
        row.push(current.trim());
        rows.push(row);
        row = [];
        current = '';
      } else {
        current += char;
      }
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell !== ''));
}

function toNumber(val: string | undefined, fallback = 0): number {
  if (!val) return fallback;
  const cleaned = val.replace(/[£,\s]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseEmployeeCsv(rawCsv: string): EmployeeRecord[] {
  const trimmed = rawCsv.trim();
  if (!trimmed) {
    throw new Error('CSV content is empty.');
  }

  // Guard against Google Sign-In or error HTML pages returned by gviz
  if (
    /^<!doctype\s+html/i.test(trimmed) ||
    /^<html/i.test(trimmed) ||
    trimmed.includes('accounts.google.com')
  ) {
    throw new Error(
      'Google Sheets returned an HTML sign-in page instead of CSV. Make sure the sheet is shared as "Anyone with the link can view".'
    );
  }

  const rows = parseCsvRows(trimmed);
  if (rows.length < 2) {
    throw new Error('CSV must contain a header row and at least one employee record.');
  }

  const headers = rows[0].map((h) => h.trim());
  const missingCols = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
  if (missingCols.length > 0) {
    throw new Error(
      `Missing expected column(s): ${missingCols.slice(0, 4).join(', ')}${
        missingCols.length > 4 ? ` (+${missingCols.length - 4} more)` : ''
      }.`
    );
  }

  const colIndex = new Map<string, number>();
  headers.forEach((h, idx) => colIndex.set(h, idx));
  const get = (cells: string[], col: string): string => {
    const idx = colIndex.get(col);
    return idx !== undefined ? (cells[idx] ?? '').trim() : '';
  };

  const records: EmployeeRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const id = get(cells, 'EmployeeID');
    if (!id) continue;

    const firstName = get(cells, 'FirstName');
    const lastName = get(cells, 'LastName');
    const hireDate = get(cells, 'HireDate');
    const parsedYear = Number(hireDate.slice(0, 4));
    const attritionRaw = get(cells, 'Attrition').toLowerCase();

    records.push({
      EmployeeID: id,
      FirstName: firstName,
      LastName: lastName,
      FullName: `${firstName} ${lastName}`.trim() || id,
      Gender: get(cells, 'Gender') || 'Unspecified',
      Age: toNumber(get(cells, 'Age'), 0),
      MaritalStatus: get(cells, 'MaritalStatus') || 'Unspecified',
      Department: get(cells, 'Department') || 'Unassigned',
      JobTitle: get(cells, 'JobTitle') || 'Unspecified',
      JobLevel: toNumber(get(cells, 'JobLevel'), 1),
      EmploymentType: get(cells, 'EmploymentType') || 'Full-Time',
      Location: get(cells, 'Location') || 'Unspecified',
      HireDate: hireDate,
      HireYear: Number.isFinite(parsedYear) && parsedYear > 1970 ? parsedYear : 2020,
      YearsAtCompany: toNumber(get(cells, 'YearsAtCompany'), 0),
      YearsInCurrentRole: toNumber(get(cells, 'YearsInCurrentRole'), 0),
      YearsSinceLastPromotion: toNumber(get(cells, 'YearsSinceLastPromotion'), 0),
      YearsWithCurrManager: toNumber(get(cells, 'YearsWithCurrManager'), 0),
      Education: get(cells, 'Education') || 'Unspecified',
      DistanceFromHome_km: toNumber(get(cells, 'DistanceFromHome_km'), 0),
      BusinessTravel: get(cells, 'BusinessTravel') || 'Non-Travel',
      MonthlyIncome_GBP: toNumber(get(cells, 'MonthlyIncome_GBP'), 0),
      Attrition: attritionRaw === 'yes' || attritionRaw === 'true' || attritionRaw === '1' ? 'Yes' : 'No',
    });
  }

  if (records.length === 0) {
    throw new Error('No valid employee rows were parsed from the CSV.');
  }

  return records;
}

export async function fetchGoogleSheetCsv(url: string): Promise<EmployeeRecord[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          `Access denied (HTTP ${response.status}). The Google Sheet is private or restricted — share it as "Anyone with the link can view" or use Upload CSV.`
        );
      }
      if (response.status === 404) {
        throw new Error(
          'Google Sheet or tab GID not found (HTTP 404). Verify the spreadsheet ID and gid=350240712.'
        );
      }
      throw new Error(`Google Sheets returned HTTP ${response.status} ${response.statusText}.`);
    }

    const csvText = await response.text();
    return parseEmployeeCsv(csvText);
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        'Request to Google Sheets timed out after 10 seconds. Check your connection or use Upload CSV.'
      );
    }
    if (err instanceof TypeError) {
      throw new Error(
        'Could not reach Google Sheets public CSV endpoint (network/CORS blocked or sheet is not publicly accessible). Share sheet publicly or use Upload CSV.'
      );
    }
    throw err instanceof Error
      ? err
      : new Error('Unknown error while reading Google Sheet.');
  } finally {
    clearTimeout(timeout);
  }
}

export function exportEmployeesToCsv(records: EmployeeRecord[]): void {
  const headers = [
    'EmployeeID',
    'FirstName',
    'LastName',
    'Gender',
    'Age',
    'MaritalStatus',
    'Department',
    'JobTitle',
    'JobLevel',
    'EmploymentType',
    'Location',
    'HireDate',
    'YearsAtCompany',
    'YearsInCurrentRole',
    'YearsSinceLastPromotion',
    'YearsWithCurrManager',
    'Education',
    'DistanceFromHome_km',
    'BusinessTravel',
    'MonthlyIncome_GBP',
    'Attrition',
  ];

  const escapeCell = (value: string | number) => {
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.join(','),
    ...records.map((r) =>
      [
        r.EmployeeID,
        r.FirstName,
        r.LastName,
        r.Gender,
        r.Age,
        r.MaritalStatus,
        r.Department,
        r.JobTitle,
        r.JobLevel,
        r.EmploymentType,
        r.Location,
        r.HireDate,
        r.YearsAtCompany,
        r.YearsInCurrentRole,
        r.YearsSinceLastPromotion,
        r.YearsWithCurrManager,
        r.Education,
        r.DistanceFromHome_km,
        r.BusinessTravel,
        r.MonthlyIncome_GBP,
        r.Attrition,
      ]
        .map(escapeCell)
        .join(',')
    ),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `shell-uk-people-analytics-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
