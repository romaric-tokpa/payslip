import { Prisma } from '@prisma/client';

/** Sélection Prisma : jamais exposer `passwordHash`. */
export const userPublicSelect = {
  id: true,
  companyId: true,
  firstName: true,
  lastName: true,
  email: true,
  employeeId: true,
  department: true,
  position: true,
  role: true,
  isActive: true,
  entryDate: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type UserPublic = Prisma.UserGetPayload<{
  select: typeof userPublicSelect;
}>;
