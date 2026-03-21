export type ImportEmployeeErrorDetail = {
  line: number;
  matricule: string;
  reason: string;
};

export type ImportEmployeesReport = {
  total: number;
  created: number;
  errors: number;
  errorDetails: ImportEmployeeErrorDetail[];
};

export const IMPORT_ALLOWED_MIMES = [
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
] as const;

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
