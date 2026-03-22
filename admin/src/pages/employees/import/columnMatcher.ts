/**
 * Normalise un libellé de colonne pour comparaison « fuzzy » :
 * minuscules, sans accents, puis uniquement [a-z0-9].
 */
export function compactForMatch(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

export type MappingTargetId =
  | 'matricule'
  | 'prenom'
  | 'nom'
  | 'email'
  | 'direction'
  | 'departement'
  | 'service'
  | 'poste'
  | 'nomComplet'
  | 'contractType'
  | 'contractEndDate'
  | 'entryDate'

const ALIAS_PHRASES: Record<MappingTargetId, readonly string[]> = {
  matricule: [
    'matricule',
    'mat',
    'n employe',
    'no employe',
    'numero employe',
    'employee id',
    'employeeid',
    'id employe',
    'idemploye',
    'code',
    'num',
  ],
  prenom: [
    'prenom',
    'prénom',
    'first name',
    'firstname',
    'prenoms',
    'givenname',
  ],
  nom: [
    'nom',
    'last name',
    'lastname',
    'nom famille',
    'nom de famille',
    'nomfamille',
    'surname',
    'family name',
    'name',
  ],
  email: [
    'email',
    'e mail',
    'mail',
    'adresse email',
    'adressemail',
    'courriel',
    'mel',
  ],
  direction: [
    'direction',
    'dir',
    'axe',
    'branche',
    'macro direction',
  ],
  departement: [
    'departement',
    'département',
    'dept',
    'division',
    'department',
    'pole',
    'pôle',
  ],
  service: [
    'service',
    'unite',
    'unité',
    'equipe',
    'équipe',
    'cellule',
    'pool',
    'squad',
    'org service',
    'team',
  ],
  poste: [
    'poste',
    'fonction',
    'position',
    'titre',
    'job',
    'emploi',
    'intitule poste',
    'intitule',
    'job title',
  ],
  nomComplet: [
    'nom complet',
    'nomprenom',
    'nom prenom',
    'full name',
    'fullname',
    'collaborateur',
  ],
  contractType: [
    'type contrat',
    'type_contrat',
    'type de contrat',
    'contract type',
    'contrat',
    'nature contrat',
    'nature du contrat',
  ],
  contractEndDate: [
    'fin contrat',
    'date fin',
    'date de fin',
    'date fin contrat',
    'fin de contrat',
    'contract end',
    'end date',
    'echeance',
    'échéance',
    'fin cdd',
    'date echeance',
    'date échéance',
    'expiration',
  ],
  entryDate: [
    'date entree',
    "date d'entree",
    "date d'entrée",
    'date embauche',
    'entry date',
    'hire date',
    'start date',
    'date debut',
    'date début',
    'debut',
    'début',
    'embauche',
  ],
}

const ALIAS_COMPACT: Record<MappingTargetId, readonly string[]> = {
  matricule: ALIAS_PHRASES.matricule.map((p) => compactForMatch(p)),
  prenom: ALIAS_PHRASES.prenom.map((p) => compactForMatch(p)),
  nom: ALIAS_PHRASES.nom.map((p) => compactForMatch(p)),
  email: ALIAS_PHRASES.email.map((p) => compactForMatch(p)),
  direction: ALIAS_PHRASES.direction.map((p) => compactForMatch(p)),
  departement: ALIAS_PHRASES.departement.map((p) => compactForMatch(p)),
  service: ALIAS_PHRASES.service.map((p) => compactForMatch(p)),
  poste: ALIAS_PHRASES.poste.map((p) => compactForMatch(p)),
  nomComplet: ALIAS_PHRASES.nomComplet.map((p) => compactForMatch(p)),
  contractType: ALIAS_PHRASES.contractType.map((p) => compactForMatch(p)),
  contractEndDate: ALIAS_PHRASES.contractEndDate.map((p) => compactForMatch(p)),
  entryDate: ALIAS_PHRASES.entryDate.map((p) => compactForMatch(p)),
}

function scoreHeaderForTarget(
  headerCompact: string,
  target: MappingTargetId,
): number {
  const aliases = ALIAS_COMPACT[target]
  let best = 0
  for (const a of aliases) {
    if (a.length === 0) continue
    if (headerCompact === a) {
      best = Math.max(best, 100 + a.length)
      continue
    }
    if (a.length >= 5 && headerCompact.includes(a)) {
      best = Math.max(best, 60 + a.length)
      continue
    }
    if (a.length >= 4 && headerCompact.startsWith(a)) {
      best = Math.max(best, 45 + a.length)
    }
  }
  return best
}

/** Ordre de préférence pour l’attribution (évite qu’un en-tête « mange » plusieurs cibles). */
const ASSIGN_ORDER: MappingTargetId[] = [
  'matricule',
  'email',
  'nomComplet',
  'prenom',
  'nom',
  'direction',
  'departement',
  'service',
  'poste',
  'contractType',
  'contractEndDate',
  'entryDate',
]

export type SuggestedColumnMappings = Record<MappingTargetId, string | undefined>

/**
 * Propose un mapping colonne → champ métier (une colonne source ne sert qu’à un seul champ).
 */
export function suggestColumnMappings(headers: string[]): SuggestedColumnMappings {
  const used = new Set<string>()
  const out: SuggestedColumnMappings = {
    matricule: undefined,
    prenom: undefined,
    nom: undefined,
    email: undefined,
    direction: undefined,
    departement: undefined,
    service: undefined,
    poste: undefined,
    nomComplet: undefined,
    contractType: undefined,
    contractEndDate: undefined,
    entryDate: undefined,
  }

  const candidates = headers.map((h) => ({
    raw: h,
    c: compactForMatch(h),
  }))

  for (const target of ASSIGN_ORDER) {
    let bestHeader: string | undefined
    let bestScore = 0
    for (const { raw, c } of candidates) {
      if (used.has(raw) || c.length === 0) continue
      if (target === 'nom' && out.nomComplet === raw) continue
      const sc = scoreHeaderForTarget(c, target)
      if (sc > bestScore) {
        bestScore = sc
        bestHeader = raw
      }
    }
    if (bestHeader !== undefined && bestScore >= 40) {
      out[target] = bestHeader
      used.add(bestHeader)
    }
  }

  if (out.nomComplet) {
    if (out.prenom === out.nomComplet) {
      out.prenom = undefined
    }
    if (out.nom === out.nomComplet) {
      out.nom = undefined
    }
  }

  return out
}
