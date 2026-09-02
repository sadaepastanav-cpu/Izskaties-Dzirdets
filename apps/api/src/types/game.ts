export type SceneType = 'TEXT' | 'QUIZ' | 'VOTE' | 'LEADERBOARD' | 'VIDEO';

export interface SceneConfig {
  question?: string;
  text?: string;
  options?: string[];
  correctAnswers?: string[];
  duration?: number;
  backgroundUrl?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio';
  points?: number;
}

export interface Scene {
  id: string;
  type: SceneType;
  title: string;
  config: SceneConfig;
  endTime?: number | null;
}

export interface GameState {
  currentScene: Scene | null;
  subState: 'IDLE' | 'ACTIVE' | 'STATS' | 'REVEAL';
  votes: Array<{ playerId: string; optionIds: string[]; timestamp: number }>;
}