import {
  findBestMatch,
  levenshteinDistance,
  normalizeString,
} from './string-similarity.util';

describe('string-similarity.util', () => {
  it('normalizeString retire accents et ponctuation', () => {
    expect(normalizeString('  Déjà-Vu!  ')).toBe('dejavu');
  });

  it('levenshteinDistance : cas standards', () => {
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('abc', 'abc')).toBe(0);
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });

  it('findBestMatch retourne null si distance > 3', () => {
    const { match, distance } = findBestMatch('aaaa', [
      { id: '1', name: 'zzzzzz' },
    ]);
    expect(match).toBeNull();
    expect(distance).toBeGreaterThan(3);
  });

  it('findBestMatch trouve une suggestion proche', () => {
    const { match } = findBestMatch('Comptabilté', [
      { id: 'd1', name: 'Comptabilité' },
    ]);
    expect(match).toEqual({ id: 'd1', name: 'Comptabilité' });
  });
});
