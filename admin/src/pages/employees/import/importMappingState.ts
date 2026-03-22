export type MappingSelection = {
  matricule?: string
  prenom?: string
  nom?: string
  email?: string
  direction?: string
  departement?: string
  service?: string
  poste?: string
  nomComplet?: string
  contractType?: string
  contractEndDate?: string
  entryDate?: string
}

function isMapped(
  id: keyof MappingSelection,
  value: MappingSelection,
): boolean {
  const v = value[id]
  return v !== undefined && v !== ''
}

export function mappingStepIsComplete(
  value: MappingSelection,
  useFullNameSplit: boolean,
): boolean {
  if (!isMapped('matricule', value) || !isMapped('email', value)) {
    return false
  }
  const full = isMapped('nomComplet', value)
  if (full && useFullNameSplit) {
    return true
  }
  return isMapped('prenom', value) && isMapped('nom', value)
}

/** Compte les 4 blocs obligatoires : matricule, e-mail, paire prénom+nom (ou nom complet + split). */
export function countRequiredFieldsMapped(
  value: MappingSelection,
  useFullNameSplit: boolean,
): number {
  let n = 0
  if (isMapped('matricule', value)) n += 1
  if (isMapped('email', value)) n += 1
  const nameOk =
    (isMapped('nomComplet', value) && useFullNameSplit) ||
    (isMapped('prenom', value) && isMapped('nom', value))
  if (nameOk) n += 2
  return n
}
