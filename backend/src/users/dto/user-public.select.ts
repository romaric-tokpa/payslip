import { Prisma } from '@prisma/client';

const orgDepartmentBrief = {
  id: true,
  name: true,
  directionId: true,
  direction: { select: { id: true, name: true } },
} as const;
const orgServiceBrief = {
  id: true,
  name: true,
  departmentId: true,
} as const;

/** Sélection Prisma : jamais exposer `passwordHash`. */
export const userPublicSelect = {
  id: true,
  companyId: true,
  firstName: true,
  lastName: true,
  email: true,
  employeeId: true,
  department: true,
  departmentId: true,
  serviceId: true,
  orgDepartment: { select: orgDepartmentBrief },
  orgService: { select: orgServiceBrief },
  position: true,
  role: true,
  isActive: true,
  entryDate: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type UserPublic = Prisma.UserGetPayload<{
  select: typeof userPublicSelect;
}>;
