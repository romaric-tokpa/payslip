import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationModule } from '../organization/organization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersController } from './users.controller';
import { UserImportJobService } from './user-import-job.service';
import { UsersService } from './users.service';

@Module({
  imports: [PrismaModule, OrganizationModule, forwardRef(() => AuthModule)],
  controllers: [UsersController],
  providers: [UsersService, UserImportJobService],
  exports: [UsersService],
})
export class UsersModule {}
