import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRoundScores, getSortedLeaderboard, PlayerScoreState } from './scoring';

test('Scoring: FIXED režīms ar vienu pareizo atbildi piešķir precīzus punktus', () => {
  const players = new Map<string, PlayerScoreState>([
    ['p1', { id: 'p1', name: 'Jānis', score: 0, roundScore: 0, totalTimeMs: 0, roundTimeMs: 0 }],
    ['p2', { id: 'p2', name: 'Anna', score: 0, roundScore: 0, totalTimeMs: 0, roundTimeMs: 0 }]
  ]);

  const votes = [
    { playerId: 'p1', optionIds: ['A'], timeReceived: 1000, timeSpentMs: 1500 },
    { playerId: 'p2', optionIds: ['B'], timeReceived: 1200, timeSpentMs: 1700 }
  ];

  calculateRoundScores({
    votes,
    playersMap: players,
    config: { points: 10, scoringMode: 'FIXED', correctAnswers: ['A'] }
  });

  assert.equal(players.get('p1')?.score, 10);
  assert.equal(players.get('p2')?.score, 0);
  assert.equal(players.get('p1')?.totalTimeMs, 1500);
});

test('Scoring: Daudzizvēle (ALL) sadala punktus proporcionāli', () => {
  const players = new Map<string, PlayerScoreState>([
    ['p1', { id: 'p1', name: 'Zane', score: 0, roundScore: 0, totalTimeMs: 0, roundTimeMs: 0 }]
  ]);

  // Jāatzīmē 2 atbildes (A un B). Spēlētājs atzīmēja tikai vienu pareizo.
  calculateRoundScores({
    votes: [{ playerId: 'p1', optionIds: ['A'], timeReceived: 1000, timeSpentMs: 2000 }],
    playersMap: players,
    config: { points: 10, selectionMode: 'ALL', correctAnswers: ['A', 'B'] }
  });

  assert.equal(players.get('p1')?.score, 5); // 50% no 10 punktiem
});

test('Scoring: ANY_ONE režīmā pietiek ar 1 pareizo atbildi, lai saņemtu 100%', () => {
  const players = new Map<string, PlayerScoreState>([
    ['p1', { id: 'p1', name: 'Māris', score: 0, roundScore: 0, totalTimeMs: 0, roundTimeMs: 0 }]
  ]);

  calculateRoundScores({
    votes: [{ playerId: 'p1', optionIds: ['B'], timeReceived: 1000, timeSpentMs: 1200 }],
    playersMap: players,
    config: { points: 10, selectionMode: 'ANY_ONE', correctAnswers: ['A', 'B', 'C'] }
  });

  assert.equal(players.get('p1')?.score, 10);
});

test('Scoring: Speed Bonus piešķir +3, +2, +1 pirmajiem trim pareizajiem', () => {
  const players = new Map<string, PlayerScoreState>([
    ['p1', { id: 'p1', name: '1. vieta', score: 0, roundScore: 0, totalTimeMs: 0, roundTimeMs: 0 }],
    ['p2', { id: 'p2', name: '2. vieta', score: 0, roundScore: 0, totalTimeMs: 0, roundTimeMs: 0 }],
    ['p3', { id: 'p3', name: '3. vieta', score: 0, roundScore: 0, totalTimeMs: 0, roundTimeMs: 0 }],
    ['p4', { id: 'p4', name: '4. vieta', score: 0, roundScore: 0, totalTimeMs: 0, roundTimeMs: 0 }]
  ]);

  const votes = [
    { playerId: 'p1', optionIds: ['A'], timeReceived: 100, timeSpentMs: 100 },
    { playerId: 'p2', optionIds: ['A'], timeReceived: 200, timeSpentMs: 200 },
    { playerId: 'p3', optionIds: ['A'], timeReceived: 300, timeSpentMs: 300 },
    { playerId: 'p4', optionIds: ['A'], timeReceived: 400, timeSpentMs: 400 }
  ];

  calculateRoundScores({
    votes,
    playersMap: players,
    config: { points: 10, speedBonusEnabled: true, correctAnswers: ['A'] }
  });

  assert.equal(players.get('p1')?.score, 13);
  assert.equal(players.get('p2')?.score, 12);
  assert.equal(players.get('p3')?.score, 11);
  assert.equal(players.get('p4')?.score, 10);
});

test('Leaderboard: Vienādu punktu gadījumā augstāk ir tas, kurš atbildēja ātrāk', () => {
  const players = new Map<string, PlayerScoreState>([
    ['p1', { id: 'p1', name: 'Lēnais', score: 20, roundScore: 0, totalTimeMs: 5000, roundTimeMs: 0 }],
    ['p2', { id: 'p2', name: 'Ātrais', score: 20, roundScore: 0, totalTimeMs: 2500, roundTimeMs: 0 }]
  ]);

  const sorted = getSortedLeaderboard(players, false);
  assert.equal(sorted[0].id, 'p2');
  assert.equal(sorted[1].id, 'p1');
});