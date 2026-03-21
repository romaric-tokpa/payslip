import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { MeResponse } from '../users/users.service';
import { UsersService } from '../users/users.service';
import { COMPANY_AUDIT } from './companies.constants';
import { UpdateCompanyMeDto } from './dto/update-company-me.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async updateMyCompany(
    actor: RequestUser,
    dto: UpdateCompanyMeDto,
  ): Promise<MeResponse> {
    if (actor.role !== 'RH_ADMIN' && actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException();
    }
    if (!actor.companyId) {
      throw new BadRequestException(
        'Aucune entreprise rattachée à ce compte : la mise à jour des informations légales est réservée aux comptes liés à une société.',
      );
    }

    const data: Prisma.CompanyUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
    }
    if (dto.rccm !== undefined) {
      data.rccm = dto.rccm === '' ? null : dto.rccm;
    }
    if (dto.address !== undefined) {
      data.address = dto.address === '' ? null : dto.address;
    }

    if (Object.keys(data).length === 0) {
      return this.users.getMe(actor);
    }

    await this.prisma.company.update({
      where: { id: actor.companyId },
      data,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: COMPANY_AUDIT.LEGAL_INFO_UPDATED,
        entityType: 'Company',
        entityId: actor.companyId,
        metadata: { fields: Object.keys(data) } as Prisma.InputJsonValue,
      },
    });

    return this.users.getMe(actor);
  }
}
