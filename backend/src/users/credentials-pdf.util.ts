import PDFDocument from 'pdfkit';
export type CredentialRow = {
  status: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeId: string;
  tempPassword: string;
};

function formatExpiryFr(d: Date): string {
  return d.toLocaleString('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

/**
 * PDF A4 : jusqu’à 4 fiches par page, séparées par des pointillés.
 */
export function buildCredentialsPdfBuffer(
  credentials: CredentialRow[],
  companyName: string,
  expiresAt: Date,
): Promise<Buffer> {
  const active = credentials.filter((c) => c.status === 'activated');
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(10).fillColor('#0F5C5E');
    doc.text('PaySlip Manager', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#7F8C8D');
    doc.text(companyName, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#BDC3C7');
    doc.text(
      `Mot de passe temporaire à changer dès la première connexion. Expire le ${formatExpiryFr(expiresAt)}.`,
      { align: 'center' },
    );
    doc.moveDown(1);

    const pageH = doc.page.height;
    const margin = 36;
    const contentTop = doc.y;
    const contentH = pageH - margin - contentTop - margin;
    const slotH = contentH / 4;
    const left = margin;
    const width = doc.page.width - margin * 2;

    let idx = 0;
    for (const c of active) {
      if (idx > 0 && idx % 4 === 0) {
        doc.addPage();
        doc.y = margin + 20;
      }
      const slot = idx % 4;
      const y0 = contentTop + slot * slotH + 6;
      const y1 = contentTop + (slot + 1) * slotH - 6;

      doc.save();
      doc.lineWidth(0.5).dash(4, { space: 3 }).strokeColor('#BDC3C7');
      doc.rect(left, y0 - 4, width, y1 - y0 + 8).stroke();
      doc.undash();

      doc.fillColor('#1C2833').fontSize(11);
      doc.text(`${c.firstName} ${c.lastName}`, left + 8, y0, {
        width: width - 16,
      });
      doc.fontSize(9).fillColor('#7F8C8D');
      doc.text(`Matricule : ${c.employeeId}`, left + 8, y0 + 16, {
        width: width - 16,
      });
      doc.text(`E-mail : ${c.email}`, left + 8, y0 + 30, {
        width: width - 16,
      });
      doc.fillColor('#F28C28').font('Helvetica-Bold').fontSize(11);
      doc.text(`Mot de passe : ${c.tempPassword}`, left + 8, y0 + 46, {
        width: width - 16,
      });
      doc.font('Helvetica');
      doc.restore();

      idx += 1;
    }

    if (active.length === 0) {
      doc.fillColor('#7F8C8D').fontSize(11);
      doc.text('Aucun identifiant à imprimer (aucun compte activé).', {
        align: 'center',
      });
    }

    doc.end();
  });
}
