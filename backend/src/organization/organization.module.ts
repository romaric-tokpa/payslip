import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrgController } from './org.controller';
import { OrgResolutionService } from './org-resolution.service';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationController, OrgController],
  providers: [OrganizationService, OrgResolutionService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
