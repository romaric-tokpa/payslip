import {
  importHeadersSatisfyRequired,
  remapImportRowToCanonicalKeys,
  resolveCanonicalColumnName,
  rowFromExplicitMappings,
  splitFullNameValue,
} from './users-import.parse';

describe('users-import.parse — colonnes souples', () => {
  it('accepte maricule (typo courante pour matricule)', () => {
    expect(
      importHeadersSatisfyRequired([
        'maricule',
        'prenom',
        'nom',
        'email',
        'departement',
        'service',
        'poste',
      ]),
    ).toBe(true);
  });

  it('accepte des en-têtes Excel FR variés', () => {
    const headers = [
      'Matricule',
      'Prénom',
      'Nom de famille',
      'E-mail professionnel',
      'Département',
      'Fonction',
    ];
    expect(importHeadersSatisfyRequired(headers)).toBe(true);
  });

  it('résout e-mail et synonymes', () => {
    expect(resolveCanonicalColumnName('E-mail')).toBe('email');
    expect(resolveCanonicalColumnName('Courriel')).toBe('email');
    expect(resolveCanonicalColumnName('Adresse mail')).toBe('email');
  });

  it('remappe une ligne vers les clés canoniques', () => {
    const row = remapImportRowToCanonicalKeys({
      matricule: 'M1',
      prenom: 'A',
      'nom de famille': 'B',
      'e-mail': 'a@b.com',
    });
    expect(row.matricule).toBe('M1');
    expect(row.prenom).toBe('A');
    expect(row.nom).toBe('B');
    expect(row.email).toBe('a@b.com');
  });

  it('splitFullNameValue : espace puis virgule', () => {
    expect(splitFullNameValue('Jean Dupont Martin', ' ')).toEqual({
      prenom: 'Jean',
      nom: 'Dupont Martin',
    });
    expect(splitFullNameValue('Dupont, Jean', ',')).toEqual({
      prenom: 'Jean',
      nom: 'Dupont',
    });
  });

  it('rowFromExplicitMappings + splitFullName', () => {
    const row = {
      Code: 'E1',
      'Nom complet': 'Marie Curie',
      Courriel: 'm@c.fr',
    };
    const mapped = rowFromExplicitMappings(
      row,
      { matricule: 'Code', email: 'Courriel' },
      { column: 'Nom complet', separator: ' ' },
    );
    expect(mapped.prenom).toBe('Marie');
    expect(mapped.nom).toBe('Curie');
    expect(mapped.email).toBe('m@c.fr');
  });
});
