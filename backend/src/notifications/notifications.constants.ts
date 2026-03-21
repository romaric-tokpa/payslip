/** Marqueur `Session.deviceInfo` pour les jetons FCM (schéma inchangé). */
export const FCM_SESSION_DEVICE_MARKER = 'FCM_TOKEN';

/** Expiration lointaine : la session FCM n’est pas un refresh JWT. */
export const FCM_SESSION_EXPIRES_AT = new Date('2099-12-31T23:59:59.999Z');

export const NOTIFICATION_TYPES = {
  NEW_PAYSLIP: 'NEW_PAYSLIP',
  MANUAL: 'MANUAL',
  PUSH: 'PUSH',
} as const;

export const FRENCH_MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const;

export function frenchMonthName(month1to12: number): string {
  if (month1to12 < 1 || month1to12 > 12) {
    return String(month1to12);
  }
  return FRENCH_MONTH_NAMES[month1to12 - 1];
}
