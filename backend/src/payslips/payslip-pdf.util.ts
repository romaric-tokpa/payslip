/**
 * Les navigateurs envoient parfois `application/octet-stream` ou une chaîne
 * vide pour un fichier .pdf — on accepte dans ce cas si l’extension est .pdf.
 */
export function isLikelyPdfUpload(file: {
  originalname?: string
  mimetype?: string
}): boolean {
  const name = (file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();
  if (mime === 'application/pdf' || mime === 'application/x-pdf') {
    return true;
  }
  if (!name.endsWith('.pdf')) {
    return false;
  }
  return (
    mime === 'application/octet-stream' ||
    mime === 'binary/octet-stream' ||
    mime === ''
  );
}
