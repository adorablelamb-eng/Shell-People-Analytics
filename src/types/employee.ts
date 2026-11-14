export type AttritionStatus = 'Yes' | 'No';

export type RiskTier = 'High' | 'Medium' | 'Low';

export interface RiskDriver {
  label: string;
  points: number;
}

export interface EmployeeRecord {
  EmployeeID: string;
  FirstName: string;
  LastName: string;
  FullName: string;
  Gender: string;
  Age: number;
  MaritalStatus: string;
  Department: string;
  JobTitle: string;
  JobLevel: number;
  EmploymentType: string;
  Location: string;
  HireDate: string;
  HireYear: number;
  YearsAtCompany: number;
  YearsInCurrentRole: number;
  YearsSinceLastPromotion: number;
  YearsWithCurrManager: number;
  Education: string;
  DistanceFromHome_km: number;
  BusinessTravel: string;
  MonthlyIncome_GBP: number;
  Attrition: AttritionStatus;
}

export interface ScoredEmployee extends EmployeeRecord {
  riskScore: number;
  riskTier: RiskTier;
  riskDrivers: RiskDriver[];
}

export interface FilterState {
  department: string;
  location: string;
  employmentType: string;
  gender: string;
  attrition: 'All' | 'No' | 'Yes';
}

export type DashboardTab = 'overview' | 'deep-dive' | 'insights';

export type DataSourceType = 'google-sheet' | 'csv-upload' | 'embedded-snapshot';

export interface DataSyncState {
  source: DataSourceType;
  sourceLabel: string;
  lastSyncedAt: string | null;
  isSyncing: boolean;
  error: string | null;
  rowCount: number;
}
