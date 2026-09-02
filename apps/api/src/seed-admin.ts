import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Šī rinda ir "brilles" skriptam – tā pasaka, ka .env fails ir 2 mapes augstāk
dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
  const email = 'janis@zacs.lv'; // PĀRBAUDI VAI ŠEIT IR TAVS EPASTS
  const password = 'viens2345'; // PĀRBAUDI VAI ŠEIT IR TAVA PAROLE

  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash: hashedPassword,
      role: 'SUPERADMIN',
    },
  });

  console.log('✅ Admin lietotājs izveidots:', admin.email);
}

main()
  .catch((e) => {
    console.error('❌ Kļūda:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });