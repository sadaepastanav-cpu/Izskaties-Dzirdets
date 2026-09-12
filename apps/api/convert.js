const fs = require('fs');
const path = require('path');

// 1. IEKOPĒ SAVU CLAUDE JSON STARP ŠĪM IEKAVĀM:
const rawQuizData = 

/*{
  "quiz_title": "Dzimsanas dienas muzikala 70-musdienas",
  "slide_count": 101,
  "slides": [
    {
      "index": 1,
      "category": "Default Category",
      "note_comment": "",
      "question_text": "Put your question here",
      "points": 10,
      "points_low": 10,
      "answer_time_seconds": 30,
      "style_name": "",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 2,
      "category": "PS ",
      "note_comment": "Van McCoy - The Hustle",
      "question_text": " Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 15,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Van McCoy",
          "correctness_percent": 50
        },
        {
          "label": 2,
          "text": "The Three Degrees ",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Rick Royce",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "The Hustle",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "Disco Baby",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Do It",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 3,
      "category": "PS ",
      "note_comment": "Van McCoy - The Hustle",
      "question_text": " Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 0,
      "points_low": 0,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Van McCoy",
          "correctness_percent": 50
        },
        {
          "label": 2,
          "text": "The Three Degrees ",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Rick Royce",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "The Hustle",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "Disco Baby",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Do It",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 70-90\\0 Van McCoy - The Hustle (Lyrics) (256 kbps).mp3",
        "start_ms": 348000000,
        "duration_ms": 3712260000
      }
    },
    {
      "index": 4,
      "category": "PS ",
      "note_comment": "",
      "question_text": "",
      "points": 15,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Black-Color-Border",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 5,
      "category": "PS ",
      "note_comment": "Van Halen - Jump",
      "question_text": "1. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Poison",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Aerosmith",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Van Halen",
          "correctness_percent": 50
        },
        {
          "label": 4,
          "text": "Get Up",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Jump",
          "correctness_percent": 50
        },
        {
          "label": 6,
          "text": "Who Said That?",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 70-90\\0 Van Halen - Jump (Lyrics) _ BUGG Lyrics (256 kbps).mp3",
        "start_ms": 4000000,
        "duration_ms": 2650120000
      }
    },
    {
      "index": 6,
      "category": "PS ",
      "note_comment": "Camila Cabello - Havana",
      "question_text": "2. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Bebe Rexha",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Dua Lipa",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Camila Cabello",
          "correctness_percent": 50
        },
        {
          "label": 4,
          "text": "Night In June",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "East Atlanta",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Havana",
          "correctness_percent": 50
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Diwalli 09.07.2022 Arzemju 2010- 2020\\1 Camila Cabello - Havana (Audio) ft. Young Thug (256 kbps).mp3",
        "start_ms": 282500000,
        "duration_ms": 2190090000
      }
    },
    {
      "index": 7,
      "category": "PS ",
      "note_comment": "George Michael - Outside\r\nBack to nature, it's human nature",
      "question_text": "3. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "George Michael ",
          "correctness_percent": 50
        },
        {
          "label": 2,
          "text": "Simply Red",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Paul Young",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Bad",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Outside",
          "correctness_percent": 50
        },
        {
          "label": 6,
          "text": "Back To Nature",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 1990 - 2000 V2\\yt5s.com - George Michael - Outside (Lyrics) (256 kbps).mp3",
        "start_ms": 1019000000,
        "duration_ms": 2831940000
      }
    },
    {
      "index": 8,
      "category": "PS ",
      "note_comment": "Mēs pārtiekam viens no otra - Pērkons",
      "question_text": "4. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Jumprava",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Zodiaks",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Pērkons",
          "correctness_percent": 50
        },
        {
          "label": 4,
          "text": "Gaisma no Tavām acīm",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Mēs pārtiekam viens\r\n no otra",
          "correctness_percent": 50
        },
        {
          "label": 6,
          "text": "Dvēseles smarža",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 70-90\\1 Mēs pārtiekam viens no otra - Pērkons - Mikrofons 1989 (256 kbps).mp3",
        "start_ms": 1650000000,
        "duration_ms": 4991220000
      }
    },
    {
      "index": 9,
      "category": "PS ",
      "note_comment": "I'm Too Sexy - Right Said Fred",
      "question_text": "5. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Mr. President",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Right Said Fred",
          "correctness_percent": 50
        },
        {
          "label": 3,
          "text": "Technotronic",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "I'm Too Sexy",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "Catwalk",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "What Ya Think\r\nAbout That?",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 1990 - 2000 V2\\yt5s.com - I'm Too Sexy - Right Said Fred LYRICS (256 kbps).mp3",
        "start_ms": 1025000000,
        "duration_ms": 1816560000
      }
    },
    {
      "index": 10,
      "category": "PS ",
      "note_comment": "50 Cent - In Da Club ",
      "question_text": "6. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "The Game",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "G-Unit",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "50 Cent",
          "correctness_percent": 50
        },
        {
          "label": 4,
          "text": "In Da Club ",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "It's Your Birthday",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "I Got The X",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartāls 2000 -2010\\yt5s.com - 50 Cent - In Da Club (Lyrics) (256 kbps).mp3",
        "start_ms": 367000000,
        "duration_ms": 1941680000
      }
    },
    {
      "index": 11,
      "category": "PS ",
      "note_comment": "Nelly  ft. Kelly Rowland - Dilemma (Lyrics)",
      "question_text": "7. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 0,
      "points_low": 0,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Murphy Lee\r\nChristina Milian",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Nelly\r\nKelly Rowland",
          "correctness_percent": 50
        },
        {
          "label": 3,
          "text": "Fabolous\r\nNicole Scherzinger",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "No Matter ",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "All I Think About Is You",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Dilemma",
          "correctness_percent": 50
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartāls 2000 -2010\\yt5s.com - Dilemma (Lyrics) - Nelly  ft. Kelly Rowland (256 kbps).mp3",
        "start_ms": 232000000,
        "duration_ms": 2817310000
      }
    },
    {
      "index": 12,
      "category": "PS ",
      "note_comment": "",
      "question_text": "",
      "points": 15,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Black-Color-Border",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 13,
      "category": "PS ",
      "note_comment": "",
      "question_text": "",
      "points": 15,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Black-Color-Border",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 14,
      "category": "PS ",
      "note_comment": "Beds Are Burning — Midnight Oil",
      "question_text": "1. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Midnight Oil",
          "correctness_percent": 50
        },
        {
          "label": 2,
          "text": "Icehouse",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Hoodoo Gurus",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "How Can We Dance",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Beds Are Burning",
          "correctness_percent": 50
        },
        {
          "label": 6,
          "text": "The Time Has Come",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 70-90\\yt5s.com - Beds Are Burning — Midnight Oil (Lyrics) (256 kbps).mp3",
        "start_ms": 250000000,
        "duration_ms": 2556870000
      }
    },
    {
      "index": 15,
      "category": "PS ",
      "note_comment": "MAGIC! - Rude ",
      "question_text": "2. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Echosmith",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Maroon 5",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "MAGIC!",
          "correctness_percent": 50
        },
        {
          "label": 4,
          "text": "Rude ",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "Can I",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Marry That Girl",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Diwalli 09.07.2022 Arzemju 2010- 2020\\1 MAGIC! - Rude (Lyrics) (256 kbps).mp3",
        "start_ms": 752000000,
        "duration_ms": 2710200000
      }
    },
    {
      "index": 16,
      "category": "PS ",
      "note_comment": "RePublic - Strelniece",
      "question_text": "3. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "RePublic ",
          "correctness_percent": 50
        },
        {
          "label": 2,
          "text": "Monro",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Neptūns",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Bultas",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Še Tev Mana Roka",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Strēlniece",
          "correctness_percent": 50
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartāls 2000 -2010\\1 Strēlniece (256 kbps).mp3",
        "start_ms": 140000000,
        "duration_ms": 2737110000
      }
    },
    {
      "index": 17,
      "category": "PS ",
      "note_comment": "Jon Bon Jovi - Blaze Of Glory",
      "question_text": "4. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Bonfire",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Poison",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Bon Jovi",
          "correctness_percent": 50
        },
        {
          "label": 4,
          "text": "Blaze Of Glory",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "First Blood",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Devil On The Run",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 1990 - 2000 V2\\yt5s.com - Jon Bon Jovi - Blaze Of Glory [Lyrics] (256 kbps).mp3",
        "start_ms": 100000000,
        "duration_ms": 3354650000
      }
    },
    {
      "index": 18,
      "category": "PS ",
      "note_comment": "Bonnie Tyler - Holding Out for a Hero",
      "question_text": "5. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Bonnie Tyler",
          "correctness_percent": 50
        },
        {
          "label": 2,
          "text": "Cyndi Lauper",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Laura Branigan",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Fire In My Blood",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Holding Out for a Hero",
          "correctness_percent": 50
        },
        {
          "label": 6,
          "text": "Rising Odds",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 70-90\\yt5s.com - Bonnie Tyler - Holding Out for a Hero (Official Lyric Video) (256 kbps).mp3",
        "start_ms": 970000000,
        "duration_ms": 3495970000
      }
    },
    {
      "index": 19,
      "category": "PS ",
      "note_comment": "Enrique Iglesias - Hero",
      "question_text": "6. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Marc Anthony",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Ricky Martin",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Enrique Iglesias",
          "correctness_percent": 50
        },
        {
          "label": 4,
          "text": "Hero",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "I Can Be",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Dance With Me",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartāls 2000 -2010\\yt5s.com - Enrique Iglesias - Hero (Lyrics)🎵 (256 kbps).mp3",
        "start_ms": 122000000,
        "duration_ms": 2610680000
      }
    },
    {
      "index": 20,
      "category": "PS ",
      "note_comment": "1 Lil Nas X - Old Town Road (Lyrics) ft. Billy Ray Cyrus (256 kbps)\r\n",
      "question_text": "7. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Post Malone",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Lil Nas X",
          "correctness_percent": 50
        },
        {
          "label": 3,
          "text": "24kGoldn",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Old Town Road",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "Young Boy",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Matte Black",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Diwalli 09.07.2022 Arzemju 2010- 2020\\1 Lil Nas X - Old Town Road (Lyrics) ft. Billy Ray Cyrus (256 kbps).mp3",
        "start_ms": 277000000,
        "duration_ms": 1577260000
      }
    },
    {
      "index": 21,
      "category": "PS ",
      "note_comment": "",
      "question_text": "",
      "points": 15,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Black-Color-Border",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 22,
      "category": "PS ",
      "note_comment": "",
      "question_text": "",
      "points": 15,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Black-Color-Border",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 23,
      "category": "Default Category",
      "note_comment": "",
      "question_text": "",
      "points": 10,
      "points_low": 10,
      "answer_time_seconds": 30,
      "style_name": "QuizXpress",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 24,
      "category": "PS ",
      "note_comment": "Eagles - Hotel California",
      "question_text": "1. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "The Doobie Brothers",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Eagles",
          "correctness_percent": 50
        },
        {
          "label": 3,
          "text": "America",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Such A Lovely Place ",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Highway",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Hotel California",
          "correctness_percent": 50
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 70-90\\yt5s.com - Eagles - Hotel California (Lyrics) (256 kbps).mp3",
        "start_ms": 2000000,
        "duration_ms": 3903730000
      }
    },
    {
      "index": 25,
      "category": "PS ",
      "note_comment": "OneRepublic - Counting Stars",
      "question_text": "2. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Bastille",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "The Script",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "OneRepublic ",
          "correctness_percent": 50
        },
        {
          "label": 4,
          "text": "Counting Stars",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "Feel Alive",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Losing Sleep",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Diwalli 09.07.2022 Arzemju 2010- 2020\\1 OneRepublic - Counting Stars (Lyrics) (256 kbps).mp3",
        "start_ms": 1165000000,
        "duration_ms": 2564700000
      }
    },
    {
      "index": 26,
      "category": "PS ",
      "note_comment": "Red Hot Chili Peppers - Give It Away",
      "question_text": "3. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Red Hot Chili Peppers",
          "correctness_percent": 50
        },
        {
          "label": 2,
          "text": "Rage Against the Machine",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Limp Bizkit",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Kingpin Or A Pauper",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Give It Away",
          "correctness_percent": 50
        },
        {
          "label": 6,
          "text": "Lucky Me",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 1990 - 2000 V2\\yt5s.com - Red Hot Chili Peppers - Give It Away (BEST QUALITY) (256 kbps).mp3",
        "start_ms": 116000000,
        "duration_ms": 2851790000
      }
    },
    {
      "index": 27,
      "category": "PS ",
      "note_comment": "Barbra Streisand - Woman In Love",
      "question_text": "4. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Diana Ross",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Barbra Streisand ",
          "correctness_percent": 50
        },
        {
          "label": 3,
          "text": "Céline Dion",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Woman In Love",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "Life Is A Moment",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "What do I do?",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 70-90\\yt5s.com - Barbra Streisand - Woman In Love _ With Lyrics (256 kbps).mp3",
        "start_ms": 682000000,
        "duration_ms": 2495220000
      }
    },
    {
      "index": 28,
      "category": "PS ",
      "note_comment": "James Blunt - You're Beautiful ",
      "question_text": "5. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Damien Rice",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "James Blunt ",
          "correctness_percent": 50
        },
        {
          "label": 3,
          "text": "Ronan Keating",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "I'll Never Be With You",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "You're Beautiful ",
          "correctness_percent": 50
        },
        {
          "label": 6,
          "text": "My Life Is Brilliant",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartāls 2000 -2010\\yt5s.com - James Blunt - You're Beautiful (Lyrics) (256 kbps).mp3",
        "start_ms": 12000000,
        "duration_ms": 2350760000
      }
    },
    {
      "index": 29,
      "category": "PS ",
      "note_comment": "Lenny Kravitz - I Belong To You",
      "question_text": "6. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Prince",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Lenny Kravitz ",
          "correctness_percent": 50
        },
        {
          "label": 3,
          "text": "Seal",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "I Belong To You",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "Ultimate Star",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Every Way",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 1990 - 2000 V2\\yt5s.com - Lenny Kravitz - I Belong To You (256 kbps).mp3",
        "start_ms": 230000000,
        "duration_ms": 2575200000
      }
    },
    {
      "index": 30,
      "category": "PS ",
      "note_comment": "Nickelback - How You Remind Me",
      "question_text": "7. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "The Calling",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Lifehouse",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Nickelback ",
          "correctness_percent": 50
        },
        {
          "label": 4,
          "text": "How You Remind Me",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "Sorry",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "What I Really Am",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartāls 2000 -2010\\yt5s.com - How You Remind Me - Nickelback (Lyrics) 🎵 (256 kbps).mp3",
        "start_ms": 395000000,
        "duration_ms": 2273960000
      }
    },
    {
      "index": 31,
      "category": "PS ",
      "note_comment": "",
      "question_text": "",
      "points": 15,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Black-Color-Border",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 32,
      "category": "PS ",
      "note_comment": "",
      "question_text": "",
      "points": 15,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Black-Color-Border",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 33,
      "category": "Default Category",
      "note_comment": "",
      "question_text": "",
      "points": 10,
      "points_low": 10,
      "answer_time_seconds": 30,
      "style_name": "QuizXpress",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 34,
      "category": "PS ",
      "note_comment": "DNA, Suzanne Vega - Tom's Diner ",
      "question_text": "1. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Mars\r\nNatalie Merchant",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "DNA\r\nSuzanne Vega",
          "correctness_percent": 50
        },
        {
          "label": 3,
          "text": "This Heat\r\nTanita Tikaram",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Tom's Diner ",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "Once Upon",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Nice To See You",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 1990 - 2000 V2\\yt5s.com - DNA, Suzanne Vega - Tom's Diner (Lyrics) (256 kbps).mp3",
        "start_ms": 0,
        "duration_ms": 2281010000
      }
    },
    {
      "index": 35,
      "category": "PS ",
      "note_comment": "Reigani - Es Eju Kost ",
      "question_text": "2. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Reigani",
          "correctness_percent": 50
        },
        {
          "label": 2,
          "text": "Re:public",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Čiekuri",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "32. istaba",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Ruta",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Es Eju Kost ",
          "correctness_percent": 50
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 1990 - 2000 V2\\yt5s.com - Reigani - Es Eju Kost (256 kbps).mp3",
        "start_ms": 77000000,
        "duration_ms": 2133420000
      }
    },
    {
      "index": 36,
      "category": "PS ",
      "note_comment": "Lady Gaga - Poker Face ",
      "question_text": "3. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Eva Simons",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Jessie J",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Lady Gaga",
          "correctness_percent": 50
        },
        {
          "label": 4,
          "text": "Poker Face ",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "I Wanna Roll",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "They Can't Read",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartāls 2000 -2010\\yt5s.com - Lady Gaga - Poker Face (Lyrics) (256 kbps).mp3",
        "start_ms": 810000000,
        "duration_ms": 2690610000
      }
    },
    {
      "index": 37,
      "category": "PS ",
      "note_comment": "Thrift Shop - Macklemore & Ryan Lewis ft Wanz ",
      "question_text": "4. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Macklemore",
          "correctness_percent": 50
        },
        {
          "label": 2,
          "text": "Gym Class Heroes",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Chance the Rapper",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Thrift Shop",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "Empty Pocket",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "20 Dollars ",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Diwalli 09.07.2022 Arzemju 2010- 2020\\1 Thrift Shop - Macklemore & Ryan Lewis ft Wanz (Lyrics) (256 kbps).mp3",
        "start_ms": 386000000,
        "duration_ms": 2485290000
      }
    },
    {
      "index": 38,
      "category": "PS ",
      "note_comment": "In The Air Tonight - Phil Collins",
      "question_text": "5. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Mr. Mister",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Phil Collins",
          "correctness_percent": 50
        },
        {
          "label": 3,
          "text": "Lionel Richie",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "I Can Feel It",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Stranger",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "In The Air Tonight",
          "correctness_percent": 50
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 70-90\\yt5s.com - In The Air Tonight - Phil Collins (Lyrics) [HD] (256 kbps).mp3",
        "start_ms": 765000000,
        "duration_ms": 2865630000
      }
    },
    {
      "index": 39,
      "category": "PS ",
      "note_comment": "Dālderi - Dzeltenie Aizkari\r\n",
      "question_text": "6. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Dālderi\r\n",
          "correctness_percent": 50
        },
        {
          "label": 2,
          "text": "Eolika\r\n",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Ornaments\r\n",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Tu tikai skudru nesamin\r\n",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Tajā zaļajā ielejā\r\n",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Dzeltenie aizkari\r\n",
          "correctness_percent": 50
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 70-90\\1 Dālderi - Dzeltenie Aizkari (256 kbps).mp3",
        "start_ms": 110000000,
        "duration_ms": 2865370000
      }
    },
    {
      "index": 40,
      "category": "PS ",
      "note_comment": "Shawn Mendes - There's Nothing Holdin' Me Back\r\n ",
      "question_text": "7. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Shawn Mendes",
          "correctness_percent": 50
        },
        {
          "label": 2,
          "text": "Charlie Puth",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Ed Sheeran",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Shaking",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "There's Nothing \r\nHoldin' Me Back",
          "correctness_percent": 50
        },
        {
          "label": 6,
          "text": "I Love It",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Diwalli 09.07.2022 Arzemju 2010- 2020\\1 Shawn Mendes - There's Nothing Holdin' Me Back (Lyrics) (256 kbps).mp3",
        "start_ms": 399000000,
        "duration_ms": 2052180000
      }
    },
    {
      "index": 41,
      "category": "PS ",
      "note_comment": "",
      "question_text": "",
      "points": 15,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Black-Color-Border",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 42,
      "category": "PS ",
      "note_comment": "",
      "question_text": "",
      "points": 15,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Black-Color-Border",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 43,
      "category": "Default Category",
      "note_comment": "",
      "question_text": "",
      "points": 10,
      "points_low": 10,
      "answer_time_seconds": 30,
      "style_name": "QuizXpress",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 44,
      "category": "PS ",
      "note_comment": "Deep Purple - Smoke On The Water",
      "question_text": "1. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Led Zeppelin",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Scorpions",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Deep Purple",
          "correctness_percent": 50
        },
        {
          "label": 4,
          "text": "Awful Sound",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Smoke On The Water",
          "correctness_percent": 50
        },
        {
          "label": 6,
          "text": "Montreux",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas Kvartals 70-90 V2\\yt5s.com - Deep Purple - Smoke On The Water Lyrics (256 kbps).mp3",
        "start_ms": 4000000,
        "duration_ms": 2903770000
      }
    },
    {
      "index": 45,
      "category": "PS ",
      "note_comment": "Far East Movement - Like A G6 ft. The Cataracs, DEV ",
      "question_text": "2. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Far East Movement ",
          "correctness_percent": 50
        },
        {
          "label": 2,
          "text": "Jack Ü",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "LMFAO",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Gimme That",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Like A G6",
          "correctness_percent": 50
        },
        {
          "label": 6,
          "text": "On Repeat",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Diwalli 09.07.2022 Arzemju 2010- 2020\\2 Far East Movement - Like A G6 (Lyrics) ft. The Cataracs, DEV (256 kbps) (1).mp3",
        "start_ms": 313000000,
        "duration_ms": 2500960000
      }
    },
    {
      "index": 46,
      "category": "PS ",
      "note_comment": "Aerosmith - I Don't Want to Miss a Thing",
      "question_text": "3. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Scorpions",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Guns N' Roses",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Aerosmith",
          "correctness_percent": 50
        },
        {
          "label": 4,
          "text": "Right Here With You",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "I Don't Want To \r\nMiss A Thing",
          "correctness_percent": 50
        },
        {
          "label": 6,
          "text": "Still Miss You Baby",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 1990 - 2000 V2\\yt5s.com - Aerosmith - I Don't Want to Miss a Thing (Audio) (256 kbps).mp3",
        "start_ms": 482000000,
        "duration_ms": 2998340000
      }
    },
    {
      "index": 47,
      "category": "PS ",
      "note_comment": "Dj Bobo - Everybody",
      "question_text": "4. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Dj Bobo",
          "correctness_percent": 50
        },
        {
          "label": 2,
          "text": "Fun Factory",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "C-Block",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Summer Romance",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Everybody",
          "correctness_percent": 50
        },
        {
          "label": 6,
          "text": "Music Is What I'm \r\nLiving For",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 1990 - 2000 V2\\yt5s.com - Dj Bobo - Everybody (tradução) Lyrics (256 kbps).mp3",
        "start_ms": 765000000,
        "duration_ms": 2288590000
      }
    },
    {
      "index": 48,
      "category": "PS ",
      "note_comment": "Leonard Cohen - Dance Me to the End of Love",
      "question_text": "5. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Lou Reed",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Van Morrison",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Leonard Cohen",
          "correctness_percent": 50
        },
        {
          "label": 4,
          "text": "Dance Me to the \r\nEnd of Love",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "Your Beauty",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Shelter",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 70-90\\yt5s.com - Leonard Cohen - Dance Me to the End of Love🎵(Lyrics) (256 kbps).mp3",
        "start_ms": 550000000,
        "duration_ms": 2560260000
      }
    },
    {
      "index": 49,
      "category": "PS ",
      "note_comment": "Sean Kingston - Beautiful Girls",
      "question_text": "6. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Sean Kingston",
          "correctness_percent": 50
        },
        {
          "label": 2,
          "text": "Travie McCoy",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Omarion",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Tell Me Why",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "It Will Never Works",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Beautiful Girls",
          "correctness_percent": 50
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartāls 2000 -2010\\yt5s.com - Sean Kingston - Beautiful Girls (Lyrics) (256 kbps).mp3",
        "start_ms": 334500000,
        "duration_ms": 2737630000
      }
    },
    {
      "index": 50,
      "category": "PS ",
      "note_comment": "Drake – In My Feelings ",
      "question_text": "7. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Kanye West",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Lil Wayne",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Drake ",
          "correctness_percent": 50
        },
        {
          "label": 4,
          "text": "Down For You",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "In My Feelings ",
          "correctness_percent": 50
        },
        {
          "label": 6,
          "text": "Do You Love Me?",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Diwalli 09.07.2022 Arzemju 2010- 2020\\2 Drake – In My Feelings (Lyrics) (256 kbps).mp3",
        "start_ms": 115000000,
        "duration_ms": 2175220000
      }
    },
    {
      "index": 51,
      "category": "PS ",
      "note_comment": "",
      "question_text": "",
      "points": 15,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Black-Color-Border",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 52,
      "category": "PS ",
      "note_comment": "",
      "question_text": "",
      "points": 15,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Black-Color-Border",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 53,
      "category": "Default Category",
      "note_comment": "",
      "question_text": "",
      "points": 10,
      "points_low": 10,
      "answer_time_seconds": 30,
      "style_name": "QuizXpress",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 54,
      "category": "PS ",
      "note_comment": "Baby One More Time - Britney Spears ",
      "question_text": "1. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Britney Spears ",
          "correctness_percent": 50
        },
        {
          "label": 2,
          "text": "Jessica Simpson",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Christina Aguilera",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Give Me A Sign",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Baby One More Time",
          "correctness_percent": 50
        },
        {
          "label": 6,
          "text": "Loneliness",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartāls 1990 - 2000\\yt5s.com - Baby One More Time - Britney Spears (Lyrics) (256 kbps).mp3",
        "start_ms": 103000000,
        "duration_ms": 2115140000
      }
    },
    {
      "index": 55,
      "category": "PS ",
      "note_comment": "U2 - With Or Without You",
      "question_text": "2. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "INXS",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "U2",
          "correctness_percent": 50
        },
        {
          "label": 3,
          "text": "The Police",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "With Or Without You",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "You Give \r\nYourself Away",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "I'll Wait For You",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 70-90\\yt5s.com - U2 - With Or Without You (Lyrics) (256 kbps).mp3",
        "start_ms": 1317000000,
        "duration_ms": 2915530000
      }
    },
    {
      "index": 56,
      "category": "PS ",
      "note_comment": "Fedde Le Grand - Put Your Hands Up 4 Detroit",
      "question_text": "3. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Bingo Players",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Oliver Heldens",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Fedde Le Grand",
          "correctness_percent": 50
        },
        {
          "label": 4,
          "text": "Put Your Hands Up\r\n for Detroit",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "Our Lovely City",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "At Night",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartāls 2000 -2010\\Fedde Le Grand - Put Your Hands Up 4 Detroit (256 kbps).mp3",
        "start_ms": 310000000,
        "duration_ms": 1623510000
      }
    },
    {
      "index": 57,
      "category": "PS ",
      "note_comment": "Roberts Gobziņš (East Bam) - Aka Aka",
      "question_text": "4. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "East Bam",
          "correctness_percent": 50
        },
        {
          "label": 2,
          "text": "UFO",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "F*ck Art",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Aka Aka",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "Pumpē, Pumpē",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Purva Āzis",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 1990 - 2000 V2\\yt5s.com - Roberts Gobziņš (East Bam) - Aka Aka (jauna skaņa) (256 kbps).mp3",
        "start_ms": 400000000,
        "duration_ms": 2144390000
      }
    },
    {
      "index": 58,
      "category": "PS ",
      "note_comment": "Adrians Kukuvass - Piezvani man",
      "question_text": "5. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 0,
      "points_low": 0,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Rolands Zagorskis\r\n",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Adrians Kukuvass\r\n",
          "correctness_percent": 50
        },
        {
          "label": 3,
          "text": "Kaspars Dimiters\r\n",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Vientuļnieka dziesma\r\n",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Kad Tev ir skumji\r\n",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Piezvani man!\r\n",
          "correctness_percent": 50
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 70-90\\1 Adrians Kukuvass - Piezvani man (256 kbps).mp3",
        "start_ms": 295000000,
        "duration_ms": 2774200000
      }
    },
    {
      "index": 59,
      "category": "PS ",
      "note_comment": "Flo Rida - Low ft. T-Pain [Apple Bottom Jeans]",
      "question_text": "6. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "will.i.am",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Flo Rida",
          "correctness_percent": 50
        },
        {
          "label": 3,
          "text": "Pitbull",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Low",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "Next Thing You Know",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "She Had Them",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartāls 2000 -2010\\yt5s.com - Flo Rida - Low ft. T-Pain [Apple Bottom Jeans] (Lyrics) (256 kbps).mp3",
        "start_ms": 1050000000,
        "duration_ms": 2304510000
      }
    },
    {
      "index": 60,
      "category": "PS ",
      "note_comment": "Carly Rae Jepsen \"Call Me Maybe\"",
      "question_text": "7. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Sky Ferreira",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Rebecca Black",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Carly Rae Jepsen",
          "correctness_percent": 50
        },
        {
          "label": 4,
          "text": "Crazy",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "I Just Met You",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Call Me Maybe",
          "correctness_percent": 50
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Diwalli 09.07.2022 Arzemju 2010- 2020\\5 Carly Rae Jepsen _Call Me Maybe_ (Official Audio) (256 kbps).mp3",
        "start_ms": 640000000,
        "duration_ms": 1947950000
      }
    },
    {
      "index": 61,
      "category": "PS ",
      "note_comment": "",
      "question_text": "",
      "points": 15,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Black-Color-Border",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 62,
      "category": "PS ",
      "note_comment": "",
      "question_text": "",
      "points": 15,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Black-Color-Border",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 63,
      "category": "Default Category",
      "note_comment": "",
      "question_text": "",
      "points": 10,
      "points_low": 10,
      "answer_time_seconds": 30,
      "style_name": "QuizXpress",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 64,
      "category": "PS ",
      "note_comment": "Men At Work - Down Under",
      "question_text": "1. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Men At Work",
          "correctness_percent": 50
        },
        {
          "label": 2,
          "text": "Big Country ",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Dire Straits",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Down Under",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "Where Do You\r\n Come From",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Take Cover",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas Kvartals 70-90 V2\\yt5s.com - Men At Work - Down Under (Lyrics) (256 kbps).mp3",
        "start_ms": 20000000,
        "duration_ms": 2195070000
      }
    },
    {
      "index": 65,
      "category": "PS ",
      "note_comment": "Pussycat Dolls - Don’t Cha",
      "question_text": "2. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Jennifer Lopez",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Pussycat Dolls",
          "correctness_percent": 50
        },
        {
          "label": 3,
          "text": "Fergie",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "You Should Be My",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "I Know",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Don’t Cha",
          "correctness_percent": 50
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartāls 2000 -2010\\yt5s.com - Pussycat Dolls - Don’t Cha (Lyrics) (256 kbps).mp3",
        "start_ms": 320000000,
        "duration_ms": 2212830000
      }
    },
    {
      "index": 66,
      "category": "PS ",
      "note_comment": "Icona Pop - I Love It (Feat. Charli XCX) ",
      "question_text": "3. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Robyn",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Icona Pop",
          "correctness_percent": 50
        },
        {
          "label": 3,
          "text": "Dragonette",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "I Love It",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "This Feeling",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "I Don't Care",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Diwalli 09.07.2022 Arzemju 2010- 2020\\2 Icona Pop - I Love It (Feat. Charli XCX)  [Audio] (256 kbps).mp3",
        "start_ms": 82000000,
        "duration_ms": 1558990000
      }
    },
    {
      "index": 67,
      "category": "PS ",
      "note_comment": "Eiffel 65 - Blue (Da Ba Dee)",
      "question_text": "4. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "O-Zone",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Eiffel 65",
          "correctness_percent": 50
        },
        {
          "label": 3,
          "text": "Gigi D'Agostino",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "People Of Blue World",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Blue",
          "correctness_percent": 50
        },
        {
          "label": 6,
          "text": "Little Guy",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartāls 1990 - 2000\\yt5s.com - Eiffel 65 - Blue (Da Ba Dee) (Lyrics) (256 kbps).mp3",
        "start_ms": 820000000,
        "duration_ms": 3160560000
      }
    },
    {
      "index": 68,
      "category": "PS ",
      "note_comment": " Don't Speak - No Doubt",
      "question_text": "5. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Guano Apes",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "The Cranberries",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "No Doubt",
          "correctness_percent": 50
        },
        {
          "label": 4,
          "text": "Cause It Hurts",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": " Don't Speak",
          "correctness_percent": 50
        },
        {
          "label": 6,
          "text": "Always",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartāls 1990 - 2000\\yt5s.com - Don't Speak - No Doubt (Lyrics) (256 kbps).mp3",
        "start_ms": 695000000,
        "duration_ms": 2632100000
      }
    },
    {
      "index": 69,
      "category": "PS ",
      "note_comment": "H2O - Uzmini nu",
      "question_text": "6. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Tumsa",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Detlef Zoo\r\n",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "H2O\r\n",
          "correctness_percent": 50
        },
        {
          "label": 4,
          "text": "Tici sev\r\n",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Kas tas ir?",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Uzmini nu\r\n",
          "correctness_percent": 50
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartāls 2000 -2010\\1 Uzmini Nu (256 kbps).mp3",
        "start_ms": 235000000,
        "duration_ms": 2461780000
      }
    },
    {
      "index": 70,
      "category": "PS ",
      "note_comment": "Culture Club Do You Really Want To Hurt Me",
      "question_text": "7. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Dead or Alive",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Culture Club",
          "correctness_percent": 50
        },
        {
          "label": 3,
          "text": "Wham!",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Do You Really Want \r\nTo Hurt Me",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "Precious Kisses",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Step Too Far",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas Kvartals 70-90 V2\\yt5s.com - Culture Club Do You Really Want To Hurt Me Lyrics Scrolling (256 kbps).mp3",
        "start_ms": 492000000,
        "duration_ms": 2696100000
      }
    },
    {
      "index": 71,
      "category": "PS ",
      "note_comment": "",
      "question_text": "",
      "points": 15,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Black-Color-Border",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 72,
      "category": "PS ",
      "note_comment": "",
      "question_text": "",
      "points": 15,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Black-Color-Border",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 73,
      "category": "Default Category",
      "note_comment": "",
      "question_text": "",
      "points": 10,
      "points_low": 10,
      "answer_time_seconds": 30,
      "style_name": "QuizXpress",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 74,
      "category": "PS ",
      "note_comment": "Guns N' Roses - November Rain",
      "question_text": "1. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Ozzy Osbourne",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Velvet Revolver",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Guns N' Roses",
          "correctness_percent": 50
        },
        {
          "label": 4,
          "text": "Your Eyes",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "November Rain",
          "correctness_percent": 50
        },
        {
          "label": 6,
          "text": "I Feel The Same",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartāls 1990 - 2000\\yt5s.com - Guns N' Roses - November Rain (lyrics) (256 kbps).mp3",
        "start_ms": 720000000,
        "duration_ms": 5302070000
      }
    },
    {
      "index": 75,
      "category": "PS ",
      "note_comment": "Los Del Rio - Macarena ",
      "question_text": "2. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Los Del Rio",
          "correctness_percent": 50
        },
        {
          "label": 2,
          "text": "Las Ketchup",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Captain Jack",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Cuerpo Alegría",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Macarena ",
          "correctness_percent": 50
        },
        {
          "label": 6,
          "text": "Salsa",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartāls 1990 - 2000\\yt5s.com - Los Del Rio - Macarena ( lyrics ) Bayside Boys Remix (256 kbps).mp3",
        "start_ms": 10000000,
        "duration_ms": 2374790000
      }
    },
    {
      "index": 76,
      "category": "PS ",
      "note_comment": "Mr. Probz (Robin Schulz) Waves ",
      "question_text": "3. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Sam Feldt",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Chris Lake",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Mr. Probz",
          "correctness_percent": 50
        },
        {
          "label": 4,
          "text": "Waves ",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "Alright",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Slowly Drifting",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Diwalli 09.07.2022 Arzemju 2010- 2020\\3 Waves (Lyrics) - Mr. Probz (Robin Schulz Radio Edit) (256 kbps).mp3",
        "start_ms": 730000000,
        "duration_ms": 2084570000
      }
    },
    {
      "index": 77,
      "category": "PS ",
      "note_comment": "Usher - Yeah! (Lyrics) ft. Lil Jon, Ludacris\r\n",
      "question_text": "4. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Chris Brown",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Ne-Yo",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Usher ",
          "correctness_percent": 50
        },
        {
          "label": 4,
          "text": "I Said",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Yeah!",
          "correctness_percent": 50
        },
        {
          "label": 6,
          "text": "Up In The Club",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartāls 2000 -2010\\yt5s.com - Usher - Yeah! (Lyrics) ft. Lil Jon, Ludacris (256 kbps).mp3",
        "start_ms": 190000000,
        "duration_ms": 2823060000
      }
    },
    {
      "index": 78,
      "category": "PS ",
      "note_comment": "Whitesnake-Is This Love",
      "question_text": "5. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Whitesnake",
          "correctness_percent": 50
        },
        {
          "label": 2,
          "text": "Bon Jovi",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Deep Purple",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "In My Arms",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Hold On Me",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Is This Love",
          "correctness_percent": 50
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 70-90\\yt5s.com - Whitesnake-Is This Love (lyrics) (256 kbps).mp3",
        "start_ms": 1148000000,
        "duration_ms": 2744420000
      }
    },
    {
      "index": 79,
      "category": "PS ",
      "note_comment": "Balta saule - Margarita Vilcāne",
      "question_text": "6. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Ira Krauja\r\n",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Margarita Vilcāne",
          "correctness_percent": 50
        },
        {
          "label": 3,
          "text": "Nora Bumbiere\r\n",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Balta saule",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "Starp mūžībām divām\r\n",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Kā gulbji balti \r\npadebeši iet\r\n",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 70-90\\1 Balta saule - Margarita Vilcāne (256 kbps).mp3",
        "start_ms": 590000000,
        "duration_ms": 2270300000
      }
    },
    {
      "index": 80,
      "category": "PS ",
      "note_comment": "Luis Fonsi - Despacito ft. Daddy Yankee (256 kbps)",
      "question_text": "7. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Carlos Rivera",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Luis Fonsi",
          "correctness_percent": 50
        },
        {
          "label": 3,
          "text": "David Bisbal",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Quiero",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Tengo Que",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Despacito",
          "correctness_percent": 50
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Diwalli 09.07.2022 Arzemju 2010- 2020\\2 Luis Fonsi - Despacito ft. Daddy Yankee (256 kbps).mp3",
        "start_ms": 524000000,
        "duration_ms": 2819930000
      }
    },
    {
      "index": 81,
      "category": "PS ",
      "note_comment": "",
      "question_text": "",
      "points": 15,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Black-Color-Border",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 82,
      "category": "PS ",
      "note_comment": "",
      "question_text": "",
      "points": 15,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Black-Color-Border",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 83,
      "category": "Default Category",
      "note_comment": "",
      "question_text": "",
      "points": 10,
      "points_low": 10,
      "answer_time_seconds": 30,
      "style_name": "QuizXpress",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 84,
      "category": "PS ",
      "note_comment": "Nirvana - Smells Like Teen Spirit",
      "question_text": "1. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Soundgarden",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Nirvana",
          "correctness_percent": 50
        },
        {
          "label": 3,
          "text": "Alice in Chains",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Smells Like Teen Spirit",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "Hello",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "My Libido",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartāls 1990 - 2000\\yt5s.com - Nirvana - Smells Like Teen Spirit (Lyrics) (256 kbps).mp3",
        "start_ms": 993000000,
        "duration_ms": 3318070000
      }
    },
    {
      "index": 85,
      "category": "PS ",
      "note_comment": " Get Busy - Sean Paul ",
      "question_text": "2. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Beenie Man",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Shaggy",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Sean Paul",
          "correctness_percent": 50
        },
        {
          "label": 4,
          "text": "Turn Me On",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Shake Dat Booty",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Get Busy",
          "correctness_percent": 50
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartāls 2000-2010\\yt5s.com - Get Busy - Sean Paul  (256 kbps).mp3",
        "start_ms": 727000000,
        "duration_ms": 2116180000
      }
    },
    {
      "index": 86,
      "category": "PS ",
      "note_comment": "ABBA - Mamma Mia",
      "question_text": "3. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "ABBA",
          "correctness_percent": 50
        },
        {
          "label": 2,
          "text": "Blondie",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Kim Wilde",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "One more look",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Here I go again",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Mamma mia",
          "correctness_percent": 50
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 70-90\\yt5s.com - ABBA - Mamma Mia (Lyrics) (256 kbps).mp3",
        "start_ms": 887000000,
        "duration_ms": 2141260000
      }
    },
    {
      "index": 87,
      "category": "PS ",
      "note_comment": "Starship - Nothing's Gonna Stop Us Now ",
      "question_text": "4. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Survivor",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Starship",
          "correctness_percent": 50
        },
        {
          "label": 3,
          "text": "Foreigner",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Nothing's Gonna \r\nStop Us Now ",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "Let's Build This \r\nDream Together",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "We're Crazy",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 70-90\\yt5s.com - Starship - Nothing's Gonna Stop Us Now (Remastered Audio) (256 kbps).mp3",
        "start_ms": 429000000,
        "duration_ms": 2695840000
      }
    },
    {
      "index": 88,
      "category": "PS ",
      "note_comment": "Harry Styles - Watermelon Sugar",
      "question_text": "5. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Harry Styles",
          "correctness_percent": 50
        },
        {
          "label": 2,
          "text": "Nick Jonas",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Shawn Mendes",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Strawberries",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Breathe Me In",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Watermelon Sugar",
          "correctness_percent": 50
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Diwalli 09.07.2022 Arzemju 2010- 2020\\5 Harry Styles - Watermelon Sugar (Official Audio) (256 kbps).mp3",
        "start_ms": 516000000,
        "duration_ms": 1741060000
      }
    },
    {
      "index": 89,
      "category": "PS ",
      "note_comment": "Lou Bega - Mambo No. 5 ( A little bit )",
      "question_text": "6. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Alvaro Soler",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Kaoma",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Lou Bega",
          "correctness_percent": 50
        },
        {
          "label": 4,
          "text": "Everybody",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Coco Bango",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Mambo No. 5",
          "correctness_percent": 50
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartāls 1990 - 2000\\yt5s.com - Lou Bega - Mambo No. 5 ( A little bit ) ( Lyrics Video ) (256 kbps).mp3",
        "start_ms": 3000000,
        "duration_ms": 2117220000
      }
    },
    {
      "index": 90,
      "category": "PS ",
      "note_comment": "Intars Busulis - Dejo Vientulību",
      "question_text": "7. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Intars Busulis",
          "correctness_percent": 50
        },
        {
          "label": 2,
          "text": "Andis Grīva",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Renārs Kaupers",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Dejo vientulību",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "Aizveru acis",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Celies un ej",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Diwalli 09.07.2022 Arzemju 2010- 2020\\4 Intars Busulis - Dejo Vientulību (256 kbps).mp3",
        "start_ms": 1390000000,
        "duration_ms": 2736070000
      }
    },
    {
      "index": 91,
      "category": "PS ",
      "note_comment": "",
      "question_text": "",
      "points": 15,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Black-Color-Border",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 92,
      "category": "PS ",
      "note_comment": "",
      "question_text": "",
      "points": 15,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Black-Color-Border",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 93,
      "category": "Default Category",
      "note_comment": "",
      "question_text": "",
      "points": 10,
      "points_low": 10,
      "answer_time_seconds": 30,
      "style_name": "QuizXpress",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    },
    {
      "index": 94,
      "category": "PS ",
      "note_comment": "Depeche Mode - Enjoy the Silence ",
      "question_text": "1. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 0,
      "points_low": 0,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "New Order",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Depeche Mode ",
          "correctness_percent": 50
        },
        {
          "label": 3,
          "text": "Pet Shop Boys",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "In My Arms",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Violence",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Enjoy The Silence ",
          "correctness_percent": 50
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartāls 1990 - 2000\\yt5s.com - Depeche Mode - Enjoy the Silence (lyrics) (256 kbps).mp3",
        "start_ms": 2000000,
        "duration_ms": 2553990000
      }
    },
    {
      "index": 95,
      "category": "PS ",
      "note_comment": "Mundiya Tu Bach ke - Panjabi MC",
      "question_text": "2. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "One-T ",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Daler Mehndi",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Panjabi MC",
          "correctness_percent": 50
        },
        {
          "label": 4,
          "text": "Ull The Muri Gemmi ",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": " Mundiya Tu Bach Ke",
          "correctness_percent": 50
        },
        {
          "label": 6,
          "text": "Rahi",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartāls 2000-2010\\yt5s.com - Mundiya Tu Bach ke - Panjabi MC.mp3",
        "start_ms": 654000000,
        "duration_ms": 2450550000
      }
    },
    {
      "index": 96,
      "category": "PS ",
      "note_comment": "Bastille - Pompeii",
      "question_text": "3. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Glass Animals",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Bastille ",
          "correctness_percent": 50
        },
        {
          "label": 3,
          "text": "Hurts",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Pompeii",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "If You Close Your Eyes",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "World Around Us ",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Diwalli 09.07.2022 Arzemju 2010- 2020\\5 Bastille - Pompeii (Lyrics) (320 kbps).mp3",
        "start_ms": 485000000,
        "duration_ms": 2128550000
      }
    },
    {
      "index": 97,
      "category": "PS ",
      "note_comment": " In-Grid - Tu Es Foutu",
      "question_text": "4. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Alizée",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "Kate Ryan",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": " In-Grid",
          "correctness_percent": 50
        },
        {
          "label": 4,
          "text": "Tu M'as Promis",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Pas De Chance",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Tu Es Foutu",
          "correctness_percent": 50
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartāls 2000-2010\\yt5s.com - In-Grid- Tu es foutu (Radio Edit) (256 kbps).mp3",
        "start_ms": 165000000,
        "duration_ms": 2187230000
      }
    },
    {
      "index": 98,
      "category": "PS ",
      "note_comment": "Woman (Lyrics) - John Lennon",
      "question_text": "5. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "The Kinks",
          "correctness_percent": 0
        },
        {
          "label": 2,
          "text": "John Lennon",
          "correctness_percent": 50
        },
        {
          "label": 3,
          "text": "Simon & Garfunkel",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Woman ",
          "correctness_percent": 50
        },
        {
          "label": 5,
          "text": "Now And Forever",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "Well Well",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas kvartals 70-90\\yt5s.com - Woman (Lyrics) - John Lennon (256 kbps).mp3",
        "start_ms": 1560000000,
        "duration_ms": 2064980000
      }
    },
    {
      "index": 99,
      "category": "PS ",
      "note_comment": "MUSIQQ No 10-10 \r\n ",
      "question_text": "6. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Musiqq",
          "correctness_percent": 50
        },
        {
          "label": 2,
          "text": "Device",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Bermudu Divstūris",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "Savējie sapratīs",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "No 10-10 ",
          "correctness_percent": 50
        },
        {
          "label": 6,
          "text": "Abrakadabra",
          "correctness_percent": 0
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Diwalli 09.07.2022 Arzemju 2010- 2020\\4 MUSIQQ No 10-10  (Official video) (256 kbps).mp3",
        "start_ms": 481000000,
        "duration_ms": 2349190000
      }
    },
    {
      "index": 100,
      "category": "PS ",
      "note_comment": "The Best - Tina Turner",
      "question_text": "7. Kurš ir izpildītājs un kāds ir dziesmas nosaukums?",
      "points": 20,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Music II",
      "answers": [
        {
          "label": 1,
          "text": "Tina Turner",
          "correctness_percent": 50
        },
        {
          "label": 2,
          "text": "Whitney Houston",
          "correctness_percent": 0
        },
        {
          "label": 3,
          "text": "Annie Lennox",
          "correctness_percent": 0
        },
        {
          "label": 4,
          "text": "No Better Place",
          "correctness_percent": 0
        },
        {
          "label": 5,
          "text": "Tear Us Apart",
          "correctness_percent": 0
        },
        {
          "label": 6,
          "text": "The Best",
          "correctness_percent": 50
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": {
        "file_path": "C:\\Users\\prata\\OneDrive\\Dators\\Tallinas Kvartals 70-90 V2\\yt5s.com - The Best - Tina Turner (Lyrics) (256 kbps).mp3",
        "start_ms": 370000000,
        "duration_ms": 2471170000
      }
    },
    {
      "index": 101,
      "category": "PS ",
      "note_comment": "",
      "question_text": "",
      "points": 15,
      "points_low": 1,
      "answer_time_seconds": 30,
      "style_name": "Black-Color-Border",
      "answers": [
        {
          "label": 1,
          "text": "Answer A",
          "correctness_percent": 100
        },
        {
          "label": 2,
          "text": "Answer B",
          "correctness_percent": 100
        },
        {
          "label": 3,
          "text": "Answer C",
          "correctness_percent": 100
        },
        {
          "label": 4,
          "text": "Answer D",
          "correctness_percent": 100
        },
        {
          "label": 5,
          "text": "Answer E",
          "correctness_percent": 100
        },
        {
          "label": 6,
          "text": "Answer F",
          "correctness_percent": 100
        },
        {
          "label": 7,
          "text": "Answer G",
          "correctness_percent": 100
        }
      ],
      "sound": null
    }
  ]
}*/
;

// 2. AUTOMĀTISKĀ PĀRVEIDOŠANA UZ EVENT STUDIO FORMĀTU
console.log('Sākam konvertēt QuizXpress datus...');

const convertedScenes = rawQuizData.slides.map((sl, idx) => {
  const isQuestion = sl.question_text && sl.question_text.trim() !== '' && sl.question_text !== 'Put your question here';
  const isFinal = idx === rawQuizData.slides.length - 1;
  
  // Kārtu noslēgumi (pēc katrām 7 dziesmām)
  const isRoundEnd = !isQuestion && (idx === 3 || idx === 11 || idx === 20 || idx === 30 || idx === 40 || idx === 50 || idx === 60 || idx === 70 || idx === 80 || idx === 90 || idx === 100);

  // Līderu tabulas un pauzes
  if (!isQuestion) {
    if (isFinal || isRoundEnd) {
      return {
        id: `slide-${idx + 1}`,
        title: isFinal ? '🏆 FINĀLA KOPVĒRTĒJUMS' : `Kārtas Rezultāti`,
        type: 'LEADERBOARD',
        config: {
          lbType: isFinal ? 'FINAL' : 'ROUND',
          duration: 30,
          points: 0,
          optionsCount: 0,
          options: [],
          correctAnswers: [],
          layout: []
        }
      };
    }
    return {
      id: `slide-${idx + 1}`,
      title: `Pauze / Ievads`,
      type: 'BILLBOARD',
      config: {
        duration: 30,
        points: 0,
        optionsCount: 0,
        options: [],
        correctAnswers: [],
        layout: [
          {
            id: `txt-${idx}`,
            type: 'TEXT',
            content: sl.category || 'MŪZIKAS ŠOVS',
            x: 15, y: 35, w: 70, h: 20,
            fontSize: 3.5,
            color: '#ffc107',
            bgColor: '#000000',
            bgOpacity: 70,
            visibility: 'ALWAYS'
          }
        ]
      }
    };
  }

  // 6 īstie varianti (noņemam 'Answer G')
  const validAnswers = (sl.answers || [])
    .filter((a) => a.text && a.text !== 'Answer G' && a.text.trim() !== '')
    .slice(0, 6);

  const options = validAnswers.map((a) => a.text.replace(/\r\n/g, ' ').trim());
  const correctAnswers = validAnswers
    .filter((a) => a.correctness_percent > 0)
    .map((a) => a.text.replace(/\r\n/g, ' ').trim());

  const answerCorrectness = {};
  validAnswers.forEach((a) => {
    if (a.correctness_percent > 0) {
      answerCorrectness[a.text.replace(/\r\n/g, ' ').trim()] = a.correctness_percent;
    }
  });

  const layout = [
    {
      id: `q-${idx}`,
      type: 'QUESTION',
      content: sl.question_text.trim(),
      x: 15, y: 10, w: 70, h: 16,
      fontSize: 2.2,
      fontFamily: 'Segoe UI',
      color: '#ffffff',
      bgColor: '#000000',
      bgOpacity: 80,
      visibility: 'ALWAYS'
    }
  ];

  // Piesaistām audio failu un aprēķinām sākuma sekundi (dalot ar 10 000 000)
  if (sl.sound && sl.sound.file_path) {
    const fileName = path.basename(sl.sound.file_path);
    const trimStartSec = Number(((sl.sound.start_ms || 0) / 10000000).toFixed(2));
    const trimEndSec = Number((trimStartSec + (sl.answer_time_seconds || 30)).toFixed(2));

    layout.push({
      id: `audio-${idx}`,
      type: 'AUDIO',
      content: fileName,
      x: 30, y: 30, w: 40, h: 12,
      volume: 100,
      trimStart: trimStartSec,
      trimEnd: trimEndSec,
      visibility: 'ALWAYS'
    });
  }

  return {
    id: `slide-${idx + 1}`,
    title: sl.note_comment ? `${idx + 1}. ${sl.note_comment}` : `${idx + 1}. Jautājums`,
    type: 'QUESTION',
    config: {
      duration: sl.answer_time_seconds || 30,
      points: sl.points || 20,
      pointsMin: sl.points_low || 1,
      pointsMax: sl.points || 20,
      scoringMode: sl.points > sl.points_low ? 'DECREASING' : 'FIXED',
      speedBonusEnabled: true,
      optionsCount: options.length,
      options: options,
      correctAnswers: correctAnswers,
      answerCorrectness: answerCorrectness,
      optionsLayout: 'GRID',
      optionsPositions: {},
      layout: layout
    }
  };
});

const finalProject = {
  scenes: convertedScenes,
  branding: {
    appTitle: rawQuizData.quiz_title || 'MŪZIKAS ŠOVS',
    appBgColor: '#121212'
  }
};

// Saglabājam failu tieši uploads mapē
const targetDir = path.resolve(__dirname, '../../public/uploads');
if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

const targetFile = path.join(targetDir, 'Dzimsanas_dienas_muzikala.json');
fs.writeFileSync(targetFile, JSON.stringify(finalProject, null, 2));

console.log(`✅ Veiksmīgi nokonvertēts!`);
console.log(`📁 Fails saglabāts kā: ${targetFile}`);
console.log(`📊 Kopā izveidoti ${convertedScenes.length} slaidi.`);