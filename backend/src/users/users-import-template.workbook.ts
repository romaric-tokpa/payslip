import ExcelJS from 'exceljs';

const HEADER_FILL = 'FF0F5C5E';
const HEADER_TEXT = 'FFFFFFFF';
/** Texte de la ligne d’exemple (gris). */
const EXAMPLE_TEXT = 'FF666666';

const EMAIL_COL = 4;
const CONTRACT_TYPE_COL = 8;
const ENTRY_DATE_COL = 9;
const CONTRACT_END_COL = 10;
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
    'Type de contrat',
    "Date d'entrée",
    'Date de fin de contrat',
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
    'CDI',
    '15/01/2024',
    '',
  ]);
  const exampleRow = ws.getRow(2);
  exampleRow.font = { italic: true, color: { argb: EXAMPLE_TEXT } };
  exampleRow.alignment = { vertical: 'middle' };
  for (const c of [ENTRY_DATE_COL, CONTRACT_END_COL]) {
    exampleRow.getCell(c).numFmt = 'dd/mm/yyyy';
  }

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

  const contractListDv: ExcelJS.DataValidation = {
    type: 'list',
    allowBlank: true,
    showErrorMessage: true,
    errorStyle: 'warning',
    errorTitle: 'Valeur hors liste',
    error: 'Utilisez : CDI, CDD, Intérim ou Stage.',
    formulae: ['"CDI,CDD,Intérim,Stage"'],
  };

  for (let r = 2; r <= EMAIL_VALIDATION_LAST_ROW; r++) {
    ws.getCell(r, CONTRACT_TYPE_COL).dataValidation = contractListDv;
    ws.getCell(r, ENTRY_DATE_COL).numFmt = 'dd/mm/yyyy';
    ws.getCell(r, CONTRACT_END_COL).numFmt = 'dd/mm/yyyy';
  }

  autoFitColumns(ws, 10);

  const instr = wb.addWorksheet('Instructions');
  instr.getColumn(1).width = 92;

  const c1 = instr.getCell('A1');
  c1.value = 'Import des collaborateurs — PaySlip Manager';
  c1.font = { bold: true, size: 14 };
  c1.alignment = { wrapText: true, vertical: 'top' };

  const sections: readonly [string, string][] = [
    [
      'Champs obligatoires',
      'Renseignez au minimum les colonnes Matricule*, Prénom*, Nom* et Email* pour chaque collaborateur. Département, Service, Poste, Type de contrat, dates de contrat sont optionnels.',
    ],
    [
      'Type de contrat',
      'Liste déroulante : CDI, CDD, Intérim, Stage. Pour les CDD, missions intérim et stages, renseignez aussi la date de fin de contrat (obligatoire pour les alertes d’échéance).',
    ],
    [
      "Dates d'entrée et de fin",
      "Format date JJ/MM/AAAA (ex. 31/12/2025). La date de fin de contrat est obligatoire pour les CDD, Intérim et Stage afin d'alimenter le tableau de bord « contrats à échéance ».",
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
