export type ImportEmployeeErrorDetail = {
  line: number;
  matricule: string;
  reason: string;
};

export type ImportEmployeesReport = {
  total: number;
  /** Nouveaux comptes invités */
  created: number;
  /** Collaborateurs existants identifiés par matricule, fiche mise à jour */
  updated: number;
  errors: number;
  errorDetails: ImportEmployeeErrorDetail[];
};

/** Événements SSE pendant un import asynchrone */
export type ImportProgressEvent =
  | { kind: 'parsing' }
  | { kind: 'start'; total: number; sourceTotal: number }
  | {
      kind: 'progress';
      processed: number;
      total: number;
      created: number;
      updated: number;
      errors: number;
    }
  | { kind: 'done'; report: ImportEmployeesReport }
  | { kind: 'error'; message: string };

/** Types MIME souvent envoyés par les navigateurs / Excel pour un import valide. */
export const IMPORT_ALLOWED_MIMES = [
  'text/csv',
  'text/plain',
  'application/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
] as const;

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
