export type ExtractedPayslipInfo = {
  matricule?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  periodMonth?: number;
  periodYear?: number;
  confidence: number;
  /** Faux si la lecture PDF (pdf-parse) a échoué. */
  pdfReadable: boolean;
};
