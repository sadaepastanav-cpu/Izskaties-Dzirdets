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
}

export interface Slide {
  id: string;
  title: string;
  type: 'QUESTION' | 'BILLBOARD' | 'LEADERBOARD' | 'MAJORITY' | 'ORDERING' | 'BUZZER_RACE';
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
  timerMode?: 'ALL_VOTED' | 'FULL_TIME';
  teamModeEnabled?: boolean;
  teamScoringMode?: 'AVG' | 'SUM';
  predefinedTeams?: string[];
  maxMissedQuestions?: number;
}

export interface BuzzerWinner {
  position: number;
  playerId: string;
  name: string;
  deviceNumber: number;
  teamName?: string;
  timeSpentMs: number;
  status?: 'ACTIVE' | 'PASSED' | 'AWARDED' | 'FAILED';
}