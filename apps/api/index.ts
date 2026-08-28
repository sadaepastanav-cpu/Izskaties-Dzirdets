import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

// Ielādējam .env failu no saknes mapes
dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Pirmais "tests" – atverot pārlūkā http://localhost:3000/
app.get('/', (req, res) => {
  res.send({ message: 'IZSKATIESDZIRDĒTS API strādā!', status: 'OK' });
});

// Tests – saraksts ar visiem lietotājiem (lai redzētu, ka DB strādā)
app.get('/users-test', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { email: true, role: true }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Nevarēja pieslēgties datubāzei' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Serveris palaists: http://localhost:${PORT}`);
});