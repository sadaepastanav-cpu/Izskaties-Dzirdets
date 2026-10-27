export interface CanvasElement {
  id: string;
  type: 'QUESTION' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO';
  content: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  bold?: boolean;
  bgColor?: string;
  bgOpacity?: number;
  volume?: number;
  trimStart?: number;
  trimEnd?: number;
  isTrimEndCustom?: boolean;
  visibility?: 'ALWAYS' | 'DURING_QUESTION' | 'UNTIL_REVEAL' | 'AFTER_REVEAL';
  blurMode?: 'NONE' | 'STATIC' | 'PROGRESSIVE';
  blurAmount?: number;
  loop?: boolean;
  zIndex?: number;
  z?: number;

  // 🌟 Mediju piegulēšanas režīms (Ietilpināt / Aizpildīt rāmi / Iestiept pa visu rāmi)
  fitMode?: 'CONTAIN' | 'COVER' | 'FILL';

  // 🌟 Malu noapaļojums pikseļos (regulējams no 0 līdz 50+)
  borderRadius?: number;
}

export interface DiplomaConfig {
  theme?: 'GOLD_DARK' | 'GOLD_WHITE_PRINT' | 'CUSTOM';
  bgColor?: string;
  bgImage?: string;
  borderColor?: string;
  titleColor?: string;
  winnerColor?: string;
  customTitle?: string;
  customSubtitle?: string;
  showLogo?: boolean;
  logoPosition?: 'TOP' | 'CENTER' | 'BOTTOM';
  footerText?: string;
  inkSaverMode?: boolean;
}

// 🌟 KONTAKTU LAUKA DEFINĪCIJA
export interface ContactField {
  id: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: 'text' | 'email' | 'tel';
}

export interface Slide {
  id: string;
  title: string;
  type: 'QUESTION' | 'BILLBOARD' | 'LEADERBOARD' | 'MAJORITY' | 'ORDERING' | 'BUZZER_RACE' | 'TIMER' | 'CONTACTS';
  config: {
    duration: number;
    points: number;
    pointsMin?: number;
    pointsMax?: number;
    scoringMode?: 'FIXED' | 'DECREASING';
    speedBonusEnabled?: boolean;
    selectionMode?: 'ALL' | 'ANY_ONE';
    requiredCount?: number;
    submitMode?: 'INSTANT' | 'CONFIRM';
    autoStart?: boolean;
    question?: string;
    notes?: string;
    optionsCount: number;
    options: string[];
    correctAnswers: string[];
    correctOrder?: string[];
    answerCorrectness?: Record<string, number>;
    optionsLayout: 'INDIVIDUAL' | 'RIGHT_COLUMN' | 'GRID' | 'AUTO_GRID';
    optionsPositions?: Record<string | number, { x: number; y: number; w: number; h: number }>;
    optionsColor?: string;
    optionsBgColor?: string;
    optionsBgOpacity?: number;
    optionsCorrectColor?: string;
    buzzerRaceType?: 'WITH_OPTIONS' | 'ORAL';
    buzzerEvaluationMode?: 'AUTO' | 'MANUAL';
    buzzerMode?: 'QUEUE_PASS' | 'REOPEN_BUZZER';
    buzzerMaxQueue?: number;
    maxAttemptsPerPlayer?: number;
    backgroundUrl?: string;
    lbType?: 'ROUND' | 'TOTAL' | 'FINAL';
    layout: CanvasElement[];
    playerUIMode?: 'AUTO' | 'CLASSIC_GRID' | 'TEXT_CARDS' | 'MUSIC_DUAL';
    musicCategoryTop?: string;
    musicCategoryBottom?: string;
    // ⏱️ Taimera slaida iestatījumi:
    timerType?: 'COUNTDOWN' | 'CLOCK';
    timerPlacement?: 'CENTER' | 'TOP_RIGHT';
    timerLabel?: string;
    timerDuration?: number; // Sekundēs (piem., 300 = 5 minūtes)
    timerBgVideo?: string;
    timerBgVideoLoop?: boolean;

    // 🌟 KONTAKTU SLAIDA IESTATĪJUMI
    contactFields?: ContactField[];
    contactsTitle?: string;
    contactsDescription?: string;

    // 🌐 TULKOŠANAS IESTATĪJUMS: ja true, atļauj tulkot; ja false/nav, bloķē tulkošanu
    allowOptionTranslation?: boolean;
  };
}

export interface MobileBranding {
  appTitle?: string;
  appLogo?: string;
  appBgImage?: string;
  welcomeImage?: string;
  appBgColor?: string;
  lobbyMode?: 'CIRCLE' | 'INTERACTIVE_DOTS';
  optionsRevealTiming?: 'ON_ACTIVE' | 'ALWAYS';
  presentationTheme?: 'NEON' | 'TV_SHOW' | 'ARENA' | 'MINIMAL';
  timerMode?: 'ALL_VOTED' | 'FULL_TIME';
  teamModeEnabled?: boolean;
  teamScoringMode?: 'AVG' | 'SUM';
  predefinedTeams?: string[];
  maxMissedQuestions?: number;
  gameLogoPosition?: 'NONE' | 'TOP' | 'BOTTOM';
  diplomaConfig?: DiplomaConfig;
  hostName?: string;
}

export interface BuzzerWinner {
  position: number;
  playerId: string;
  name: string;
  deviceNumber: number;
  teamName?: string;
  timeSpentMs: number;
  status?: 'ACTIVE' | 'QUEUED' | 'PASSED' | 'AWARDED' | 'FAILED';
  submittedAnswers?: string[];
}

export interface VoteAnswerDetail {
  optionId: string;
  timeReceived: number;
  timeSpentMs: number;
  category?: 'TOP' | 'BOTTOM' | 'SINGLE';
}

export interface PlayerState {
  id: string;
  token?: string;
  socketId?: string;
  name: string;
  deviceNumber?: number;
  score: number;
  roundScore: number;
  lastQuestionScore: number;
  totalTimeMs: number;
  roundTimeMs: number;
  rank?: number | null;
  previousRank?: number | null;
  rankDelta?: number;
  isDisabled?: boolean;
  isBot?: boolean;
  teamName?: string;
  isCaptain?: boolean;
  missedQuestionsCount: number;
  contacts?: Record<string, string>;
}

export interface TeamLeaderboardItem {
  name: string;
  score: number;
  rawScore: number;
  totalTimeMs: number;
  memberCount: number;
  members: string[];
  rank?: number;
  previousRank?: number | null;
  rankDelta?: number;
}

export interface PersonalStatsPayload {
  myRank: number | null;
  previousRank?: number | null;
  rankDelta?: number;
  totalPlayers: number;
  score: number;
  roundScore: number;
  lastQuestionScore?: number;
  totalTimeMs: number;
  roundTimeMs: number;
  lbType: string;
  teamRank?: number | null;
  previousTeamRank?: number | null;
  teamRankDelta?: number;
  totalTeams?: number;
  teamScore?: number | null;
  teamName?: string;
}

export interface ClientSyncResponse {
  currentScene: any;
  subState: string;
  isBlackout: boolean;
  score: number;
  roundScore: number;
  lastQuestionScore?: number;
  myRank?: number | null;
  previousRank?: number | null;
  rankDelta?: number;
  teamRank?: number | null;
  previousTeamRank?: number | null;
  teamRankDelta?: number;
  myChoice: string | null;
  myOptionIds: string[];
  topAnswer?: string | null;
  bottomAnswer?: string | null;
  myContacts?: Record<string, string>;
}