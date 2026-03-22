/** MATRICULE_MM_AAAA.pdf (underscores entre segments). */
const BULK_FILENAME_SEP = /^(.*)_(\d{2})_(\d{4})\.pdf$/i;
/** Forme compacte : …MMYYYY.pdf (ex. EMP001032024.pdf). */
const BULK_FILENAME_COMPACT = /^(.+)(\d{2})(\d{4})\.pdf$/i;

export function parseBulkFilename(name: string): {
  matricule: string;
  month: number;
  year: number;
} | null {
  const sep = name.match(BULK_FILENAME_SEP);
  if (sep) {
    return {
      matricule: sep[1].trim(),
      month: Number.parseInt(sep[2], 10),
      year: Number.parseInt(sep[3], 10),
    };
  }
  const compact = name.match(BULK_FILENAME_COMPACT);
  if (compact) {
    return {
      matricule: compact[1].replace(/_+$/u, '').trim(),
      month: Number.parseInt(compact[2], 10),
      year: Number.parseInt(compact[3], 10),
    };
  }
  return null;
}
