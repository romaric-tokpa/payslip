import type { ExtractedPayslipInfo } from './payslip-pdf-extractor.types';

export type PayslipMatchMethod =
  | 'matricule'
  | 'name'
  | 'filename'
  | 'unmatched';

export type PayslipMatchResult = {
  userId?: string;
  employeeName?: string;
  employeeId?: string | null;
  periodMonth?: number;
  periodYear?: number;
  matchMethod: PayslipMatchMethod;
  confidence: number;
  /** Matricule présent dans le PDF mais sans correspondance en base ; le nom a permis un match. */
  ambiguousMatricule?: boolean;
  /** Collaborateur sorti : pas d’attribution, message pour l’admin. */
  lifecycleWarning?: string;
};

export type PayslipMatchInput = {
  extracted: ExtractedPayslipInfo;
  filename: string;
};

export type PayslipMatchEmployeeRow = {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string | null;
};
