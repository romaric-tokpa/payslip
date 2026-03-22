import { EmploymentStatus } from '@prisma/client';

export function isUserOperational(user: {
  employmentStatus: EmploymentStatus;
}): boolean {
  return (
    user.employmentStatus === 'ACTIVE' ||
    user.employmentStatus === 'ON_NOTICE'
  );
}
