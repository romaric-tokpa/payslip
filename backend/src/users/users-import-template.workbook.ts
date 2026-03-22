import ExcelJS from 'exceljs';

const HEADER_FILL = 'FF0F5C5E';
const HEADER_TEXT = 'FFFFFFFF';
/** Texte de la ligne d’exemple (gris). */
const EXAMPLE_TEXT = 'FF666666';

const EMAIL_COL = 4;
/** Lignes 2…N : validation e-mail sur la colonne D. */
const EMAIL_VALIDATION_LAST_ROW = 2000;

function autoFitColumns(worksheet: ExcelJS.Worksheet, colCount: number): void {
  for (let c = 1; c <= colCount; c++) {
    const col = worksheet.getColumn(c);
    let max = 12;
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const cell = row.getCell(c);
      const v = cell.value;
      const text =
        v === null || v === undefined
          ? ''
          : typeof v === 'string' || typeof v === 'number'
            ? String(v)
            : '';
      if (text.length > max) {
        max = text.length;
      }
    });
    col.width = Math.min(Math.ceil(max * 1.12) + 2, 48);
  }
}

/**
 * Modèle d’import collaborateurs (.xlsx) pour GET /users/import/template.
 */
export async function buildEmployeeImportTemplateXlsx(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PaySlip Manager';
  wb.created = new Date();

  const ws = wb.addWorksheet('Collaborateurs', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws.addRow([
    'Matricule*',
    'Prénom*',
    'Nom*',
    'Email*',
    'Département',
    'Service',
    'Poste',
  ]);

  const headerRow = ws.getRow(1);
  headerRow.height = 24;
  headerRow.font = { bold: true, color: { argb: HEADER_TEXT } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: HEADER_FILL },
  };
  headerRow.alignment = {
    vertical: 'middle',
    horizontal: 'center',
    wrapText: true,
  };

  ws.addRow([
    'EMP001',
    'Jean',
    'Kouassi',
    'jean.kouassi@entreprise.ci',
    'Finance',
    '',
    'Comptable',
  ]);
  const exampleRow = ws.getRow(2);
  exampleRow.font = { italic: true, color: { argb: EXAMPLE_TEXT } };
  exampleRow.alignment = { vertical: 'middle' };

  const emailDvBase: Omit<ExcelJS.DataValidation, 'formulae'> = {
    type: 'custom',
    allowBlank: true,
    showErrorMessage: true,
    showInputMessage: true,
    errorStyle: 'error',
    errorTitle: 'E-mail invalide',
    error:
      'Saisissez une adresse e-mail valide (ex. prenom.nom@entreprise.ci).',
    promptTitle: 'Colonne E-mail',
    prompt:
      'Format attendu : identifiant@domaine. Chaque e-mail doit être unique.',
  };

  for (let r = 2; r <= EMAIL_VALIDATION_LAST_ROW; r++) {
    ws.getCell(r, EMAIL_COL).dataValidation = {
      ...emailDvBase,
      formulae: [
        `=OR(LEN(D${r})=0,AND(LEN(D${r})>3,NOT(ISERROR(SEARCH("@",D${r}))),NOT(ISERROR(FIND(".",D${r},SEARCH("@",D${r}))))))`,
      ],
    };
  }

  autoFitColumns(ws, 7);

  const instr = wb.addWorksheet('Instructions');
  instr.getColumn(1).width = 92;

  const c1 = instr.getCell('A1');
  c1.value = 'Import des collaborateurs — PaySlip Manager';
  c1.font = { bold: true, size: 14 };
  c1.alignment = { wrapText: true, vertical: 'top' };

  const sections: readonly [string, string][] = [
    [
      'Champs obligatoires',
      'Renseignez au minimum les colonnes Matricule*, Prénom*, Nom* et Email* pour chaque collaborateur. Département, Service (réf. organisation) et Poste sont optionnels. Le libellé du service doit exister dans votre structure (même orthographe que dans PaySlip).',
    ],
    [
      'Matricule',
      'Identifiant unique par collaborateur dans votre entreprise (ex. EMP001). Il sert de référence principale dans PaySlip Manager et ne peut pas être partagé entre deux personnes.',
    ],
    [
      'E-mail',
      'Chaque adresse doit être unique : invitation et connexion du collaborateur. Une validation de format est appliquée sur la colonne E-mail dans l’onglet « Collaborateurs ».',
    ],
    [
      'Contraintes et doublons',
      'N’utilisez pas deux fois le même matricule ni la même adresse e-mail dans le fichier. L’import signalera les doublons et les conflits avec des comptes déjà existants.',
    ],
    [
      'Fichier personnalisé',
      'Vous pouvez aussi importer directement votre propre fichier Excel — le système s’adaptera automatiquement à vos colonnes.',
    ],
  ];

  let r = 3;
  for (const [title, body] of sections) {
    const titleCell = instr.getCell(`A${r}`);
    titleCell.value = title;
    titleCell.font = { bold: true, size: 12 };
    titleCell.alignment = { wrapText: true, vertical: 'top' };
    r += 1;
    const bodyCell = instr.getCell(`A${r}`);
    bodyCell.value = body;
    bodyCell.alignment = { wrapText: true, vertical: 'top' };
    r += 2;
  }

  const raw = await wb.xlsx.writeBuffer();
  return Buffer.from(raw);
}
