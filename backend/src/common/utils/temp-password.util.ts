/**
 * Génère un mot de passe temporaire à partir du prénom et du matricule.
 * Pattern : Prénom-Matricule-Année!
 * Ex : "Awa-EMP002-2026!"
 *
 * Si le prénom ou le matricule est absent, utilise un fallback aléatoire sécurisé.
 */
export function generateTempPassword(
  firstName: string,
  employeeId?: string,
): string {
  const clean = (s: string) =>
    s
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 12);

  const year = new Date().getFullYear();
  const namePart = clean(firstName) || 'User';
  const idRaw = employeeId?.trim() ? clean(employeeId) : '';
  const idPart = idRaw || randomId();

  return `${capitalize(namePart)}-${idPart}-${year}!`;
}

function capitalize(s: string): string {
  if (!s) {
    return 'User';
  }
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
