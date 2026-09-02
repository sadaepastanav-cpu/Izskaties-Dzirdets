import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });
const prisma = new PrismaClient();

async function main() {
  const email = 'janis@zacs.lv'; // Pārliecinies, ka šis ir tavs admin epasts
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return console.log("❌ Lietotājs nav atrasts! Vispirms palaid seed-admin skriptu.");

  // Iztīrām vecos datus, lai sāktu no tīras lapas
  console.log("🧹 Tīru vecos datus...");
  await prisma.vote.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.showVersion.deleteMany({});
  await prisma.show.deleteMany({});

  const demoScenes = [
    { 
      id: 'intro', 
      type: 'TEXT', 
      title: 'Laipni lūdzam!', 
      config: { 
        text: 'Šovs tūlīt sāksies!',
        mediaUrl: 'https://placehold.co/800x450/000/fff?text=Sagatavojieties', 
        mediaType: 'image'
      } 
    },
    { 
      id: 'q1', 
      type: 'QUIZ', 
      title: 'Mūzikas Izaicinājums 🎧', 
      config: { 
        question: 'Izvēlies pareizo izpildītāju UN pareizo dziesmas nosaukumu!', 
        // 3 Izpildītāji (Instrumenti, Prāta Vētra, Musiqq) 
        // 3 Dziesmas (Nākamā pietura, Ziemu apēst, Debesis iekrita Tevī)
        options: ['Instrumenti', 'Prāta Vētra', 'Musiqq', 'Nākamā pietura', 'Ziemu apēst', 'Debesis iekrita Tevī'],
        correctAnswers: ['Instrumenti', 'Nākamā pietura'], // Divas pareizās atbildes
        duration: 20, // Taimeris uz 20 sekundēm
        mediaUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', // Testa video
        mediaType: 'video'
      } 
    },
    { id: 'results', type: 'LEADERBOARD', title: 'Rezultātu tops', config: {} }
  ];

  await prisma.show.create({
    data: {
      title: 'QuizXpress Stila Šovs',
      ownerId: user.id,
      versions: { create: { scenes: demoScenes, version: 1 } }
    }
  });

  console.log('✅ Spēle sagatavota! Tagad vari slēgt iekšā serveri.');
}

main().finally(() => prisma.$disconnect());