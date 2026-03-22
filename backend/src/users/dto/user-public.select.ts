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
  mustChangePassword: true,
  entryDate: true,
  createdAt: true,
  profilePhotoKey: true,
  employmentStatus: true,
  contractType: true,
  contractEndDate: true,
  departureType: true,
  departureReason: true,
  departureDate: true,
  noticeStartDate: true,
  noticeEndDate: true,
  departedAt: true,
  readOnlyUntil: true,
  archivedAt: true,
} satisfies Prisma.UserSelect;

/** Ligne Prisma (contient la clé S3 interne). */
export type UserPublicRow = Prisma.UserGetPayload<{
  select: typeof userPublicSelect;
}>;

/** Réponse API : URL présignée à la place de la clé. */
export type UserPublicClient = Omit<UserPublicRow, 'profilePhotoKey'> & {
  profilePhotoUrl: string | null;
};
