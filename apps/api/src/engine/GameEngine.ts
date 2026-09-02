import { GameState, Scene } from '../types/game';

export class GameEngine {
  // Aprēķina punktus par atbildi (50% loģika)
  static calculatePoints(userAnswers: string[], correctAnswers: string[], maxPoints: number = 100): number {
    if (!correctAnswers || correctAnswers.length === 0) return 0;
    
    const correctCount = userAnswers.filter(ans => correctAnswers.includes(ans)).length;
    
    // Formula: (Pareizo skaits / Kopējo pareizo skaits) * Maksimālie punkti
    const score = (correctCount / correctAnswers.length) * maxPoints;
    
    return Math.round(score);
  }

  // Sagatavo līderu sarakstu
  static getLeaderboard(playersMap: Map<string, any>) {
    return Array.from(playersMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }
}