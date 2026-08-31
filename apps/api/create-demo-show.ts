import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });
const prisma = new PrismaClient();

async function main() {
  const email = 'janis@zacs.lv'; // PĀRBAUDI EPASTU
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return console.log("❌ Lietotājs nav atrasts!");

  console.log("🧹 Tīru vecos datus...");
  await prisma.vote.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.showVersion.deleteMany({});
  await prisma.show.deleteMany({});

  const demoScenes = [
    { 
      id: 's1', 
      type: 'TEXT', 
      title: 'Sveiciens!', 
      config: { 
        text: 'Laipni lūdzam šovā!',
        mediaUrl: 'https://images.unsplash.com/photo-1516280440614-37939bbdd4f1?w=800', // Bilžu tests
        mediaType: 'image'
      } 
    },
    { 
      id: 's2', 
      type: 'QUIZ', 
      title: 'Attēla jautājums', 
      config: { 
        question: 'Kas redzams šajā attēlā?', 
        options: ['Mikrofons', 'Ģitāra', 'Bungas'],
        correctAnswer: 'Mikrofons',
        duration: 15,
        mediaUrl: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=800', // Bilde
        mediaType: 'image'
      } 
    },
    { 
      id: 's3', 
      type: 'QUIZ', 
      title: 'Video jautājums', 
      config: { 
        question: 'Kāds dzīvnieks tas ir?', 
        options: ['Zilonis', 'Lācis', 'Lauva'],
        correctAnswer: 'Zilonis',
        duration: 20,
        mediaUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', // Video tests
        mediaType: 'video'
      } 
    },
    { 
      id: 'scene_music', 
      type: 'QUIZ', 
      title: 'Mūzikas izaicinājums 🎧', 
      config: { 
        question: 'Kas izpilda šo dziesmu un kāds ir tās nosaukums?', 
        options: ['Instrumenti', 'Prāta Vētra', 'Musiqq', 'Nākamā pietura', 'Ziemu apēst', 'Debesis iekrita Tevī'], 
        correctAnswers: ['Instrumenti', 'Nākamā pietura'], // Masīvs ar pareizajām atbildēm
        points: 100,
        duration: 30,
        mediaUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 
        mediaType: 'video'
      } 
    }
  ];

  await prisma.show.create({
    data: {
      title: 'MEDIJU ŠOVS',
      ownerId: user.id,
      versions: { create: { scenes: demoScenes, version: 1 } }
    }
  });

  console.log('✅ IZVEIDOTA JAUNA SPĒLE AR ATTĒLIEM, VIDEO UN MŪZIKAS IZAICINĀJUMU!');
}

main().finally(() => prisma.$disconnect());