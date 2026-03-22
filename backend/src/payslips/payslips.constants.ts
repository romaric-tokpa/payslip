export const PAYSLIP_AUDIT = {
  UPLOADED: 'PAYSLIP_UPLOADED',
  DELETED: 'PAYSLIP_DELETED',
  /** Première prise en compte du bulletin par le titulaire (PATCH …/read). */
  READ: 'PAYSLIP_READ',
} as const;

/** Messages stables pour le rapport bulk (mapping côté confirm). */
export const PAYSLIP_BULK_USER_MESSAGES = {
  STORAGE_FAILED: 'Échec de stockage — veuillez réessayer',
  PERSIST_FAILED: 'Erreur de sauvegarde — le fichier a été annulé',
} as const;
