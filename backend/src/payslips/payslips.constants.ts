export const PAYSLIP_AUDIT = {
  UPLOADED: 'PAYSLIP_UPLOADED',
  DELETED: 'PAYSLIP_DELETED',
  /** Première prise en compte du bulletin par le titulaire (PATCH …/read). */
  READ: 'PAYSLIP_READ',
  /** Accusé de réception électronique (POST …/sign). */
  SIGNED: 'PAYSLIP_SIGNED',
} as const;

export const PAYSLIP_SIGNATURE_AUDIT = {
  REMINDER_SENT: 'SIGNATURE_REMINDER_SENT',
} as const;

/** Messages stables pour le rapport bulk (mapping côté confirm). */
export const PAYSLIP_BULK_USER_MESSAGES = {
  STORAGE_FAILED: 'Échec de stockage — veuillez réessayer',
  PERSIST_FAILED: 'Erreur de sauvegarde — le fichier a été annulé',
} as const;
