import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { RequestUser } from '../auth/auth.types';
import {
  findBestMatch,
  normalizeString,
} from '../common/utils/string-similarity.util';
import { PrismaService } from '../prisma/prisma.service';
import type { BulkCreateOrgDto } from './dto/bulk-create-org.dto';
import type {
  BulkCreateOrgResponseDto,
  CreatedOrgEntityDto,
} from './dto/bulk-create-org.dto';
import type {
  OrgResolveAggregatesDto,
  OrgResolutionItemDto,
  OrgRowForResolveDto,
  ResolveOrgDto,
  ResolveOrgResponseDto,
} from './dto/resolve-org.dto';
import { ORG_AUDIT } from './org.constants';

const PARENT_RATIO = 0.8;

function matchCellToValue(
  cell: string | undefined,
  labelValue: string,
): boolean {
  const a = normalizeString(cell ?? '');
  const b = normalizeString(labelValue);
  return a !== '' && a === b;
}

function countLinesForValue(
  rows: OrgRowForResolveDto[],
  field: 'direction' | 'department' | 'service',
  labelValue: string,
): number {
  let n = 0;
  for (const r of rows) {
    if (matchCellToValue(r[field], labelValue)) {
      n += 1;
    }
  }
  return n;
}

function countLinesForField(
  rows: OrgRowForResolveDto[],
  agg: OrgResolveAggregatesDto | undefined,
  field: 'direction' | 'department' | 'service',
  labelValue: string,
): number {
  if (agg) {
    const k = normalizeString(labelValue);
    if (field === 'direction') {
      return Math.max(0, Math.floor(agg.directionCounts[k] ?? 0));
    }
    if (field === 'department') {
      return Math.max(0, Math.floor(agg.departmentCounts[k] ?? 0));
    }
    return Math.max(0, Math.floor(agg.serviceCounts[k] ?? 0));
  }
  return countLinesForValue(rows, field, labelValue);
}

/** Mode associé (département ou direction) pour les lignes ayant filterValue sur filterField. */
function dominantParentHint(
  rows: OrgRowForResolveDto[],
  filterField: 'service' | 'department',
  filterValue: string,
  readField: 'department' | 'direction',
): { displayName: string; ratio: number } | null {
  const matching = rows.filter((r) =>
    matchCellToValue(r[filterField], filterValue),
  );
  if (matching.length === 0) {
    return null;
  }
  const counts = new Map<string, { display: string; n: number }>();
  for (const r of matching) {
    const raw = (r[readField] ?? '').trim();
    if (!raw) {
      continue;
    }
    const k = normalizeString(raw);
    const cur = counts.get(k);
    if (cur) {
      cur.n += 1;
    } else {
      counts.set(k, { display: raw, n: 1 });
    }
  }
  let best: { display: string; n: number } | null = null;
  for (const v of counts.values()) {
    if (!best || v.n > best.n) {
      best = v;
    }
  }
  if (!best) {
    return null;
  }
  const ratio = best.n / matching.length;
  if (ratio < PARENT_RATIO) {
    return null;
  }
  return { displayName: best.display, ratio };
}

function dominantParentFromServiceDepartmentEdges(
  agg: OrgResolveAggregatesDto,
  serviceLabelValue: string,
): { displayName: string; ratio: number } | null {
  const sn = normalizeString(serviceLabelValue);
  let total = 0;
  const counts = new Map<string, { display: string; n: number }>();
  for (const e of agg.serviceDepartmentEdges) {
    if (normalizeString(e.serviceNorm) !== sn) {
      continue;
    }
    total += e.count;
    const raw = e.departmentRaw.trim();
    if (!raw) {
      continue;
    }
    const dk = normalizeString(raw);
    const cur = counts.get(dk);
    if (cur) {
      cur.n += e.count;
    } else {
      counts.set(dk, { display: raw, n: e.count });
    }
  }
  if (total === 0) {
    return null;
  }
  let best: { display: string; n: number } | null = null;
  for (const v of counts.values()) {
    if (!best || v.n > best.n) {
      best = v;
    }
  }
  if (!best) {
    return null;
  }
  const ratio = best.n / total;
  if (ratio < PARENT_RATIO) {
    return null;
  }
  return { displayName: best.display, ratio };
}

function dominantParentFromDepartmentDirectionEdges(
  agg: OrgResolveAggregatesDto,
  departmentLabelValue: string,
): { displayName: string; ratio: number } | null {
  const dn = normalizeString(departmentLabelValue);
  let total = 0;
  const counts = new Map<string, { display: string; n: number }>();
  for (const e of agg.departmentDirectionEdges) {
    if (normalizeString(e.departmentNorm) !== dn) {
      continue;
    }
    total += e.count;
    const raw = e.directionRaw.trim();
    if (!raw) {
      continue;
    }
    const dk = normalizeString(raw);
    const cur = counts.get(dk);
    if (cur) {
      cur.n += e.count;
    } else {
      counts.set(dk, { display: raw, n: e.count });
    }
  }
  if (total === 0) {
    return null;
  }
  let best: { display: string; n: number } | null = null;
  for (const v of counts.values()) {
    if (!best || v.n > best.n) {
      best = v;
    }
  }
  if (!best) {
    return null;
  }
  const ratio = best.n / total;
  if (ratio < PARENT_RATIO) {
    return null;
  }
  return { displayName: best.display, ratio };
}

function dominantParentUnified(
  rows: OrgRowForResolveDto[],
  agg: OrgResolveAggregatesDto | undefined,
  filterField: 'service' | 'department',
  filterValue: string,
  readField: 'department' | 'direction',
): { displayName: string; ratio: number } | null {
  if (agg) {
    if (filterField === 'service' && readField === 'department') {
      return dominantParentFromServiceDepartmentEdges(agg, filterValue);
    }
    if (filterField === 'department' && readField === 'direction') {
      return dominantParentFromDepartmentDirectionEdges(agg, filterValue);
    }
  }
  return dominantParentHint(rows, filterField, filterValue, readField);
}

function findEntityIdByName(
  name: string,
  entities: { id: string; name: string }[],
): { id: string; name: string } | null {
  const n = normalizeString(name);
  for (const e of entities) {
    if (normalizeString(e.name) === n) {
      return e;
    }
  }
  return null;
}

function dedupeLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of labels) {
    const t = raw.trim();
    if (!t) {
      continue;
    }
    const k = normalizeString(t);
    if (seen.has(k)) {
      continue;
    }
    seen.add(k);
    out.push(t);
  }
  return out;
}

@Injectable()
export class OrgResolutionService {
  constructor(private readonly prisma: PrismaService) {}

  private assertRhWithCompany(actor: RequestUser): string {
    if (actor.role !== 'RH_ADMIN') {
      throw new ForbiddenException();
    }
    if (!actor.companyId) {
      throw new ForbiddenException('Compte sans entreprise associée');
    }
    return actor.companyId;
  }

  async resolveOrg(
    actor: RequestUser,
    dto: ResolveOrgDto,
  ): Promise<ResolveOrgResponseDto> {
    const companyId = this.assertRhWithCompany(actor);
    const rows = dto.orgRows ?? [];
    const agg = dto.orgAggregates;

    const [dirRows, deptRows, svcRows] = await Promise.all([
      this.prisma.direction.findMany({
        where: { companyId },
        select: { id: true, name: true },
      }),
      this.prisma.department.findMany({
        where: { companyId },
        select: { id: true, name: true },
      }),
      this.prisma.service.findMany({
        where: { companyId },
        select: { id: true, name: true },
      }),
    ]);

    const directionLabels = dedupeLabels([...(dto.directions ?? [])]);
    const departmentLabels = dedupeLabels([...(dto.departments ?? [])]);
    const serviceLabels = dedupeLabels([...(dto.services ?? [])]);

    const directions: OrgResolutionItemDto[] = directionLabels.map((value) =>
      this.buildDirectionItem(value, dirRows, rows, agg),
    );

    const departments: OrgResolutionItemDto[] = departmentLabels.map((value) =>
      this.buildDepartmentItem(value, deptRows, dirRows, rows, agg),
    );

    const services: OrgResolutionItemDto[] = serviceLabels.map((value) =>
      this.buildServiceItem(value, svcRows, deptRows, rows, agg),
    );

    return { directions, departments, services };
  }

  private buildDirectionItem(
    value: string,
    existing: { id: string; name: string }[],
    rows: OrgRowForResolveDto[],
    agg: OrgResolveAggregatesDto | undefined,
  ): OrgResolutionItemDto {
    const normalizedValue = normalizeString(value);
    const lineCount = countLinesForField(rows, agg, 'direction', value);
    const exact = findEntityIdByName(value, existing);
    if (exact) {
      return {
        value,
        normalizedValue,
        status: 'existing',
        existingId: exact.id,
        existingName: exact.name,
        lineCount: Math.max(lineCount, 1),
      };
    }
    const { match, distance } = findBestMatch(value, existing);
    if (
      match &&
      distance > 0 &&
      normalizeString(match.name) !== normalizedValue
    ) {
      return {
        value,
        normalizedValue,
        status: 'similar',
        suggestedId: match.id,
        suggestedName: match.name,
        lineCount: Math.max(lineCount, 1),
      };
    }
    return {
      value,
      normalizedValue,
      status: 'new',
      lineCount: Math.max(lineCount, 1),
    };
  }

  private buildDepartmentItem(
    value: string,
    existingDepts: { id: string; name: string }[],
    existingDirs: { id: string; name: string }[],
    rows: OrgRowForResolveDto[],
    agg: OrgResolveAggregatesDto | undefined,
  ): OrgResolutionItemDto {
    const normalizedValue = normalizeString(value);
    const lineCount = countLinesForField(rows, agg, 'department', value);
    const exact = findEntityIdByName(value, existingDepts);
    if (exact) {
      return {
        value,
        normalizedValue,
        status: 'existing',
        existingId: exact.id,
        existingName: exact.name,
        lineCount: Math.max(lineCount, 1),
      };
    }
    const { match, distance } = findBestMatch(value, existingDepts);
    if (
      match &&
      distance > 0 &&
      normalizeString(match.name) !== normalizedValue
    ) {
      const hint = dominantParentUnified(
        rows,
        agg,
        'department',
        value,
        'direction',
      );
      let suggestedParentId: string | undefined;
      let suggestedParentName: string | undefined;
      if (hint) {
        const d = findEntityIdByName(hint.displayName, existingDirs);
        if (d) {
          suggestedParentId = d.id;
          suggestedParentName = d.name;
        }
      }
      return {
        value,
        normalizedValue,
        status: 'similar',
        suggestedId: match.id,
        suggestedName: match.name,
        suggestedParentId,
        suggestedParentName,
        lineCount: Math.max(lineCount, 1),
      };
    }
    const hint = dominantParentUnified(
      rows,
      agg,
      'department',
      value,
      'direction',
    );
    let suggestedParentId: string | undefined;
    let suggestedParentName: string | undefined;
    if (hint) {
      const d = findEntityIdByName(hint.displayName, existingDirs);
      if (d) {
        suggestedParentId = d.id;
        suggestedParentName = d.name;
      }
    }
    return {
      value,
      normalizedValue,
      status: 'new',
      suggestedParentId,
      suggestedParentName,
      lineCount: Math.max(lineCount, 1),
    };
  }

  private buildServiceItem(
    value: string,
    existingSvcs: { id: string; name: string }[],
    existingDepts: { id: string; name: string }[],
    rows: OrgRowForResolveDto[],
    agg: OrgResolveAggregatesDto | undefined,
  ): OrgResolutionItemDto {
    const normalizedValue = normalizeString(value);
    const lineCount = countLinesForField(rows, agg, 'service', value);
    const exact = findEntityIdByName(value, existingSvcs);
    if (exact) {
      return {
        value,
        normalizedValue,
        status: 'existing',
        existingId: exact.id,
        existingName: exact.name,
        lineCount: Math.max(lineCount, 1),
      };
    }
    const { match, distance } = findBestMatch(value, existingSvcs);
    if (
      match &&
      distance > 0 &&
      normalizeString(match.name) !== normalizedValue
    ) {
      const hint = dominantParentUnified(
        rows,
        agg,
        'service',
        value,
        'department',
      );
      let suggestedParentId: string | undefined;
      let suggestedParentName: string | undefined;
      if (hint) {
        const d = findEntityIdByName(hint.displayName, existingDepts);
        if (d) {
          suggestedParentId = d.id;
          suggestedParentName = d.name;
        }
      }
      return {
        value,
        normalizedValue,
        status: 'similar',
        suggestedId: match.id,
        suggestedName: match.name,
        suggestedParentId,
        suggestedParentName,
        lineCount: Math.max(lineCount, 1),
      };
    }
    const hint = dominantParentUnified(
      rows,
      agg,
      'service',
      value,
      'department',
    );
    let suggestedParentId: string | undefined;
    let suggestedParentName: string | undefined;
    if (hint) {
      const d = findEntityIdByName(hint.displayName, existingDepts);
      if (d) {
        suggestedParentId = d.id;
        suggestedParentName = d.name;
      }
    }
    return {
      value,
      normalizedValue,
      status: 'new',
      suggestedParentId,
      suggestedParentName,
      lineCount: Math.max(lineCount, 1),
    };
  }

  async bulkCreateOrg(
    actor: RequestUser,
    dto: BulkCreateOrgDto,
  ): Promise<BulkCreateOrgResponseDto> {
    const companyId = this.assertRhWithCompany(actor);
    const createdDirections: CreatedOrgEntityDto[] = [];
    const createdDepartments: CreatedOrgEntityDto[] = [];
    const createdServices: CreatedOrgEntityDto[] = [];
    const reusedDirections: CreatedOrgEntityDto[] = [];
    const reusedDepartments: CreatedOrgEntityDto[] = [];
    const reusedServices: CreatedOrgEntityDto[] = [];

    await this.prisma.$transaction(async (tx) => {
      const dirs = await tx.direction.findMany({
        where: { companyId },
        select: { id: true, name: true },
      });
      const depts = await tx.department.findMany({
        where: { companyId },
        select: { id: true, name: true },
      });
      const svcs = await tx.service.findMany({
        where: { companyId },
        select: { id: true, name: true },
      });

      const dirByNorm = new Map<string, { id: string; name: string }>();
      for (const d of dirs) {
        dirByNorm.set(normalizeString(d.name), d);
      }
      const deptByNorm = new Map<string, { id: string; name: string }>();
      for (const d of depts) {
        deptByNorm.set(normalizeString(d.name), d);
      }
      const svcByNorm = new Map<string, { id: string; name: string }>();
      for (const s of svcs) {
        svcByNorm.set(normalizeString(s.name), s);
      }

      for (const item of dto.directions) {
        const name = item.name.trim();
        if (!name) {
          continue;
        }
        const k = normalizeString(name);
        const hit = dirByNorm.get(k);
        if (hit) {
          reusedDirections.push({ id: hit.id, name: hit.name });
          continue;
        }
        const row = await tx.direction.create({
          data: {
            ...(item.id ? { id: item.id } : {}),
            companyId,
            name,
          },
          select: { id: true, name: true },
        });
        dirByNorm.set(k, row);
        createdDirections.push({ id: row.id, name: row.name });
      }

      for (const item of dto.departments) {
        const name = item.name.trim();
        if (!name) {
          continue;
        }
        const k = normalizeString(name);
        const hit = deptByNorm.get(k);
        if (hit) {
          reusedDepartments.push({ id: hit.id, name: hit.name });
          continue;
        }
        let directionId: string | null = null;
        if (item.directionId?.trim()) {
          const d = await tx.direction.findFirst({
            where: { id: item.directionId.trim(), companyId },
            select: { id: true },
          });
          if (d) {
            directionId = d.id;
          }
        }
        const row = await tx.department.create({
          data: {
            ...(item.id ? { id: item.id } : {}),
            companyId,
            name,
            directionId,
          },
          select: { id: true, name: true },
        });
        deptByNorm.set(k, row);
        createdDepartments.push({ id: row.id, name: row.name });
      }

      for (const item of dto.services) {
        const name = item.name.trim();
        if (!name) {
          continue;
        }
        const k = normalizeString(name);
        const hit = svcByNorm.get(k);
        if (hit) {
          reusedServices.push({ id: hit.id, name: hit.name });
          continue;
        }
        let departmentId: string | null = null;
        if (item.departmentId?.trim()) {
          const d = await tx.department.findFirst({
            where: { id: item.departmentId.trim(), companyId },
            select: { id: true },
          });
          if (d) {
            departmentId = d.id;
          }
        }
        const row = await tx.service.create({
          data: {
            ...(item.id ? { id: item.id } : {}),
            companyId,
            name,
            departmentId,
          },
          select: { id: true, name: true },
        });
        svcByNorm.set(k, row);
        createdServices.push({ id: row.id, name: row.name });
      }

      const metadata = {
        createdDirections: createdDirections.length,
        createdDepartments: createdDepartments.length,
        createdServices: createdServices.length,
        reusedDirections: reusedDirections.length,
        reusedDepartments: reusedDepartments.length,
        reusedServices: reusedServices.length,
        createdDirectionDetails: createdDirections,
        createdDepartmentDetails: createdDepartments,
        createdServiceDetails: createdServices,
      } as unknown as Prisma.InputJsonValue;

      await tx.auditLog.create({
        data: {
          userId: actor.id,
          companyId,
          action: ORG_AUDIT.BULK_CREATED,
          entityType: 'Company',
          entityId: companyId,
          metadata,
        },
      });
    });

    return {
      createdDirections,
      createdDepartments,
      createdServices,
      reusedDirections,
      reusedDepartments,
      reusedServices,
    };
  }
}
