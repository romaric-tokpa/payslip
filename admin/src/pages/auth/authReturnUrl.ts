/** Évite les redirections ouvertes (open redirect). */
export function safeReturnUrl(raw: string | null): string | undefined {
  if (raw == null || raw === '') {
    return undefined
  }
  const t = raw.trim()
  if (!t.startsWith('/') || t.startsWith('//')) {
    return undefined
  }
  return t
}
