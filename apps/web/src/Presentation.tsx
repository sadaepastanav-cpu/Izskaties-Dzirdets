import React, { useState, useEffect, useRef } from 'react';
import { socket } from './socket';
import { useParams } from 'react-router-dom';
import Timer from './Timer';
import { BACKEND_URL } from './config';

const MEDIA_BASE_URL = `${BACKEND_URL}/project-media`;

const NEON_PALETTE = [
  { base: '#00f0ff', glow: '#00f0ff', dark: '#00838f', text: '#000' },
  { base: '#ff007f', glow: '#ff007f', dark: '#99004d', text: '#fff' },
  { base: '#00ff66', glow: '#00ff66', dark: '#009933', text: '#000' },
  { base: '#ffd700', glow: '#ffd700', dark: '#b29500', text: '#000' },
  { base: '#b537f2', glow: '#b537f2', dark: '#6a1b9a', text: '#fff' },
  { base: '#ff6b35', glow: '#ff6b35', dark: '#c43d0e', text: '#fff' },
  { base: '#00e5ff', glow: '#00e5ff', dark: '#0097a7', text: '#000' },
  { base: '#f72585', glow: '#f72585', dark: '#7209b7', text: '#fff' },
  { base: '#76ff03', glow: '#76ff03', dark: '#388e3c', text: '#000' },
  { base: '#ff9100', glow: '#ff9100', dark: '#b26500', text: '#000' }
];

const getDynamicOrbConfig = (count: number) => {
  if (count <= 6) return { size: 110, numFont: '2.2rem', nameFont: '1.05rem', maxW: 120, gap: 24, showName: true };
  if (count <= 15) return { size: 85, numFont: '1.7rem', nameFont: '0.9rem', maxW: 95, gap: 18, showName: true };
  if (count <= 30) return { size: 68, numFont: '1.3rem', nameFont: '0.78rem', maxW: 76, gap: 14, showName: true };
  if (count <= 60) return { size: 50, numFont: '1.0rem', nameFont: '0.65rem', maxW: 56, gap: 10, showName: true };
  if (count <= 100) return { size: 38, numFont: '0.78rem', nameFont: '0.52rem', maxW: 42, gap: 8, showName: true };
  if (count <= 150) return { size: 30, numFont: '0.62rem', nameFont: '0.45rem', maxW: 34, gap: 6, showName: true };
  if (count <= 250) return { size: 24, numFont: '0.5rem', nameFont: '0.35rem', maxW: 28, gap: 5, showName: false };
  return { size: 18, numFont: '0.38rem', nameFont: '0.3rem', maxW: 22, gap: 4, showName: false };
};

const hexToRgba = (hex: string = '#000000', opacityPercent: number = 80) => {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacityPercent / 100})`;
};

export const formatThinkingTime = (totalMs: number = 0): string => {
  if (!totalMs || totalMs <= 0) return '0 sek un 000 ms';
  const ms = Math.floor(totalMs % 1000);
  const totalSeconds = Math.floor(totalMs / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  const msStr = String(ms).padStart(3, '0');

  if (minutes > 0) {
    return `${minutes} min ${seconds} sek un ${msStr} ms`;
  }
  return `${seconds} sek un ${msStr} ms`;
};

const MediaLayoutItem: React.FC<{
  el: any;
  subState: string;
  isRevealed: boolean;
  onCustomMediaEnded?: () => void;
}> = ({ el, subState, isRevealed, onCustomMediaEnded }) => {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const vis = el.visibility || 'ALWAYS';
  const src = `${MEDIA_BASE_URL}/${el.content}`;

  const currentSub = (subState || 'IDLE').toUpperCase();
  const isRevealPhase = isRevealed || currentSub === 'REVEAL';

  const isVisible =
    vis === 'ALWAYS' ||
    (vis === 'DURING_QUESTION' && ['READY', 'ACTIVE', 'PAUSED', 'STATS', 'SUMMARY'].includes(currentSub) && !isRevealPhase) ||
    (vis === 'AFTER_REVEAL' && isRevealPhase);

  const shouldPlay = isVisible && currentSub !== 'PAUSED' && (
    (vis === 'ALWAYS' && ['READY', 'ACTIVE', 'STATS', 'SUMMARY', 'REVEAL'].includes(currentSub)) ||
    (vis === 'DURING_QUESTION' && currentSub === 'ACTIVE') ||
    (vis === 'AFTER_REVEAL' && isRevealPhase)
  );

  useEffect(() => {
    const m = mediaRef.current;
    if (!m) return;
    m.volume = (el.volume !== undefined ? el.volume : 100) / 100;

    if (shouldPlay) {
      if (m.paused) {
        try {
          if (m.currentTime === 0 && el.trimStart) m.currentTime = el.trimStart;
        } catch {}
        m.play().catch(() => {});
      }
    } else {
      m.pause();
    }
  }, [shouldPlay, currentSub, isRevealPhase, el.trimStart, el.volume]);

  const bgRgba = hexToRgba(el.bgColor || '#000000', el.bgOpacity ?? (el.type === 'QUESTION' ? 85 : 60));
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${el.x}%`,
    top: `${el.y}%`,
    width: `${el.w}%`,
    minHeight: `${el.h}%`,
    height: 'auto',
    zIndex: el.z || el.zIndex || 2,
    color: el.color || '#ffffff',
    fontFamily: el.fontFamily || 'Segoe UI',
    fontSize: typeof el.fontSize === 'number' ? `${el.fontSize}vw` : el.fontSize || '2.2vw',
    fontWeight: el.fontWeight || (el.bold ? 'bold' : 'normal'),
    whiteSpace: 'pre-wrap',
    textAlign: 'center',
    display: isVisible ? 'flex' : 'none',
    alignItems: 'center',
    justifyContent: 'center',
    wordBreak: 'break-word',
    boxSizing: 'border-box'
  };

  if (el.type === 'QUESTION' || el.type === 'TEXT') {
    return (
      <div
        style={{
          ...style,
          background: bgRgba,
          padding: el.type === 'QUESTION' ? '15px 25px' : '10px',
          borderRadius: el.type === 'QUESTION' ? '20px' : '8px',
          backdropFilter: 'blur(14px)',
          border: el.type === 'QUESTION' ? '2px solid #ffc107' : '1px solid rgba(255,255,255,0.15)',
          textShadow: '0 2px 10px #000',
          boxShadow: '0 8px 32px rgba(0,0,0,0.8)'
        }}
      >
        {el.content}
      </div>
    );
  }

  if (el.type === 'IMAGE' && el.content) {
    return (
      <img
        src={src}
        style={{ ...style, objectFit: 'contain', borderRadius: '15px', display: isVisible ? 'block' : 'none' }}
        alt="Medijs"
      />
    );
  }

  if (el.type === 'VIDEO' && el.content) {
    return (
      <video
        ref={(v) => { mediaRef.current = v; }}
        src={src}
        preload="auto"
        style={{ ...style, objectFit: 'contain', borderRadius: '15px', display: isVisible ? 'block' : 'none' }}
        loop={!!el.loop}
        playsInline
        onTimeUpdate={() => {
          const v = mediaRef.current;
          if (v && el.trimEnd && v.currentTime >= el.trimEnd) {
            if (el.loop) {
              v.currentTime = el.trimStart || 0;
              v.play().catch(() => {});
            } else {
              v.pause();
              if (onCustomMediaEnded) onCustomMediaEnded();
            }
          }
        }}
        onEnded={() => {
          if (!el.loop && onCustomMediaEnded) onCustomMediaEnded();
        }}
      />
    );
  }

  if (el.type === 'AUDIO' && el.content) {
    return (
      <audio
        ref={(a) => { mediaRef.current = a; }}
        src={src}
        preload="auto"
        loop={!!el.loop}
        onTimeUpdate={() => {
          const a = mediaRef.current;
          if (a && el.trimEnd && a.currentTime >= el.trimEnd) {
            if (el.loop) {
              a.currentTime = el.trimStart || 0;
              a.play().catch(() => {});
            } else {
              a.pause();
              if (onCustomMediaEnded) onCustomMediaEnded();
            }
          }
        }}
        onEnded={() => {
          if (!el.loop && onCustomMediaEnded) onCustomMediaEnded();
        }}
      />
    );
  }

  return null;
};

interface TopBarProps {
  pin: string | undefined;
  scene: any;
  subState: string;
  summaryStats?: any;
  participantCount: number;
  voteData: {
    summary: Record<string, number>;
    votedCount: number;
    votedPlayerIds?: string[];
  };
  players: any[];
  isRevealed: boolean;
  isTeamMode: boolean;
}

const TopBar: React.FC<TopBarProps> = ({
  pin,
  scene,
  subState,
  summaryStats,
  participantCount,
  voteData,
  players,
  isRevealed,
  isTeamMode
}) => {
  const votedCount = voteData.votedCount || 0;
  
  const unvotedPlayers = players.filter(
    (p) => !p.isDisabled && !(voteData.votedPlayerIds || []).includes(p.id)
  );
  const missingCount = unvotedPlayers.length;

  const duration = scene?.config?.duration ?? scene?.config?.timeLimit ?? 0;
  const hasTimer = duration > 0;
  const isPaused = scene?.subState === 'PAUSED';
  const currentSub = (subState || scene?.subState || '').toUpperCase();
  const isSummaryPhase = currentSub === 'SUMMARY' || currentSub === 'REVEAL';

  const maxPoints = scene?.config?.pointsMax ?? scene?.config?.points ?? 15;
  const minPoints = scene?.config?.pointsMin ?? 1;
  const [currentPoints, setCurrentPoints] = useState(maxPoints);

  useEffect(() => {
    if (!scene?.endTime || (scene?.subState !== 'ACTIVE' && !isPaused) || !hasTimer) {
      setCurrentPoints(maxPoints);
      return;
    }

    if (isPaused) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const totalTime = duration * 1000;
      const timeLeft = Math.max(0, scene.endTime - now);

      if (timeLeft <= 0) {
        setCurrentPoints(minPoints);
      } else {
        const calculated = Math.ceil((timeLeft / totalTime) * (maxPoints - minPoints)) + minPoints;
        setCurrentPoints(Math.max(minPoints, calculated));
      }
    }, 100);

    return () => clearInterval(interval);
  }, [scene?.endTime, scene?.subState, duration, maxPoints, minPoints, hasTimer, isPaused]);

  const getDotStyle = (count: number): React.CSSProperties => {
    let size = 6;
    if (count <= 10) size = 20;
    else if (count <= 25) size = 15;
    else if (count <= 60) size = 10;
    else if (count <= 150) size = 8;

    return {
      width: `${size}px`,
      height: `${size}px`,
      backgroundColor: '#00ff00',
      borderRadius: '50%',
      boxShadow: `0 0 ${size}px #00ff00`,
      transition: 'all 0.3s ease'
    };
  };

  return (
    <div style={topBarStyle}>
      <div style={pinBadge}>
        PIN: <span style={{ color: '#0f0' }}>{pin}</span>
      </div>

      <div style={votersBox}>
        {/* SUMMARY DIAGRAMMA AR DAUDZATBILŽU (2/2, 1/2, 0/2) VAI STANDARTA (1/1) ATBALSTU */}
        {isSummaryPhase && (summaryStats || scene?.summaryStats) ? (
          (() => {
            const stats = summaryStats || scene?.summaryStats || {};
            if (stats.isMultiChoice) {
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span style={summaryPillGreen}>
                    🟩 Pilnīgi ({stats.requiredCount}/{stats.requiredCount}): <strong>{stats.fullCorrectCount ?? 0}</strong> ({stats.fullCorrectPct ?? 0}%)
                  </span>
                  <span style={summaryPillYellow}>
                    🟨 Daļēji (1/{stats.requiredCount}): <strong>{stats.partialCorrectCount ?? 0}</strong> ({stats.partialCorrectPct ?? 0}%)
                  </span>
                  <span style={summaryPillRed}>
                    🟥 Kļūdaini (0/{stats.requiredCount}): <strong>{stats.incorrectCount ?? 0}</strong> ({stats.incorrectPct ?? 0}%)
                  </span>
                  <span style={summaryPillGray}>
                    ⏱️ Nokavēja: <strong>{stats.unsubmittedCount ?? 0}</strong>
                  </span>
                </div>
              );
            }
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={summaryPillGreen}>
                  🟩 Pareizi: <strong>{stats.correctCount ?? 0}</strong> ({stats.correctPct ?? 0}%)
                </span>
                <span style={summaryPillRed}>
                  🟥 Kļūdaini: <strong>{stats.incorrectCount ?? 0}</strong> ({stats.incorrectPct ?? 0}%)
                </span>
                <span style={summaryPillGray}>
                  ⏱️ Nokavēja: <strong>{stats.unsubmittedCount ?? 0}</strong>
                </span>
              </div>
            );
          })()
        ) : isPaused ? (
          <span style={{ color: '#ff9800', fontSize: '1.3vw', fontWeight: 'bold', textShadow: '0 0 15px rgba(255,152,0,0.8)' }}>
            ⏸️ SPĒLE IEPAUZĒTA
          </span>
        ) : missingCount > 5 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', maxWidth: '500px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', maxHeight: '55px', overflow: 'hidden' }}>
              {[...Array(Math.min(missingCount, 120))].map((_, i) => (
                <div key={i} style={getDotStyle(missingCount)} />
              ))}
            </div>
          </div>
        ) : missingCount > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ color: '#ffc107', fontWeight: 'bold', fontSize: '0.95vw', textTransform: 'uppercase', textShadow: '0 0 10px #ffc107' }}>
              GAIDĀM ATBILDES ({missingCount}):
            </span>
            {unvotedPlayers.map((p) => (
              <span
                key={p.id}
                style={{
                  background: 'rgba(255, 193, 7, 0.25)',
                  border: '2px solid #ffc107',
                  color: '#fff',
                  padding: '3px 10px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '0.95vw',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 0 12px rgba(255, 193, 7, 0.6)'
                }}
              >
                #{p.deviceNumber || '?'} {p.name} {isTeamMode && p.teamName ? `[${p.teamName}]` : ''}
              </span>
            ))}
          </div>
        ) : (
          <span style={{ color: '#28a745', fontSize: '1.2vw', fontWeight: 'bold', textShadow: '0 0 15px rgba(40,167,69,0.8)' }}>
            ✅ Visas atbildes saņemtas!
          </span>
        )}
      </div>

      {hasTimer && (
        <div style={{ ...timerBadge, borderColor: isPaused ? '#ff9800' : 'orange' }}>
          <Timer
            endTime={scene?.endTime}
            isPaused={isPaused}
            pausedRemainingMs={scene?.pausedRemainingMs}
          />
        </div>
      )}

      <div style={statsBadge}>
        👥 {votedCount} / {participantCount}
      </div>

      <div style={pointsBadge}>
        ⭐ {isRevealed ? 'REZULTĀTS' : `${currentPoints} / ${maxPoints} PTS`}
      </div>
    </div>
  );
};

export default function Presentation() {
  const { pin: routePin } = useParams<{ pin: string }>();
  const [pin, setPin] = useState<string>('');
  const [scene, setScene] = useState<any>(null);
  const [subState, setSubState] = useState<string>('IDLE');
  const [summaryStats, setSummaryStats] = useState<any>(null);
  const [voteData, setVoteData] = useState<{ summary: Record<string, number>; votedCount: number; votedPlayerIds?: string[] }>({
    summary: {},
    votedCount: 0,
    votedPlayerIds: []
  });
  const [participantCount, setParticipantCount] = useState(0);
  const [players, setPlayers] = useState<any[]>([]);
  const [isRevealed, setIsRevealed] = useState(false);
  const [revealedCorrectAnswers, setRevealedCorrectAnswers] = useState<string[]>([]);
  const [revealedCorrectnessMap, setRevealedCorrectnessMap] = useState<Record<string, number>>({});
  const [isStatsVisible, setIsStatsVisible] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [teamLeaderboard, setTeamLeaderboard] = useState<any[]>([]);
  const [showTeamLeaderboard, setShowTeamLeaderboard] = useState(true);
  const [leaderboardType, setLeaderboardType] = useState<'ROUND' | 'TOTAL' | 'FINAL'>('TOTAL');
  const [leaderboardPage, setLeaderboardPage] = useState(0);
  const [podiumStage, setPodiumStage] = useState(0);
  const [isMediaReady, setIsMediaReady] = useState(false);
  const [isSessionClosed, setIsSessionClosed] = useState(false);

  const [branding, setBranding] = useState<any>({
    lobbyMode: 'CIRCLE',
    optionsRevealTiming: 'ON_ACTIVE',
    appTitle: '',
    appLogo: '',
    welcomeImage: '',
    appBgImage: '',
    appBgColor: '#0a0a0a',
    teamModeEnabled: false
  });

  const [connectionUrl, setConnectionUrl] = useState<string>('');
  const [testedBuzzerCounts, setTestedBuzzerCounts] = useState<Record<string, number>>({});

  const audioBank = useRef<{
    timer: HTMLAudioElement;
    timeUp: HTMLAudioElement;
    reveal: HTMLAudioElement;
    finals: HTMLAudioElement;
  } | null>(null);

  useEffect(() => {
    if (!audioBank.current) {
      audioBank.current = {
        timer: new Audio('/sounds/00Time.mp3'),
        timeUp: new Audio('/sounds/01laiksbeidzas.mp3'),
        reveal: new Audio('/sounds/02atklajatbildi.mp3'),
        finals: new Audio('/sounds/04Finals.mp3')
      };
      audioBank.current.timer.preload = 'auto';
      audioBank.current.timeUp.preload = 'auto';
      audioBank.current.reveal.preload = 'auto';
      audioBank.current.finals.preload = 'auto';
      audioBank.current.finals.loop = true;
    }

    return () => {
      if (audioBank.current) {
        Object.values(audioBank.current).forEach((a) => {
          a.pause();
          a.currentTime = 0;
        });
      }
    };
  }, []);

  const playSound = (audio: HTMLAudioElement | undefined) => {
    if (!audio || !isMediaReady) return;
    try {
      audio.pause();
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    } catch {}
  };

  const stopSound = (audio: HTMLAudioElement | undefined) => {
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  };

  const hasCustomMediaDuringQuestion = !!(scene?.config?.layout || []).some(
    (el: any) =>
      (el.type === 'AUDIO' || el.type === 'VIDEO') &&
      el.content &&
      String(el.content).trim() !== '' &&
      (el.visibility === 'ALWAYS' || el.visibility === 'DURING_QUESTION')
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const targetPin = routePin || params.get('pin') || localStorage.getItem('presentation_pin') || '';

    if (targetPin) {
      setPin(targetPin.trim());
      localStorage.setItem('presentation_pin', targetPin.trim());
      socket.emit('join-session', { pin: targetPin.trim(), name: 'EKRĀNS', playerId: 'scr_' + targetPin.trim() });
      socket.emit('get-branding', { pin: targetPin.trim() });
    }

    fetch(`${BACKEND_URL}/api/network-ip`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.tunnelUrl) setConnectionUrl(d.tunnelUrl);
      })
      .catch(() => {});

    const handleJoinSuccess = (data: any) => {
      if (data?.connectionUrl) setConnectionUrl(data.connectionUrl);
      if (data?.currentScene) setScene(data.currentScene);
      if (data?.subState) setSubState(String(data.subState).toUpperCase());
      if (data?.summaryStats) setSummaryStats(data.summaryStats);
      if (data?.branding) {
        setBranding((prev: any) => ({ ...prev, ...data.branding }));
        if (data.branding.teamModeEnabled !== undefined) {
          setShowTeamLeaderboard(Boolean(data.branding.teamModeEnabled));
        }
      }
    };

    const handleSessionInfo = (data: any) => {
      if (data?.state?.connectionUrl) setConnectionUrl(data.state.connectionUrl);
      if (data?.state?.currentScene) setScene(data.state.currentScene);
      if (data?.state?.subState) setSubState(String(data.state.subState).toUpperCase());
      if (data?.state?.summaryStats) setSummaryStats(data.state.summaryStats);
      if (data?.state?.branding) {
        setBranding((prev: any) => ({ ...prev, ...data.state.branding }));
        if (data.state.branding.teamModeEnabled !== undefined) {
          setShowTeamLeaderboard(Boolean(data.state.branding.teamModeEnabled));
        }
      }
    };

    const handleSessionBranding = (br: any) => {
      if (br && Object.keys(br).length > 0) {
        setBranding((prev: any) => ({ ...prev, ...br }));
        if (br.teamModeEnabled !== undefined) {
          setShowTeamLeaderboard(Boolean(br.teamModeEnabled));
        }
      }
    };

    const handleConnectionUrlChanged = (newUrl: string) => {
      if (newUrl) setConnectionUrl(newUrl);
    };

    const handleTunnelReady = (data: { url: string }) => {
      if (data?.url) setConnectionUrl(data.url);
    };

    const handleStateUpdate = (newScene: any) => {
      setScene((prevScene: any) => {
        if (!prevScene || prevScene.id !== newScene.id || newScene.subState === 'READY') {
          setVoteData({ summary: {}, votedCount: 0, votedPlayerIds: [] });
          setIsRevealed(false);
          setRevealedCorrectAnswers([]);
          setRevealedCorrectnessMap({});
          setIsStatsVisible(false);
          setSummaryStats(null);
        }
        return newScene;
      });
      const nextSub = (newScene?.subState || 'READY').toUpperCase();
      setSubState(nextSub);
      if (newScene?.summaryStats) {
        setSummaryStats(newScene.summaryStats);
      }
      if (nextSub === 'REVEAL') {
        setIsRevealed(true);
      }
      setPodiumStage(0);
    };

    const handleSessionEnded = () => {
      localStorage.removeItem('presentation_pin');
      setIsSessionClosed(true);
      setScene(null);
      window.close();
    };

    const handleVotesUpdated = (data: any) => {
      setVoteData({
        summary: data?.summary || {},
        votedCount: data?.votedCount || 0,
        votedPlayerIds: data?.votedPlayerIds || []
      });
    };

    const handlePresenceUpdate = (data: any) => {
      setParticipantCount(data?.count || 0);
      if (Array.isArray(data?.players)) setPlayers(data.players);
    };

    const handleResultsRevealed = (data: { correctAnswers: string[]; correctnessMap: Record<string, number> }) => {
      setIsRevealed(true);
      if (data?.correctAnswers) setRevealedCorrectAnswers(data.correctAnswers);
      if (data?.correctnessMap) setRevealedCorrectnessMap(data.correctnessMap);
    };

    const handleToggleChart = () => setIsStatsVisible((prev) => !prev);

    const handleToggleTeamView = (data?: { view?: 'TEAMS' | 'INDIVIDUAL'; page?: number }) => {
      if (data?.view) {
        setShowTeamLeaderboard(data.view === 'TEAMS');
      } else {
        setShowTeamLeaderboard((prev) => !prev);
      }
      setLeaderboardPage(data?.page !== undefined ? data.page : 0);
    };

    const handleBuzzerTest = (data: { playerId: string }) => {
      setTestedBuzzerCounts((prev) => ({
        ...prev,
        [data.playerId]: (prev[data.playerId] || 0) + 1
      }));
    };

    const handleLeaderboardUpdate = (payload: any) => {
      if (Array.isArray(payload)) {
        setLeaderboard(payload);
        setLeaderboardType('TOTAL');
      } else {
        setLeaderboard(payload?.data || []);
        setLeaderboardType((payload?.lbType || 'TOTAL').toUpperCase());
      }
      setLeaderboardPage(0);
      setPodiumStage(0);
    };

    const handleTeamLeaderboardUpdate = (payload: any) => {
      const list = Array.isArray(payload) ? payload : (payload?.data || []);
      setTeamLeaderboard(list);
      if (payload?.lbType) {
        setLeaderboardType(payload.lbType.toUpperCase());
      }
    };

    socket.on('join-success', handleJoinSuccess);
    socket.on('session-info', handleSessionInfo);
    socket.on('session-branding', handleSessionBranding);
    socket.on('connection-url-changed', handleConnectionUrlChanged);
    socket.on('tunnel-ready', handleTunnelReady);
    socket.on('state-update', handleStateUpdate);
    socket.on('session-ended', handleSessionEnded);
    socket.on('session-closed', handleSessionEnded);
    socket.on('votes-updated', handleVotesUpdated);
    socket.on('presence-update', handlePresenceUpdate);
    socket.on('results-revealed', handleResultsRevealed);
    socket.on('toggle-audience-chart', handleToggleChart);
    socket.on('toggle-team-leaderboard', handleToggleTeamView);
    socket.on('player-buzzer-test', handleBuzzerTest);
    socket.on('leaderboard-update', handleLeaderboardUpdate);
    socket.on('team-leaderboard-update', handleTeamLeaderboardUpdate);
    socket.on('podium-stage-change', (stage: number) => setPodiumStage(stage));
    socket.on('leaderboard-page-change', (page: number) => setLeaderboardPage(page));

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setIsStatsVisible((prev) => !prev);
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setShowTeamLeaderboard((prev) => !prev);
        setLeaderboardPage(0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      socket.off('join-success', handleJoinSuccess);
      socket.off('session-info', handleSessionInfo);
      socket.off('session-branding', handleSessionBranding);
      socket.off('connection-url-changed', handleConnectionUrlChanged);
      socket.off('tunnel-ready', handleTunnelReady);
      socket.off('state-update', handleStateUpdate);
      socket.off('session-ended', handleSessionEnded);
      socket.off('session-closed', handleSessionEnded);
      socket.off('votes-updated', handleVotesUpdated);
      socket.off('presence-update', handlePresenceUpdate);
      socket.off('results-revealed', handleResultsRevealed);
      socket.off('toggle-audience-chart', handleToggleChart);
      socket.off('toggle-team-leaderboard', handleToggleTeamView);
      socket.off('player-buzzer-test', handleBuzzerTest);
      socket.off('leaderboard-update', handleLeaderboardUpdate);
      socket.off('team-leaderboard-update', handleTeamLeaderboardUpdate);
      socket.off('podium-stage-change');
      socket.off('leaderboard-page-change');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [routePin]);

  const isTeamMode = !!branding?.teamModeEnabled;
  const currentSub = (subState || scene?.subState || 'IDLE').toUpperCase();
  const isQuestionType =
    scene?.type === 'QUESTION' ||
    scene?.type === 'QUIZ' ||
    scene?.type === 'MAJORITY' ||
    scene?.type === 'VOTE';

  const isRoundLb = (scene?.config?.lbType || leaderboardType) === 'ROUND';
  const isFinalLb = scene?.type === 'LEADERBOARD' && (scene?.config?.lbType === 'FINAL' || leaderboardType === 'FINAL');
  const isFullContent = scene?.type === 'BILLBOARD' || scene?.type === 'LEADERBOARD';

  // KONTROLĒTA AUDIO ATSKAŅOŠANA
  useEffect(() => {
    if (!isMediaReady || !audioBank.current) return;

    if (currentSub === 'ACTIVE' && isQuestionType) {
      stopSound(audioBank.current.timeUp);
      stopSound(audioBank.current.reveal);
      stopSound(audioBank.current.finals);

      if (hasCustomMediaDuringQuestion) {
        stopSound(audioBank.current.timer);
      } else {
        playSound(audioBank.current.timer);
      }
    } else if (currentSub === 'STATS' && isQuestionType) {
      stopSound(audioBank.current.timer);
      stopSound(audioBank.current.reveal);
      playSound(audioBank.current.timeUp);
    } else if (currentSub === 'SUMMARY' && isQuestionType) {
      stopSound(audioBank.current.timer);
      stopSound(audioBank.current.timeUp);
    } else if (currentSub === 'REVEAL' && isQuestionType) {
      stopSound(audioBank.current.timer);
      stopSound(audioBank.current.timeUp);
      playSound(audioBank.current.reveal);
    } else if (isFinalLb) {
      stopSound(audioBank.current.timer);
      stopSound(audioBank.current.timeUp);
      stopSound(audioBank.current.reveal);
      playSound(audioBank.current.finals);
    } else {
      stopSound(audioBank.current.timer);
      if (!isFinalLb) stopSound(audioBank.current.finals);
    }
  }, [currentSub, isQuestionType, hasCustomMediaDuringQuestion, isFinalLb, isMediaReady]);

  const handleCustomMediaEnded = () => {
    if (currentSub === 'ACTIVE' && isQuestionType && audioBank.current) {
      playSound(audioBank.current.timer);
    }
  };

  const handleStartPresentation = async () => {
    setIsMediaReady(true);
    if (!audioBank.current) return;

    for (const sound of Object.values(audioBank.current)) {
      try {
        sound.muted = true;
        await sound.play();
        sound.pause();
        sound.currentTime = 0;
        sound.muted = false;
        sound.volume = 1.0;
      } catch (e) {
        sound.muted = false;
        sound.volume = 1.0;
      }
    }
  };

  if (isSessionClosed) {
    return (
      <div style={fullScreenCenter}>
        <div style={{ textAlign: 'center', background: 'rgba(20, 20, 20, 0.95)', backdropFilter: 'blur(16px)', padding: '40px', borderRadius: '24px', border: '2px solid rgba(255,255,255,0.2)', boxShadow: '0 20px 60px rgba(0,0,0,0.9)' }}>
          <h1 style={{ color: '#ffc107', fontSize: '3vw', margin: '0 0 15px 0', textShadow: '0 2px 10px #000' }}>👋 SPĒLES SESIJA IR BEIGUSIES</h1>
          <p style={{ color: '#ccc', fontSize: '1.4vw', margin: '0 0 25px 0' }}>Vadītājs ir noslēdzis šo sesiju. Šo logu var droši aizvērt.</p>
          <button onClick={() => window.close()} style={bigBtn}>
            Aizvērt logu
          </button>
        </div>
      </div>
    );
  }

  if (!isMediaReady) {
    return (
      <div style={fullScreenCenter}>
        <button onClick={handleStartPresentation} style={bigBtn}>
          🚀 SĀKT PREZENTĀCIJU
        </button>
      </div>
    );
  }

  const baseHost = connectionUrl && connectionUrl.trim() !== '' ? connectionUrl.trim() : window.location.origin;
  const joinUrl = `${baseHost.replace(/\/$/, '')}/?pin=${pin}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(joinUrl)}`;

  // 1. SĀKUMA REĢISTRĀCIJAS EKRĀNS (LOBBY)
  if (!scene) {
    const lobbyMode = branding?.lobbyMode || 'CIRCLE';

    if (lobbyMode === 'INTERACTIVE_DOTS') {
      const orbCfg = getDynamicOrbConfig(players.length);

      return (
        <div style={{ ...fullScreen, backgroundColor: branding.appBgColor || '#0a0a0a', padding: '20px 30px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div style={{ border: '4px solid #00ff00', padding: '8px 26px', borderRadius: '18px', boxShadow: '0 0 35px rgba(0,255,0,0.35)', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}>
              <span style={{ fontSize: '1.4vw', color: '#aaa' }}>PIN: </span>
              <span style={{ fontSize: '3.2vw', color: '#00ff00', fontWeight: 'bold' }}>{pin}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: '#fff', padding: '10px 18px', borderRadius: '16px', boxShadow: '0 0 30px rgba(255,255,255,0.2)' }}>
              <img src={qrCodeUrl} alt="QR" style={{ width: '85px', height: '85px' }} />
              <div style={{ textAlign: 'left', color: '#000' }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.1vw' }}>Skenē kamerā!</div>
                <div style={{ fontSize: '0.8vw', color: '#555' }}>Pieslēdzies spēlei</div>
              </div>
            </div>
          </div>

          <div style={{ margin: '8px 0', textAlign: 'center' }}>
            <h2 style={{ fontSize: '2vw', color: '#ffc107', margin: 0, textShadow: '0 0 15px rgba(255,193,7,0.5)' }}>
              🎮 PIESLĒGUŠIES DALĪBNIEKI ({participantCount}):
            </h2>
            <span style={{ fontSize: '0.95vw', color: '#aaa', marginTop: '2px', display: 'inline-block' }}>
              Spiediet telefonā "Pārbaudīt pulti", lai mainītu krāsas un bumbiņa pulsētu! 💥
            </span>
          </div>

          <div
            style={{
              flex: 1,
              width: '100%',
              display: 'flex',
              flexWrap: 'wrap',
              gap: `${orbCfg.gap}px`,
              justifyContent: 'center',
              alignItems: 'center',
              alignContent: 'center',
              overflow: 'hidden',
              padding: '10px',
              boxSizing: 'border-box'
            }}
          >
            {players.length === 0 ? (
              <div style={{ color: '#666', fontSize: '1.5vw', fontStyle: 'italic', background: 'rgba(0,0,0,0.6)', padding: '10px 20px', borderRadius: '10px' }}>
                Gaidām dalībnieku pieslēgšanos...
              </div>
            ) : (
              players.map((p, idx) => {
                const pressCount = testedBuzzerCounts[p.id] || 0;
                const cycle = Math.floor(pressCount / 3);
                const step = pressCount % 3;
                const isBursting = step === 0 && pressCount > 0;

                const baseIndex = p.deviceNumber ? p.deviceNumber - 1 : idx;
                const colorIdx = (baseIndex + cycle) % NEON_PALETTE.length;
                const pal = NEON_PALETTE[colorIdx];

                const currentScale = isBursting ? 1.25 : 1 + step * 0.15;

                const orbBg = isBursting
                  ? 'radial-gradient(circle at 35% 35%, #ffffff 0%, #ffd700 45%, #b29500 100%)'
                  : `radial-gradient(circle at 35% 35%, #ffffff 0%, ${pal.base} 45%, ${pal.dark} 100%)`;

                const orbShadow = isBursting
                  ? '0 0 45px #ffd700, 0 0 90px rgba(255, 215, 0, 0.85)'
                  : `0 0 ${22 + step * 10}px ${pal.glow}, 0 0 ${45 + step * 15}px ${hexToRgba(pal.glow, 50)}`;

                return (
                  <div
                    key={p.id || idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      width: `${orbCfg.maxW}px`,
                      transform: `scale(${currentScale})`,
                      transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}
                    title={`${p.name} (#${p.deviceNumber || idx + 1})`}
                  >
                    <div
                      style={{
                        width: `${orbCfg.size}px`,
                        height: `${orbCfg.size}px`,
                        borderRadius: '50%',
                        background: orbBg,
                        boxShadow: orbShadow,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isBursting ? '#000' : pal.text,
                        fontWeight: '900',
                        fontSize: orbCfg.numFont,
                        border: 'none',
                        userSelect: 'none'
                      }}
                    >
                      #{p.deviceNumber || idx + 1}
                    </div>

                    {orbCfg.showName && (
                      <span
                        style={{
                          fontSize: orbCfg.nameFont,
                          fontWeight: 'bold',
                          color: '#fff',
                          marginTop: '4px',
                          width: '100%',
                          maxWidth: `${orbCfg.maxW}px`,
                          textAlign: 'center',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          background: 'rgba(0,0,0,0.7)',
                          backdropFilter: 'blur(4px)',
                          borderRadius: '4px',
                          padding: '1px 3px',
                          display: 'block'
                        }}
                      >
                        {p.name}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      );
    }

    const circleSize = `${Math.min(14 + participantCount * 0.2, 32)}vw`;

    return (
      <div style={{ ...fullScreenCenter, backgroundColor: '#000', gap: '1.5vw' }}>
        <h1 style={{ fontSize: '2.5vw', color: '#888', margin: 0 }}>PIEVIENOJIES SPĒLEI:</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '35px' }}>
          <div style={{ border: '6px solid #0f0', padding: '1.5vw 3.5vw', borderRadius: '30px', boxShadow: '0 0 60px rgba(0,255,0,0.3)', background: 'rgba(0,0,0,0.85)' }}>
            <h1 style={{ fontSize: '8vw', margin: 0, letterSpacing: '0.8vw', lineHeight: 1, color: '#fff' }}>{pin}</h1>
          </div>

          <div style={{ background: '#fff', padding: '12px 16px', borderRadius: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 0 30px rgba(255,255,255,0.2)' }}>
            <img src={qrCodeUrl} alt="QR" style={{ width: '135px', height: '135px' }} />
            <span style={{ color: '#000', fontSize: '0.9vw', fontWeight: 'bold', marginTop: '6px' }}>Skenē kamerā!</span>
          </div>
        </div>

        <div
          style={{
            width: circleSize,
            height: circleSize,
            border: '0.8vw solid #00ff00',
            borderRadius: '50%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.5s ease',
            boxShadow: '0 0 50px #00ff00',
            marginTop: '0.5vw',
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)'
          }}
        >
          <span style={{ fontSize: '5vw', fontWeight: 'bold', color: '#fff', lineHeight: 1 }}>{participantCount}</span>
          <span style={{ fontSize: '1.1vw', color: '#aaa', marginTop: '0.4vw', textTransform: 'uppercase' }}>
            {participantCount === 1 ? 'Dalībnieks' : 'Dalībnieki'}
          </span>
        </div>
      </div>
    );
  }

  const containerStyle: React.CSSProperties = {
    ...fullScreen,
    backgroundImage: scene?.config?.backgroundUrl ? `url(${MEDIA_BASE_URL}/${scene.config.backgroundUrl})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    transition: 'background 1s ease-in-out'
  };

  const optionsList: string[] = (scene?.config?.options || []).filter((opt: string) => opt && opt.trim() !== '');
  const optLayout = scene?.config?.optionsLayout || 'GRID';
  const optPositions = scene?.config?.optionsPositions || {};

  const sortedLeaderboard = [...leaderboard]
    .filter((p) => !p.isDisabled)
    .sort((a, b) => {
      const scoreA = isRoundLb ? (a.roundScore ?? 0) : (a.score ?? 0);
      const scoreB = isRoundLb ? (b.roundScore ?? 0) : (b.score ?? 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      const timeA = isRoundLb ? (a.roundTimeMs || 0) : (a.totalTimeMs || 0);
      const timeB = isRoundLb ? (b.roundTimeMs || 0) : (b.totalTimeMs || 0);
      return timeA - timeB;
    });

  const finalIsTeamPodium = isTeamMode && showTeamLeaderboard && teamLeaderboard.length > 0;
  const activePodiumList = finalIsTeamPodium ? teamLeaderboard : sortedLeaderboard;

  const totalCount = activePodiumList.length;
  const firstPlace = activePodiumList[0];
  const secondPlace = activePodiumList[1];
  const thirdPlace = totalCount >= 3 ? activePodiumList[2] : null;

  const remainingList = totalCount > 3 ? activePodiumList.slice(3) : [];
  const totalRemainingPages = Math.max(1, Math.ceil(remainingList.length / 10));
  const currentRemainingPageList = remainingList.slice(leaderboardPage * 10, (leaderboardPage + 1) * 10);

  const optionsRevealTiming = branding?.optionsRevealTiming || 'ON_ACTIVE';
  const shouldShowOptions =
    isQuestionType &&
    optionsList.length > 0 &&
    (optionsRevealTiming === 'ALWAYS' ? true : ['ACTIVE', 'PAUSED', 'STATS', 'SUMMARY', 'REVEAL'].includes(currentSub));

  const effectiveCorrectAnswers = isRevealed ? (revealedCorrectAnswers.length > 0 ? revealedCorrectAnswers : (scene?.config?.correctAnswers || [])) : [];
  const effectiveCorrectnessMap = isRevealed ? (Object.keys(revealedCorrectnessMap).length > 0 ? revealedCorrectnessMap : (scene?.config?.answerCorrectness || {})) : {};

  return (
    <div style={containerStyle}>
      {!isFullContent && (
        <TopBar
          pin={pin}
          scene={scene}
          subState={subState}
          summaryStats={summaryStats}
          participantCount={participantCount}
          voteData={voteData}
          players={players}
          isRevealed={isRevealed}
          isTeamMode={isTeamMode}
        />
      )}

      <div
        style={{
          flex: 1,
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: isFullContent ? 'center' : 'flex-start',
          paddingTop: !isFullContent ? '90px' : '0px',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}
      >
        {scene?.config?.layout?.map((el: any, idx: number) => (
          <MediaLayoutItem
            key={el.id || `layout-el-${idx}`}
            el={el}
            subState={currentSub}
            isRevealed={isRevealed}
            onCustomMediaEnded={handleCustomMediaEnded}
          />
        ))}

        {shouldShowOptions && (
          optLayout === 'INDIVIDUAL' ? (
            optionsList.map((opt: string, i: number) => {
              const pos = optPositions[i] || optPositions[opt] || {
                x: 10 + (i % 2) * 45,
                y: 55 + Math.floor(i / 2) * 14,
                w: 40,
                h: 10
              };
              const isCorrect = isRevealed && effectiveCorrectAnswers.includes(opt);
              const letter = String.fromCharCode(65 + i);
              const count = voteData.summary[opt] ?? voteData.summary[letter] ?? 0;
              const pct = effectiveCorrectnessMap[opt];
              const isOnlyLetter = !opt || opt.trim() === '';

              return (
                <div
                  key={`ind-opt-${i}`}
                  style={{
                    position: 'absolute',
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    width: isOnlyLetter ? 'auto' : `${pos.w}%`,
                    minHeight: `${pos.h}%`,
                    height: 'auto',
                    ...optionCard,
                    background: isOnlyLetter ? 'transparent' : isCorrect ? '#28a745' : 'rgba(0, 0, 0, 0.85)',
                    borderColor: isOnlyLetter ? 'transparent' : isCorrect ? '#00ff00' : 'rgba(255,255,255,0.2)',
                    boxShadow: isOnlyLetter ? 'none' : isCorrect ? '0 0 25px rgba(40, 167, 69, 0.8)' : '0 8px 25px rgba(0,0,0,0.8)',
                    padding: isOnlyLetter ? '0' : '12px 20px',
                    zIndex: 10
                  }}
                >
                  <div
                    style={{
                      width: '55px',
                      height: '55px',
                      borderRadius: '50%',
                      background: isCorrect ? '#28a745' : '#111',
                      border: '3px solid #ffc107',
                      boxShadow: '0 0 20px rgba(0,0,0,0.9), 0 0 10px rgba(255,193,7,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '900',
                      fontSize: '2vw',
                      color: '#ffc107'
                    }}
                  >
                    {letter}
                  </div>

                  {!isOnlyLetter && (
                    <span style={{ fontSize: '1.8vw', fontWeight: 'bold', flex: 1, marginLeft: '15px', textShadow: '0 2px 8px #000' }}>
                      {opt} {isCorrect && pct !== undefined && pct < 100 && `(+${pct}%)`}
                    </span>
                  )}

                  {isStatsVisible && (currentSub === 'STATS' || currentSub === 'SUMMARY' || isRevealed) && (
                    <span style={voteBadge}>{count}</span>
                  )}
                </div>
              );
            })
          ) : (
            <div
              style={{
                position: 'absolute',
                bottom: '30px',
                width: '85%',
                display: 'grid',
                gridTemplateColumns: optLayout === 'COLUMN' ? '1fr' : '1fr 1fr',
                gap: '15px',
                zIndex: 10
              }}
            >
              {optionsList.map((opt: string, i: number) => {
                const isCorrect = isRevealed && effectiveCorrectAnswers.includes(opt);
                const letter = String.fromCharCode(65 + i);
                const count = voteData.summary[opt] ?? voteData.summary[letter] ?? 0;
                const pct = effectiveCorrectnessMap[opt];
                const isOnlyLetter = !opt || opt.trim() === '';

                return (
                  <div
                    key={`grp-opt-${i}`}
                    style={{
                      ...optionCard,
                      background: isOnlyLetter ? 'transparent' : isCorrect ? '#28a745' : 'rgba(0, 0, 0, 0.85)',
                      borderColor: isOnlyLetter ? 'transparent' : isCorrect ? '#00ff00' : 'rgba(255,255,255,0.2)',
                      boxShadow: isOnlyLetter ? 'none' : isCorrect ? '0 0 25px rgba(40, 167, 69, 0.8)' : '0 8px 25px rgba(0,0,0,0.8)'
                    }}
                  >
                    <div
                      style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '50%',
                        background: isCorrect ? '#28a745' : '#111',
                        border: '2px solid #ffc107',
                        boxShadow: '0 0 15px rgba(0,0,0,0.8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '1.6vw',
                        color: '#ffc107',
                        marginRight: '12px'
                      }}
                    >
                      {letter}
                    </div>

                    {!isOnlyLetter && (
                      <span style={{ fontSize: '1.8vw', fontWeight: 'bold', flex: 1, textShadow: '0 2px 8px #000' }}>
                        {opt} {isCorrect && pct !== undefined && pct < 100 && `(+${pct}%)`}
                      </span>
                    )}

                    {isStatsVisible && (currentSub === 'STATS' || currentSub === 'SUMMARY' || isRevealed) && (
                      <span style={voteBadge}>{count}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* 2. REGULĀRĀ LĪDERU TABULA */}
        {scene.type === 'LEADERBOARD' && !isFinalLb && (
          <div style={leaderboardOverlay}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h1 style={{ fontSize: '2.5vw', color: '#ffc107', margin: 0, textShadow: '0 2px 10px #000' }}>
                {isTeamMode && showTeamLeaderboard
                  ? isRoundLb
                    ? '🏆 KOMANDU KĀRTAS REZULTĀTI'
                    : '👥 KOMANDU KOPVĒRTĒJUMS'
                  : isRoundLb
                  ? '🏆 KĀRTAS REZULTĀTI'
                  : '⭐ INDIVIDUĀLAIS KOPVĒRTĒJUMS'}
              </h1>
            </div>

            {isTeamMode && showTeamLeaderboard ? (
              <div>
                {teamLeaderboard.slice(leaderboardPage * 10, (leaderboardPage + 1) * 10).map((t, i) => (
                  <div key={t.name} style={leaderRow}>
                    <span>{leaderboardPage * 10 + i + 1}. 👥 {t.name} ({t.memberCount} spēlētāji)</span>
                    <span style={{ fontWeight: 'bold', color: 'gold' }}>{t.score} pt</span>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                {sortedLeaderboard.slice(leaderboardPage * 10, (leaderboardPage + 1) * 10).map((p, i) => {
                  const globalIndex = leaderboardPage * 10 + i + 1;
                  const scoreToDisplay = isRoundLb ? (p.roundScore ?? 0) : p.score;
                  const timeToDisplay = isRoundLb ? (p.roundTimeMs || 0) : (p.totalTimeMs || 0);

                  return (
                    <div key={p.id || globalIndex} style={leaderRow}>
                      <span>
                        {globalIndex}. {p.name} {isTeamMode && p.teamName && `[${p.teamName}]`}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <span style={timeTagStyle}>⏱️ {formatThinkingTime(timeToDisplay)}</span>
                        <span style={{ fontWeight: 'bold', color: 'gold', minWidth: '70px', textAlign: 'right' }}>
                          {scoreToDisplay} pt
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 3. FINĀLA APBALVOŠANA (PODIJS) */}
        {scene.type === 'LEADERBOARD' && isFinalLb && (
          <div style={podiumWrapper}>
            {podiumStage < 4 && (
              <div style={podiumFlexContainer}>
                <div style={podiumTitleBox}>
                  <h1 style={{ fontSize: 'clamp(1.4rem, 2.5vw, 3rem)', color: '#ffd700', margin: 0, textShadow: '0 0 25px rgba(255,215,0,0.7)', fontWeight: '900', letterSpacing: '1px' }}>
                    🥇 {finalIsTeamPodium ? 'KOMANDU FINĀLA APBALVOŠANA' : 'INDIVIDUĀLĀ FINĀLA APBALVOŠANA'}
                  </h1>
                </div>

                <div style={podiumStagesContainer}>
                  {/* 2. VIETA */}
                  {secondPlace && (
                    <div
                      style={{
                        ...pedestalColumn,
                        opacity: podiumStage >= 2 ? 1 : 0,
                        transform: podiumStage >= 2 ? 'translateY(0)' : 'translateY(40px)',
                        transition: 'all 0.7s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                      }}
                    >
                      <div style={podiumTextBadge}>
                        <span style={podiumNameText} title={secondPlace.name}>
                          {finalIsTeamPodium ? `👥 ${secondPlace.name}` : `${secondPlace.name} ${isTeamMode && secondPlace.teamName ? `[${secondPlace.teamName}]` : ''}`}
                        </span>
                        <span style={{ fontSize: 'clamp(1rem, 1.3vw, 1.5rem)', color: '#ffc107', fontWeight: 'bold' }}>{secondPlace.score} pt</span>
                        {secondPlace.totalTimeMs !== undefined && (
                          <span style={{ fontSize: 'clamp(0.7rem, 0.85vw, 0.95rem)', color: '#00e5ff' }}>
                            ⏱️ {formatThinkingTime(secondPlace.totalTimeMs)}
                          </span>
                        )}
                      </div>
                      <div style={silverPedestal}>
                        <span style={pedestalNumberText}>🥈 2</span>
                      </div>
                    </div>
                  )}

                  {/* 1. VIETA */}
                  {firstPlace && (
                    <div
                      style={{
                        ...pedestalColumn,
                        opacity: podiumStage >= 3 ? 1 : 0,
                        transform: podiumStage >= 3 ? 'translateY(0)' : 'translateY(50px)',
                        transition: 'all 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                      }}
                    >
                      <div style={{ fontSize: 'clamp(1.8rem, 2.6vw, 3.2rem)', marginBottom: '-4px', animation: 'pulse 1.2s infinite alternate', filter: 'drop-shadow(0 0 12px gold)' }}>
                        👑
                      </div>
                      <div style={{ ...podiumTextBadge, border: '2px solid #ffd700', boxShadow: '0 0 25px rgba(255,215,0,0.6)', background: 'rgba(20, 15, 0, 0.92)' }}>
                        <span style={{ ...podiumNameText, color: '#ffd700', fontWeight: '900', textShadow: '0 0 12px #ffd700' }} title={firstPlace.name}>
                          {finalIsTeamPodium ? `👥 ${firstPlace.name}` : `${firstPlace.name} ${isTeamMode && firstPlace.teamName ? `[${firstPlace.teamName}]` : ''}`}
                        </span>
                        <span style={{ fontSize: 'clamp(1.1rem, 1.5vw, 1.8rem)', color: '#fff', fontWeight: 'bold' }}>{firstPlace.score} pt</span>
                        {firstPlace.totalTimeMs !== undefined && (
                          <span style={{ fontSize: 'clamp(0.75rem, 0.9vw, 1rem)', color: '#00e5ff' }}>
                            ⏱️ {formatThinkingTime(firstPlace.totalTimeMs)}
                          </span>
                        )}
                      </div>
                      <div style={goldPedestal}>
                        <span style={pedestalNumberText}>🥇 1</span>
                      </div>
                    </div>
                  )}

                  {/* 3. VIETA */}
                  {thirdPlace && (
                    <div
                      style={{
                        ...pedestalColumn,
                        opacity: podiumStage >= 1 ? 1 : 0,
                        transform: podiumStage >= 1 ? 'translateY(0)' : 'translateY(40px)',
                        transition: 'all 0.7s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                      }}
                    >
                      <div style={podiumTextBadge}>
                        <span style={podiumNameText} title={thirdPlace.name}>
                          {finalIsTeamPodium ? `👥 ${thirdPlace.name}` : `${thirdPlace.name} ${isTeamMode && thirdPlace.teamName ? `[${thirdPlace.teamName}]` : ''}`}
                        </span>
                        <span style={{ fontSize: 'clamp(1rem, 1.3vw, 1.5rem)', color: '#ffc107', fontWeight: 'bold' }}>{thirdPlace.score} pt</span>
                        {thirdPlace.totalTimeMs !== undefined && (
                          <span style={{ fontSize: 'clamp(0.7rem, 0.85vw, 0.95rem)', color: '#00e5ff' }}>
                            ⏱️ {formatThinkingTime(thirdPlace.totalTimeMs)}
                          </span>
                        )}
                      </div>
                      <div style={bronzePedestal}>
                        <span style={pedestalNumberText}>🥉 3</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. SOLIS: PILNAIS SARAKSTS NO 4. VIETAS */}
            {podiumStage >= 4 && (
              <div style={leaderboardOverlay}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h1 style={{ fontSize: '2.5vw', color: '#ffc107', margin: 0, textShadow: '0 2px 10px #000' }}>
                    {finalIsTeamPodium ? 'KOMANDU KOPVĒRTĒJUMS (NO 4. VIETAS)' : 'INDIVIDUĀLAIS KOPVĒRTĒJUMS (NO 4. VIETAS)'} {totalRemainingPages > 1 ? `(${leaderboardPage + 1}/${totalRemainingPages})` : ''}
                  </h1>
                </div>
                <div>
                  {currentRemainingPageList.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#aaa', padding: '20px', fontStyle: 'italic', fontSize: '1.4vw' }}>
                      Citu dalībnieku sarakstā nav. Nospiediet [Space], lai atgrieztos uz Top 3 podiju!
                    </div>
                  ) : (
                    currentRemainingPageList.map((item, i) => {
                      const globalRank = 4 + leaderboardPage * 10 + i;
                      return (
                        <div key={item.id || item.name || globalRank} style={leaderRow}>
                          <span>
                            {globalRank}. {finalIsTeamPodium ? `👥 ${item.name} (${item.memberCount} spēlētāji)` : `${item.name} ${isTeamMode && item.teamName ? `[${item.teamName}]` : ''}`}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            {item.totalTimeMs !== undefined && (
                              <span style={timeTagStyle}>⏱️ {formatThinkingTime(item.totalTimeMs)}</span>
                            )}
                            <span style={{ fontWeight: 'bold', color: 'gold', minWidth: '70px', textAlign: 'right' }}>
                              {item.score} pt
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// STILI
const fullScreen: React.CSSProperties = {
  height: '100vh',
  width: '100vw',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  backgroundColor: '#000',
  color: '#fff',
  fontFamily: 'Segoe UI, Arial, sans-serif',
  overflow: 'hidden',
  position: 'relative'
};

const fullScreenCenter: React.CSSProperties = { ...fullScreen, justifyContent: 'center' };

const topBarStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '75px',
  background: 'rgba(20, 20, 20, 0.92)',
  backdropFilter: 'blur(12px)',
  display: 'flex',
  alignItems: 'center',
  padding: '0 30px',
  gap: '20px',
  borderBottom: '2px solid rgba(255,255,255,0.15)',
  zIndex: 30,
  boxSizing: 'border-box'
};

const pinBadge: React.CSSProperties = {
  background: 'rgba(0,0,0,0.85)',
  padding: '8px 18px',
  borderRadius: '10px',
  fontSize: '1.4rem',
  fontWeight: 'bold',
  border: '2px solid #0f0'
};

const timerBadge: React.CSSProperties = {
  minWidth: '55px',
  height: '55px',
  padding: '0 12px',
  borderRadius: '28px',
  border: '3px solid orange',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 'bold',
  fontSize: '1.2rem',
  background: 'rgba(0,0,0,0.7)',
  backdropFilter: 'blur(8px)'
};

const votersBox: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const statsBadge: React.CSSProperties = { 
  fontSize: '1.3rem', 
  fontWeight: 'bold',
  background: 'rgba(0,0,0,0.7)',
  backdropFilter: 'blur(8px)',
  padding: '6px 14px',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.15)'
};

const pointsBadge: React.CSSProperties = {
  background: '#fff',
  color: '#000',
  padding: '8px 18px',
  borderRadius: '25px',
  fontWeight: 'bold',
  fontSize: '1.1rem',
  boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
};

const bigBtn: React.CSSProperties = {
  padding: '30px 60px',
  fontSize: '2.5rem',
  cursor: 'pointer',
  background: '#28a745',
  color: '#fff',
  border: 'none',
  borderRadius: '20px',
  fontWeight: 'bold',
  boxShadow: '0 10px 30px rgba(0,0,0,0.7)'
};

const optionCard: React.CSSProperties = {
  padding: '12px 20px',
  borderRadius: '14px',
  border: '2px solid rgba(255,255,255,0.15)',
  backdropFilter: 'blur(14px)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  boxShadow: '0 8px 30px rgba(0,0,0,0.85)',
  boxSizing: 'border-box'
};

const voteBadge: React.CSSProperties = {
  background: '#007bff',
  color: '#fff',
  padding: '4px 14px',
  borderRadius: '20px',
  fontSize: '1.3vw',
  fontWeight: 'bold'
};

const summaryPillGreen: React.CSSProperties = {
  background: 'rgba(40, 167, 69, 0.3)',
  border: '2px solid #28a745',
  color: '#00ff00',
  padding: '5px 14px',
  borderRadius: '10px',
  fontWeight: 'bold',
  fontSize: '1.05vw',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 0 15px rgba(40,167,69,0.45)'
};

const summaryPillYellow: React.CSSProperties = {
  background: 'rgba(255, 193, 7, 0.25)',
  border: '2px solid #ffc107',
  color: '#ffc107',
  padding: '5px 12px',
  borderRadius: '10px',
  fontWeight: 'bold',
  fontSize: '0.95vw',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 0 15px rgba(255,193,7,0.45)'
};

const summaryPillRed: React.CSSProperties = {
  background: 'rgba(220, 53, 69, 0.3)',
  border: '2px solid #dc3545',
  color: '#ff4d4d',
  padding: '5px 14px',
  borderRadius: '10px',
  fontWeight: 'bold',
  fontSize: '1.05vw',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 0 15px rgba(220,53,69,0.45)'
};

const summaryPillGray: React.CSSProperties = {
  background: 'rgba(108, 117, 125, 0.3)',
  border: '2px solid #6c757d',
  color: '#ddd',
  padding: '5px 14px',
  borderRadius: '10px',
  fontWeight: 'bold',
  fontSize: '1.05vw',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 0 10px rgba(108,117,125,0.4)'
};

const leaderboardOverlay: React.CSSProperties = {
  background: 'rgba(10, 10, 10, 0.88)',
  backdropFilter: 'blur(16px)',
  padding: '35px',
  borderRadius: '24px',
  width: '68vw',
  maxHeight: '75vh',
  zIndex: 40,
  border: '2px solid rgba(255, 255, 255, 0.18)',
  boxShadow: '0 20px 60px rgba(0,0,0,0.95)',
  display: 'flex',
  flexDirection: 'column'
};

const leaderRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '1.8vw',
  borderBottom: '1px solid rgba(255,255,255,0.12)',
  padding: '10px 0',
  textShadow: '0 2px 8px #000'
};

const timeTagStyle: React.CSSProperties = {
  fontSize: '1.2vw',
  color: '#00e5ff',
  background: 'rgba(0, 229, 255, 0.15)',
  backdropFilter: 'blur(6px)',
  padding: '2px 8px',
  borderRadius: '6px',
  border: '1px solid rgba(0, 229, 255, 0.4)'
};

const podiumWrapper: React.CSSProperties = {
  width: '92vw',
  height: '86vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box'
};

const podiumFlexContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%'
};

const podiumTitleBox: React.CSSProperties = {
  background: 'rgba(10, 10, 10, 0.85)',
  backdropFilter: 'blur(14px)',
  padding: '8px 32px',
  borderRadius: '16px',
  border: '1px solid rgba(255, 215, 0, 0.4)',
  marginBottom: 'clamp(10px, 2.5vh, 25px)',
  boxShadow: '0 10px 30px rgba(0,0,0,0.85)'
};

const podiumStagesContainer: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  gap: 'clamp(15px, 3vw, 40px)',
  width: '100%',
  maxHeight: '62vh'
};

const pedestalColumn: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-end'
};

const podiumTextBadge: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  background: 'rgba(12, 12, 12, 0.88)',
  backdropFilter: 'blur(14px)',
  padding: '6px 14px',
  borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  marginBottom: '6px',
  boxShadow: '0 8px 25px rgba(0,0,0,0.9)',
  width: 'clamp(160px, 20vw, 280px)',
  boxSizing: 'border-box'
};

const podiumNameText: React.CSSProperties = {
  fontSize: 'clamp(0.95rem, 1.4vw, 1.7rem)',
  fontWeight: 'bold',
  color: '#fff',
  width: '100%',
  textAlign: 'center',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textShadow: '0 2px 6px #000'
};

const pedestalNumberText: React.CSSProperties = {
  fontSize: 'clamp(2.5rem, 4.5vw, 5.5rem)',
  fontWeight: '900',
  color: '#000',
  textShadow: '0 2px 8px rgba(255,255,255,0.7)'
};

const goldPedestal: React.CSSProperties = {
  width: 'clamp(150px, 19vw, 240px)',
  height: 'clamp(140px, 26vh, 230px)',
  background: 'linear-gradient(to top, #b7791f, #f6e05e, #ecc94b)',
  borderRadius: '18px 18px 0 0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '3px solid #fff',
  boxShadow: '0 0 45px rgba(246, 224, 94, 0.8), inset 0 0 20px rgba(255,255,255,0.6)'
};

const silverPedestal: React.CSSProperties = {
  width: 'clamp(130px, 16vw, 200px)',
  height: 'clamp(100px, 19vh, 170px)',
  background: 'linear-gradient(to top, #4a5568, #cbd5e0, #e2e8f0)',
  borderRadius: '14px 14px 0 0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '3px solid #fff',
  boxShadow: '0 0 30px rgba(226, 232, 240, 0.6), inset 0 0 15px rgba(255,255,255,0.5)'
};

const bronzePedestal: React.CSSProperties = {
  width: 'clamp(130px, 16vw, 200px)',
  height: 'clamp(70px, 14vh, 130px)',
  background: 'linear-gradient(to top, #744210, #d69e2e, #b7791f)',
  borderRadius: '14px 14px 0 0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '3px solid #fff',
  boxShadow: '0 0 30px rgba(214, 158, 46, 0.6), inset 0 0 15px rgba(255,255,255,0.5)'
};