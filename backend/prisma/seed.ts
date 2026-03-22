import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL manquant pour prisma seed');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function seedSuperAdmin() {
  const email = 'r.tokpa@payslip-manager.com';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Super Admin déjà présent : ${email}`);
    return;
  }

  const hashedPassword = await bcrypt.hash('18-19Th022611', 12);

  await prisma.user.create({
    data: {
      firstName: 'Romaric',
      lastName: 'Admin',
      email,
      passwordHash: hashedPassword,
      role: 'SUPER_ADMIN',
      isActive: true,
      employmentStatus: 'ACTIVE',
      mustChangePassword: true,
      companyId: null,
    },
  });

  console.log(`Super Admin créé : ${email}`);
}

async function main() {
  await seedSuperAdmin();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
