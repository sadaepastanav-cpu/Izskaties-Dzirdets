import React, { useState, useEffect, useRef, memo } from 'react';
import { socket } from './socket';
import { useParams } from 'react-router-dom';
import Timer from './Timer';
import { BACKEND_URL } from './config';
import { CanvasElement, BuzzerWinner } from './types';
import { hexToRgba, getPresentationFontSize, getOptionFontSize, formatThinkingTime, getOfflineQrCodeUrl } from './utils/formatting';

const MEDIA_BASE_URL = `${BACKEND_URL}/project-media`;

export type PresentationTheme = 'NEON' | 'TV_SHOW' | 'ARENA' | 'MINIMAL';

const NEON_PALETTE = [
  { base: '#00f0ff', glow: '#00f0ff', dark: '#00838f', text: '#000' },
  { base: '#ff007f', glow: '#ff007f', dark: '#99004d', text: '#fff' },
  { base: '#00ff66', glow: '#00ff66', dark: '#009933', text: '#000' },
  { base: '#ffd700', glow: '#ffd700', dark: '#b29500', text: '#000' },
  { base: '#b537f2', glow: '#b537f2', dark: '#6a1b9a', text: '#fff' },
  { base: '#ff6b35', glow: '#ff6b35', dark: '#c43d0e', text: '#fff' },
  { base: '#00e5ff', glow: '#00e5ff', dark: '#0097a7', text: '#000' },
  { base: '#f72585', glow: '#f72585', dark: '#7209b7', text: '#fff' }
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

let sharedAudioCtx: AudioContext | null = null;
const getSharedAudioContext = (): AudioContext | null => {
  if (!sharedAudioCtx) {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtxClass) sharedAudioCtx = new AudioCtxClass();
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
};

const ClockDisplay: React.FC = memo(() => {
  const [timeStr, setTimeStr] = useState<string>(() => new Date().toTimeString().split(' ')[0]);
  useEffect(() => {
    const interval = setInterval(() => setTimeStr(new Date().toTimeString().split(' ')[0]), 1000);
    return () => clearInterval(interval);
  }, []);
  return <span>{timeStr}</span>;
});

const CountdownDisplay: React.FC<{ durationSeconds: number }> = memo(({ durationSeconds }) => {
  const [remaining, setRemaining] = useState<number>(durationSeconds);
  useEffect(() => {
    setRemaining(durationSeconds);
    const interval = setInterval(() => setRemaining((prev) => (prev <= 1 ? 0 : prev - 1)), 1000);
    return () => clearInterval(interval);
  }, [durationSeconds]);
  const min = Math.floor(remaining / 60);
  const sec = String(remaining % 60).padStart(2, '0');
  return <span>{min}:{sec}</span>;
});

const ConfettiCanvas: React.FC<{ active: boolean }> = memo(({ active }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Array<{
      x: number; y: number; w: number; h: number; vy: number; vx: number;
      color: string; rotation: number; rotSpeed: number;
    }> = [];

    const colors = ['#ffd700', '#fff', '#ffea75', '#ff9800', '#f6e05e', '#d69e2e'];
    for (let i = 0; i < 140; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height,
        w: Math.random() * 12 + 6,
        h: Math.random() * 8 + 4,
        vy: Math.random() * 4 + 2.5,
        vx: (Math.random() - 0.5) * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.1
      });
    }

    let animId: number;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.y += p.vy;
        p.x += p.vx;
        p.rotation += p.rotSpeed;
        if (p.y > canvas.height) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      animId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animId);
  }, [active]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 50 }}
    />
  );
});

const SpotlightBeams: React.FC = memo(() => (
  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none', zIndex: 2 }}>
    <div className="spotlight-beam-left" />
    <div className="spotlight-beam-right" />
  </div>
));

const TopTimeProgressBar: React.FC<{
  remainingSec: number;
  totalSec: number;
  isPaused: boolean;
  isActive: boolean;
}> = memo(({ remainingSec, totalSec, isPaused, isActive }) => {
  if (!isActive || totalSec <= 0) return null;
  const pct = Math.max(0, Math.min(100, (remainingSec / totalSec) * 100));
  const isDanger = remainingSec <= 5 && !isPaused;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw',
      height: isDanger ? '8px' : '5px',
      background: 'rgba(0,0,0,0.5)', zIndex: 9999, transition: 'height 0.3s ease'
    }}>
      <div style={{
        width: `${pct}%`, height: '100%',
        background: isDanger ? 'linear-gradient(90deg, #ff0055, #ff3b30)' : 'linear-gradient(90deg, #00e5ff, #00ff66)',
        boxShadow: isDanger ? '0 0 15px #ff3b30, 0 0 30px #ff3b30' : '0 0 10px #00e5ff',
        transition: 'width 0.15s linear, background 0.3s ease'
      }} />
    </div>
  );
});

const MediaLayoutItem: React.FC<{
  el: any;
  subState: string;
  isRevealed: boolean;
  sceneDuration?: number;
  sceneType?: string;
  endTime?: number | null;
  onCustomMediaEnded?: () => void;
}> = ({ el, subState, isRevealed, sceneDuration = 30, sceneType, endTime, onCustomMediaEnded }) => {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const vis = el.visibility || (el.type === 'QUESTION' || el.type === 'TEXT' ? 'ALWAYS' : 'DURING_QUESTION');
  const src = `${MEDIA_BASE_URL}/${encodeURIComponent(el.content).replace(/%2F/g, '/')}`;

  const currentSub = (subState || 'IDLE').toUpperCase();
  const isRevealPhase = isRevealed || currentSub === 'REVEAL';
  const isBillboard = sceneType === 'BILLBOARD';

  const isVisible =
    isBillboard ||
    vis === 'ALWAYS' ||
    (vis === 'DURING_QUESTION' && ['ACTIVE', 'PAUSED', 'STATS', 'SUMMARY'].includes(currentSub) && !isRevealPhase) ||
    (vis === 'UNTIL_REVEAL' && ['READY', 'ACTIVE', 'PAUSED', 'STATS', 'SUMMARY'].includes(currentSub) && !isRevealPhase) ||
    (vis === 'AFTER_REVEAL' && isRevealPhase);

  const shouldPlay = isVisible && currentSub !== 'PAUSED' && (
    isBillboard ||
    (vis === 'ALWAYS' && ['ACTIVE', 'STATS', 'SUMMARY', 'REVEAL'].includes(currentSub)) ||
    ((vis === 'DURING_QUESTION' || vis === 'UNTIL_REVEAL') && currentSub === 'ACTIVE') ||
    (vis === 'AFTER_REVEAL' && isRevealPhase)
  );

  useEffect(() => {
    const m = mediaRef.current;
    if (!m) return;
    try {
      m.volume = Math.max(0, Math.min(1, (el.volume !== undefined ? el.volume : 100) / 100));
    } catch {}

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

  const initialBlurAmount = el.blurAmount || 12;
  const [currentBlurPx, setCurrentBlurPx] = useState<number>(() => {
    if (el.blurMode === 'STATIC' || el.blurMode === 'PROGRESSIVE') return initialBlurAmount;
    return 0;
  });

  useEffect(() => {
    if (!el.blurMode || el.blurMode === 'NONE' || isBillboard) {
      setCurrentBlurPx(0);
      return;
    }
    if (el.blurMode === 'STATIC') {
      setCurrentBlurPx(initialBlurAmount);
      return;
    }
    if (el.blurMode === 'PROGRESSIVE') {
      if (isRevealPhase || ['STATS', 'SUMMARY', 'REVEAL'].includes(currentSub)) {
        setCurrentBlurPx(0);
        return;
      }
      if (currentSub !== 'ACTIVE') {
        setCurrentBlurPx(initialBlurAmount);
        return;
      }
      const totalMs = Math.max(1000, sceneDuration * 1000);
      const clearAtMsRemaining = 2000;
      const updateProgressiveBlur = () => {
        const now = Date.now();
        const leftMs = Math.max(0, (endTime || now + totalMs) - now);
        if (leftMs <= clearAtMsRemaining) {
          setCurrentBlurPx(0);
        } else {
          const effectiveRemaining = leftMs - clearAtMsRemaining;
          const effectiveTotal = Math.max(1000, totalMs - clearAtMsRemaining);
          const ratio = Math.min(1, Math.max(0, effectiveRemaining / effectiveTotal));
          setCurrentBlurPx(Math.round(ratio * initialBlurAmount));
        }
      };
      updateProgressiveBlur();
      const interval = setInterval(updateProgressiveBlur, 100);
      return () => clearInterval(interval);
    }
  }, [el.blurMode, initialBlurAmount, currentSub, isRevealPhase, endTime, sceneDuration, isBillboard]);

  const bgRgba = hexToRgba(el.bgColor || '#000000', el.bgOpacity ?? (el.type === 'QUESTION' ? 85 : 60));
  const filterStyle = currentBlurPx > 0 ? `blur(${currentBlurPx}px)` : 'none';
  const objFit: React.CSSProperties['objectFit'] =
    el.fitMode === 'FILL' ? 'fill' : el.fitMode === 'CONTAIN' ? 'contain' : 'cover';
  const bRadius = `${el.borderRadius !== undefined ? el.borderRadius : 16}px`;

  const baseBoxStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${el.x}%`,
    top: `${el.y}%`,
    width: `${el.w}%`,
    height: `${el.h}%`,
    zIndex: el.z || el.zIndex || 5,
    display: isVisible ? 'flex' : 'none',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box'
  };

  if (el.type === 'QUESTION' || el.type === 'TEXT') {
    return (
      <div style={{
        ...baseBoxStyle,
        height: 'auto',
        minHeight: `${el.h}%`,
        background: bgRgba,
        padding: el.type === 'QUESTION' ? '16px 28px' : '10px',
        borderRadius: bRadius,
        backdropFilter: 'blur(16px)',
        border: 'none',
        color: el.color || '#ffffff',
        fontFamily: el.fontFamily || 'Segoe UI',
        fontSize: getPresentationFontSize(el.fontSize),
        fontWeight: el.fontWeight || (el.bold ? 'bold' : 'normal'),
        whiteSpace: 'pre-wrap',
        textAlign: 'center',
        wordBreak: 'break-word',
        textShadow: '0 2px 10px #000',
        boxShadow: '0 8px 32px rgba(0,0,0,0.8)'
      }}>
        {el.content}
      </div>
    );
  }

  if (el.type === 'IMAGE' && el.content) {
    return (
      <div style={baseBoxStyle}>
        <img
          src={src}
          style={{
            width: '100%', height: '100%', objectFit: objFit,
            borderRadius: bRadius, border: 'none', filter: filterStyle,
            transition: el.blurMode === 'PROGRESSIVE' ? 'filter 0.2s linear' : 'none',
            display: 'block'
          }}
          alt="Medijs"
        />
      </div>
    );
  }

  if (el.type === 'VIDEO' && el.content) {
    return (
      <div style={baseBoxStyle}>
        <video
          ref={(v) => { mediaRef.current = v; }}
          src={src}
          preload="auto"
          style={{
            width: '100%', height: '100%', objectFit: objFit,
            borderRadius: bRadius, border: 'none', filter: filterStyle,
            transition: el.blurMode === 'PROGRESSIVE' ? 'filter 0.2s linear' : 'none',
            display: 'block'
          }}
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
      </div>
    );
  }

  if (el.type === 'AUDIO' && el.content) {
    return (
      <div style={baseBoxStyle}>
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
      </div>
    );
  }

  return null;
};

const renderPresentationDelta = (delta?: number, isMaxClimber?: boolean, hasBaseline: boolean = true) => {
  if (!hasBaseline || delta === undefined || delta === null) {
    return (
      <span style={{ background: 'rgba(255, 255, 255, 0.08)', color: '#888', padding: '2px 7px', borderRadius: '6px', fontSize: '0.8vw', fontWeight: 'bold' }}>
        —
      </span>
    );
  }

  if (isMaxClimber && delta > 1) {
    return (
      <span style={{
        background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.35), rgba(255, 87, 34, 0.35))',
        border: '1.5px solid #ff9800', color: '#ffd700', padding: '2px 8px', borderRadius: '10px',
        fontSize: '0.9vw', fontWeight: '900', display: 'inline-flex', alignItems: 'center', gap: '3px',
        boxShadow: '0 0 14px rgba(255, 152, 0, 0.7)'
      }}>
        🚀 +{delta}
      </span>
    );
  }

  if (delta > 0) {
    return (
      <span style={{
        background: 'rgba(40, 167, 69, 0.25)', border: '1px solid #00ff66', color: '#00ff66',
        padding: '2px 7px', borderRadius: '8px', fontSize: '0.85vw', fontWeight: '900',
        display: 'inline-flex', alignItems: 'center', gap: '2px', boxShadow: '0 0 8px rgba(0, 255, 102, 0.35)'
      }}>
        ▲ +{delta}
      </span>
    );
  }

  if (delta < 0) {
    return (
      <span style={{
        background: 'rgba(220, 53, 69, 0.25)', border: '1px solid #ff4d4d', color: '#ff4d4d',
        padding: '2px 7px', borderRadius: '8px', fontSize: '0.85vw', fontWeight: '900',
        display: 'inline-flex', alignItems: 'center', gap: '2px'
      }}>
        ▼ {Math.abs(delta)}
      </span>
    );
  }

  return (
    <span style={{ background: 'rgba(255, 255, 255, 0.08)', color: '#888', padding: '2px 6px', borderRadius: '6px', fontSize: '0.8vw', fontWeight: 'bold' }}>
      —
    </span>
  );
};

interface TopBarProps {
  pin: string | undefined;
  qrCodeUrl?: string;
  scene: any;
  subState: string;
  summaryStats?: any;
  participantCount: number;
  voteData: { summary: Record<string, number>; votedCount: number; votedPlayerIds?: string[] };
  players: any[];
  isRevealed: boolean;
  isTeamMode: boolean;
  showLargeQr: boolean;
  setShowLargeQr: (show: boolean) => void;
  theme: PresentationTheme;
  remainingSeconds: number;
  totalDurationSeconds: number;
  currentQuestionNum: number;
  totalQuestions: number;
  isScorable: boolean;
}

const TopBar: React.FC<TopBarProps> = ({
  pin, qrCodeUrl, scene, subState, summaryStats, participantCount, voteData,
  players, isRevealed, isTeamMode, showLargeQr, setShowLargeQr, theme,
  remainingSeconds, totalDurationSeconds, currentQuestionNum, totalQuestions, isScorable
}) => {
  const votedCount = voteData.votedCount || 0;
  const unvotedPlayers = players.filter((p) => !p.isDisabled && !(voteData.votedPlayerIds || []).includes(p.id));
  const missingCount = unvotedPlayers.length;

  const duration = scene?.config?.duration ?? scene?.config?.timeLimit ?? 30;
  const hasTimer = duration > 0;
  const currentSub = (subState || scene?.subState || '').toUpperCase();
  const isPaused = currentSub === 'PAUSED';
  const isSummaryPhase = currentSub === 'SUMMARY' || currentSub === 'REVEAL';
  const isTimeFinishedState = ['STATS', 'SUMMARY', 'REVEAL'].includes(currentSub);
  const isContacts = scene?.type === 'CONTACTS';

  const maxPoints = scene?.config?.pointsMax ?? scene?.config?.points ?? 10;
  const minPoints = scene?.config?.pointsMin ?? 1;
  const isDecreasing = scene?.config?.scoringMode === 'DECREASING';

  const calculateCurrentPoints = () => {
    if (!isDecreasing) return maxPoints;
    if (totalDurationSeconds <= 0) return maxPoints;
    if (remainingSeconds <= 0) return minPoints;
    const calculated = Math.round(minPoints + (remainingSeconds / totalDurationSeconds) * (maxPoints - minPoints));
    return Math.max(minPoints, Math.min(maxPoints, calculated));
  };

  const pointsToDisplay = calculateCurrentPoints();
  const displayTime = remainingSeconds;

  const getThemeTopBarStyle = (): React.CSSProperties => {
    const base = {
      position: 'fixed' as const, top: 0, left: 0, width: '100%', height: '84px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px',
      zIndex: 30, boxSizing: 'border-box' as const
    };

    switch (theme) {
      case 'TV_SHOW':
        return {
          ...base,
          background: 'linear-gradient(180deg, rgba(7, 15, 30, 0.96) 0%, rgba(3, 7, 18, 0.90) 100%)',
          borderBottom: '2px solid #ffd700', boxShadow: '0 8px 35px rgba(255, 215, 0, 0.25)'
        };
      case 'ARENA':
        return {
          ...base, background: 'rgba(10, 10, 10, 0.96)',
          borderBottom: '3px solid #ff0055', boxShadow: '0 8px 30px rgba(255, 0, 85, 0.3)'
        };
      case 'MINIMAL':
        return {
          ...base, background: 'rgba(20, 20, 20, 0.75)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)'
        };
      case 'NEON':
      default:
        return {
          ...base, background: 'rgba(20, 20, 20, 0.90)', backdropFilter: 'blur(12px)',
          borderBottom: '2px solid rgba(255,255,255,0.12)'
        };
    }
  };

  return (
    <>
      <div style={getThemeTopBarStyle()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: theme === 'TV_SHOW' ? 'linear-gradient(135deg, #18253d, #0b1528)' : 'rgba(0,0,0,0.85)',
            padding: '6px 14px', borderRadius: '10px', fontSize: '1.2rem', fontWeight: '900',
            border: theme === 'TV_SHOW' ? '2px solid #ffd700' : '2px solid #00ff66',
            color: theme === 'TV_SHOW' ? '#ffd700' : '#fff', letterSpacing: '1px'
          }}>
            PIN: <span style={{ color: theme === 'TV_SHOW' ? '#fff' : '#00ff66' }}>{pin}</span>
          </div>

          {qrCodeUrl && (
            <div
              style={{
                display: 'flex', alignItems: 'center', background: '#fff', padding: '2px',
                borderRadius: '8px', cursor: 'pointer', border: '2px solid #00ff00',
                boxShadow: '0 0 10px rgba(0,255,0,0.4)'
              }}
              onClick={() => setShowLargeQr(!showLargeQr)}
              title="Palielināt / Aizvērt QR kodu [Q]"
            >
              <img src={qrCodeUrl} alt="QR" style={{ width: '44px', height: '44px', borderRadius: '6px' }} />
            </div>
          )}

          {hasTimer && !isContacts && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: isPaused ? 'rgba(255, 152, 0, 0.25)' : displayTime === 0 ? 'rgba(220, 53, 69, 0.25)' : isTimeFinishedState ? 'rgba(0, 229, 255, 0.2)' : displayTime <= 5 ? 'rgba(255, 0, 85, 0.35)' : 'rgba(0, 0, 0, 0.65)',
              border: isPaused ? '2px solid #ff9800' : displayTime === 0 ? '2px solid #dc3545' : isTimeFinishedState ? '2px solid #00e5ff' : displayTime <= 5 ? '2px solid #ff0055' : '2px solid #ffd700',
              borderRadius: '12px', padding: '4px 14px',
              boxShadow: isPaused ? '0 0 15px rgba(255, 152, 0, 0.5)' : displayTime <= 5 && !isPaused && displayTime > 0 ? '0 0 20px #ff0055' : '0 4px 15px rgba(0,0,0,0.6)',
              transition: 'all 0.2s ease'
            }}>
              <span style={{ fontSize: '1.4rem' }}>
                {isPaused ? '⏸️' : isTimeFinishedState && displayTime > 0 ? '⏹️' : displayTime === 0 ? '🛑' : '⏱️'}
              </span>
              <span style={{
                fontSize: '1.8rem', fontWeight: '900',
                color: isPaused ? '#ff9800' : displayTime === 0 ? '#ff4d4d' : isTimeFinishedState ? '#00e5ff' : displayTime <= 5 ? '#ff0055' : '#ffffff',
                minWidth: '40px', textAlign: 'center', fontVariantNumeric: 'tabular-nums'
              }}>
                {displayTime}s
              </span>
            </div>
          )}

          {isScorable && totalQuestions > 0 && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '10px', padding: '6px 12px', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center'
            }}>
              <span style={{ fontSize: '0.65rem', color: '#aaa', fontWeight: 'bold', textTransform: 'uppercase' }}>
                Jautājums
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#00e5ff' }}>
                #{currentQuestionNum} <span style={{ fontSize: '0.8rem', color: '#777' }}>/ {totalQuestions}</span>
              </span>
            </div>
          )}
        </div>

        <div style={votersBox}>
          {isContacts ? (
            <span style={{ color: '#00e5ff', fontSize: '1.2vw', fontWeight: 'bold' }}>
              📋 Anketu aizpildījuši: <strong>{votedCount}</strong> no {participantCount} dalībniekiem
            </span>
          ) : isPaused ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 152, 0, 0.2)', border: '2px solid #ff9800', padding: '6px 16px', borderRadius: '12px' }}>
              <span style={{ color: '#ff9800', fontSize: '1.3vw', fontWeight: '900' }}>
                ⏸️ SPĒLE IEPAUZĒTA
              </span>
            </div>
          ) : isSummaryPhase && (summaryStats || scene?.summaryStats) ? (
            (() => {
              const stats = summaryStats || scene?.summaryStats || {};
              if (stats.isMultiChoice) {
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <span style={summaryPillGreen}>
                      🟩 Pilnīgi: <strong>{stats.fullCorrectCount ?? 0}</strong> ({stats.fullCorrectPct ?? 0}%)
                    </span>
                    <span style={summaryPillYellow}>
                      🟨 Daļēji: <strong>{stats.partialCorrectCount ?? 0}</strong> ({stats.partialCorrectPct ?? 0}%)
                    </span>
                    <span style={summaryPillRed}>
                      🟥 Kļūdaini: <strong>{stats.incorrectCount ?? 0}</strong> ({stats.incorrectPct ?? 0}%)
                    </span>
                  </div>
                );
              }
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span style={summaryPillGreen}>
                    🟩 Pareizi: <strong>{stats.correctCount ?? 0}</strong> ({stats.correctPct ?? 0}%)
                  </span>
                  <span style={summaryPillRed}>
                    🟥 Kļūdaini: <strong>{stats.incorrectCount ?? 0}</strong> ({stats.incorrectPct ?? 0}%)
                  </span>
                </div>
              );
            })()
          ) : missingCount > 5 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', maxWidth: '480px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ color: '#ffc107', fontWeight: 'bold', fontSize: '0.85vw', whiteSpace: 'nowrap' }}>
                GAIDĀM ({missingCount}):
              </span>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', maxHeight: '55px', overflow: 'hidden' }}>
                {[...Array(Math.min(missingCount, 100))].map((_, i) => (
                  <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffd700', boxShadow: '0 0 8px #ffd700' }} />
                ))}
              </div>
            </div>
          ) : missingCount > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ color: '#ffc107', fontWeight: 'bold', fontSize: '0.85vw' }}>
                GAIDĀM ({missingCount}):
              </span>
              {unvotedPlayers.map((p) => (
                <span key={p.id} style={{
                  background: 'rgba(255, 193, 7, 0.25)', border: '1px solid #ffc107', color: '#fff',
                  padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.8vw'
                }}>
                  #{p.deviceNumber || '?'} {p.name}
                </span>
              ))}
            </div>
          ) : (
            <span style={{ color: '#28a745', fontSize: '1.1vw', fontWeight: 'bold' }}>
              ✅ Visas atbildes saņemtas!
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={statsBadge}>👥 {votedCount} / {participantCount}</div>
          {!isContacts && (
            <div style={{
              background: 'linear-gradient(135deg, #ffd700, #b8860b)', color: '#000',
              padding: '6px 18px', borderRadius: '16px', fontWeight: '900', display: 'flex',
              alignItems: 'center', gap: '6px', border: '2px solid #fff',
              boxShadow: '0 4px 20px rgba(255, 215, 0, 0.45)'
            }}>
              <span style={{ fontSize: '1.4rem' }}>⭐</span>
              <span style={{ fontSize: '1.7rem', lineHeight: 1 }}>{pointsToDisplay} PTS</span>
            </div>
          )}
        </div>
      </div>

      {showLargeQr && (
        <div style={modalOverlay} onClick={() => setShowLargeQr(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: '#00ff00', margin: '0 0 15px 0', fontSize: '2vw', fontWeight: 'bold' }}>📲 PIEVIENOJIES SPĒLEI!</h2>
            <img src={qrCodeUrl} alt="Lielais QR" style={{ width: '380px', height: '380px', borderRadius: '20px', background: '#fff', padding: '12px' }} />
            <div style={{ fontSize: '2.5vw', fontWeight: 'bold', color: '#fff', marginTop: '15px' }}>
              PIN: <span style={{ color: '#00ff00' }}>{pin}</span>
            </div>
            <button onClick={() => setShowLargeQr(false)} style={btnCloseModal}>Aizvērt [Q / ✕]</button>
          </div>
        </div>
      )}
    </>
  );
};

export default function Presentation() {
  const { pin: routePin } = useParams<{ pin: string }>();
  const [pin, setPin] = useState<string>('');
  const [scene, setScene] = useState<any>(null);
  const [subState, setSubState] = useState<string>('IDLE');
  const [summaryStats, setSummaryStats] = useState<any>(null);
  const [showLargeQr, setShowLargeQr] = useState<boolean>(false);
  const [isBlackout, setIsBlackout] = useState<boolean>(false);

  const [currentQuestionNum, setCurrentQuestionNum] = useState<number>(0);
  const [totalQuestions, setTotalQuestions] = useState<number>(0);
  const [isScorable, setIsScorable] = useState<boolean>(false);

  const [voteData, setVoteData] = useState<{ summary: Record<string, number>; votedCount: number; votedPlayerIds?: string[] }>({
    summary: {}, votedCount: 0, votedPlayerIds: []
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
  const [isShaking, setIsShaking] = useState(false);

  const [remainingTimerSeconds, setRemainingTimerSeconds] = useState(30);
  const [totalTimerSeconds, setTotalTimerSeconds] = useState(30);
  const [frozenRemainingMs, setFrozenRemainingMs] = useState<number | null>(null);

  const [buzzerWinnerData, setBuzzerWinnerData] = useState<BuzzerWinner | null>(null);

  const [branding, setBranding] = useState<any>({
    lobbyMode: 'INTERACTIVE_DOTS',
    optionsRevealTiming: 'ON_ACTIVE',
    presentationTheme: 'TV_SHOW',
    appTitle: '',
    appLogo: '',
    welcomeImage: '',
    appBgImage: '',
    appBgColor: '#0a0a0a',
    teamModeEnabled: false,
    lobbyBgImage: '',
    lobbyBgColor: '#0a0a0a',
    lobbyTitleText: '🎮 PIESLĒGUŠIES DALĪBNIEKI ({count}):',
    lobbySubtitleText: 'Spiediet telefonā "Pārbaudīt pulti", lai bumbiņa pulsētu! 💥',
    lobbyQrTitle: 'Skenē kamerā!',
    lobbyQrSubtitle: 'Pieslēdzies spēlei',
    lobbyTitleColor: '#ffc107',
    lobbySubtitleColor: '#aaaaaa',
    lobbyBoxBgColor: '#000000',
    lobbyBoxBgOpacity: 85,
    lobbyBoxBorderColor: '#00ff00'
  });

  const [connectionUrl, setConnectionUrl] = useState<string>('');
  const [testedBuzzerCounts, setTestedBuzzerCounts] = useState<Record<string, number>>({});

  const audioBank = useRef<{
    timer: HTMLAudioElement; timeUp: HTMLAudioElement; reveal: HTMLAudioElement; finals: HTMLAudioElement;
  } | null>(null);

  const activeTheme: PresentationTheme = (branding?.presentationTheme || 'TV_SHOW').toUpperCase() as any;

  useEffect(() => {
    const curSub = (subState || scene?.subState || 'IDLE').toUpperCase();
    if (curSub === 'PAUSED') return;

    if (['STATS', 'SUMMARY', 'REVEAL'].includes(curSub)) {
      if (frozenRemainingMs !== null && frozenRemainingMs !== undefined) {
        setRemainingTimerSeconds(Math.max(0, Math.ceil(frozenRemainingMs / 1000)));
      }
      return;
    }

    if (scene?.endTime && curSub === 'ACTIVE') {
      const dur = scene.config?.duration || scene.config?.timeLimit || 30;
      setTotalTimerSeconds(dur);
      const interval = setInterval(() => {
        const left = Math.max(0, Math.ceil((scene.endTime - Date.now()) / 1000));
        setRemainingTimerSeconds(left);
        if (left <= 0) clearInterval(interval);
      }, 100);
      return () => clearInterval(interval);
    } else {
      const dur = scene?.config?.duration || scene?.config?.timeLimit || 30;
      setTotalTimerSeconds(dur);
      setRemainingTimerSeconds(dur);
    }
  }, [scene?.endTime, scene?.id, subState, frozenRemainingMs]);

  const playSynthesizedSfx = (type: string) => {
    try {
      const ctx = getSharedAudioContext();
      if (!ctx) return;
      if (type === 'buzzer_hit' || type === 'wrong') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'correct') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch {}
  };

  useEffect(() => {
    if (!audioBank.current) {
      audioBank.current = {
        timer: new Audio('/sounds/00Time.mp3'),
        timeUp: new Audio('/sounds/01laiksbeidzas.mp3'),
        reveal: new Audio('/sounds/02atklajatbildi.mp3'),
        finals: new Audio('/sounds/04Finals.mp3')
      };
      Object.values(audioBank.current).forEach((a) => { a.preload = 'auto'; });
      audioBank.current.finals.loop = true;
    }
    return () => {
      if (audioBank.current) {
        Object.values(audioBank.current).forEach((a) => {
          try { a.pause(); a.currentTime = 0; } catch {}
        });
      }
    };
  }, []);

  const playSound = (audio: HTMLAudioElement | undefined) => {
    if (!audio || !isMediaReady) return;
    try { if (audio.paused) audio.play().catch(() => {}); } catch {}
  };

  const stopSound = (audio: HTMLAudioElement | undefined) => {
    if (!audio) return;
    try { audio.pause(); audio.currentTime = 0; } catch {}
  };

  const pauseSoundOnly = (audio: HTMLAudioElement | undefined) => {
    if (!audio) return;
    try { audio.pause(); } catch {}
  };

  const hasCustomMediaDuringQuestion = !!(scene?.config?.layout || []).some(
    (el: any) => (el.type === 'AUDIO' || el.type === 'VIDEO') && el.content && String(el.content).trim() !== '' &&
      (el.visibility === 'ALWAYS' || el.visibility === 'DURING_QUESTION' || el.visibility === 'UNTIL_REVEAL')
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
        else if (d?.localIp && d.localIp !== 'localhost') setConnectionUrl(`http://${d.localIp}:5173`);
      })
      .catch(() => {});

    const handleJoinSuccess = (data: any) => {
      if (data?.connectionUrl) setConnectionUrl(data.connectionUrl);
      if (data?.currentScene) setScene(data.currentScene);
      if (data?.subState) setSubState(String(data.subState).toUpperCase());
      if (data?.isBlackout !== undefined) setIsBlackout(data.isBlackout);
      if (data?.summaryStats) setSummaryStats(data.summaryStats);
      if (data?.frozenRemainingMs !== undefined) setFrozenRemainingMs(data.frozenRemainingMs);
      if (data?.currentQuestionNum !== undefined) setCurrentQuestionNum(data.currentQuestionNum);
      if (data?.totalQuestions !== undefined) setTotalQuestions(data.totalQuestions);
      if (data?.isScorable !== undefined) setIsScorable(Boolean(data.isScorable));
      if (data?.branding) {
        setBranding((prev: any) => ({ ...prev, ...data.branding }));
        if (data.branding.teamModeEnabled !== undefined) setShowTeamLeaderboard(Boolean(data.branding.teamModeEnabled));
      }
    };

    const handleSessionInfo = (data: any) => {
      if (data?.state?.connectionUrl) setConnectionUrl(data.state.connectionUrl);
      if (data?.state?.currentScene) setScene(data.state.currentScene);
      if (data?.state?.subState) setSubState(String(data.state.subState).toUpperCase());
      if (data?.state?.isBlackout !== undefined) setIsBlackout(data.state.isBlackout);
      if (data?.state?.summaryStats) setSummaryStats(data.state.summaryStats);
      if (data?.state?.frozenRemainingMs !== undefined) setFrozenRemainingMs(data.state.frozenRemainingMs);
      if (data?.currentQuestionNum !== undefined) setCurrentQuestionNum(data.currentQuestionNum);
      if (data?.totalQuestions !== undefined) setTotalQuestions(data.totalQuestions);
      if (data?.isScorable !== undefined) setIsScorable(Boolean(data.isScorable));
      if (data?.state?.branding) {
        setBranding((prev: any) => ({ ...prev, ...data.state.branding }));
        if (data.state.branding.teamModeEnabled !== undefined) setShowTeamLeaderboard(Boolean(data.state.branding.teamModeEnabled));
      }
    };

    const handleSessionBranding = (br: any) => {
      if (br && Object.keys(br).length > 0) {
        setBranding((prev: any) => ({ ...prev, ...br }));
        if (br.teamModeEnabled !== undefined) setShowTeamLeaderboard(Boolean(br.teamModeEnabled));
      }
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
          setBuzzerWinnerData(null);
          setFrozenRemainingMs(null);
        }
        return newScene;
      });

      const nextSub = (newScene?.subState || 'READY').toUpperCase();
      setSubState(nextSub);
      if (newScene?.frozenRemainingMs !== undefined) setFrozenRemainingMs(newScene.frozenRemainingMs);
      if (newScene?.isBlackout !== undefined) setIsBlackout(newScene.isBlackout);
      if (newScene?.summaryStats) setSummaryStats(newScene.summaryStats);
      if (newScene?.currentQuestionNum !== undefined) setCurrentQuestionNum(newScene.currentQuestionNum);
      if (newScene?.totalQuestions !== undefined) setTotalQuestions(newScene.totalQuestions);
      if (newScene?.isScorable !== undefined) setIsScorable(Boolean(newScene.isScorable));
      if (nextSub === 'REVEAL') setIsRevealed(true);
      setPodiumStage(0);
    };

    const handleSessionPaused = () => setSubState('PAUSED');
    const handleSessionResumed = () => setSubState('ACTIVE');
    const handleBlackoutToggled = (active: boolean) => setIsBlackout(active);

    const handleSessionEnded = () => {
      localStorage.removeItem('presentation_pin');
      setIsSessionClosed(true);
      setScene(null);
      window.close();
    };

    const handleVotesUpdated = (data: any) => {
      setVoteData((prev) => ({
        summary: data?.summary || {},
        votedCount: data?.votedCount ?? prev.votedCount,
        votedPlayerIds: data?.votedPlayerIds !== undefined ? data.votedPlayerIds : prev.votedPlayerIds
      }));
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

    const handlePlaySfx = (data: { sfx: string }) => playSynthesizedSfx(data.sfx);

    const handleBuzzerRacePress = (data: { winner: any }) => {
      if (data?.winner?.position === 1) {
        setBuzzerWinnerData(data.winner);
        playSynthesizedSfx('buzzer_hit');
      }
    };

    const handleToggleChart = () => setIsStatsVisible((prev) => !prev);
    const handleToggleLargeQr = () => setShowLargeQr((prev) => !prev);

    const handleToggleTeamView = (data?: { view?: 'TEAMS' | 'INDIVIDUAL'; page?: number }) => {
      if (data?.view) setShowTeamLeaderboard(data.view === 'TEAMS');
      else setShowTeamLeaderboard((prev) => !prev);
      setLeaderboardPage(data?.page !== undefined ? data.page : 0);
    };

    const handleBuzzerTest = (data: { playerId: string }) => {
      setTestedBuzzerCounts((prev) => ({ ...prev, [data.playerId]: (prev[data.playerId] || 0) + 1 }));
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
      const list = Array.isArray(payload) ? payload : payload?.data || [];
      setTeamLeaderboard(list);
      if (payload?.lbType) setLeaderboardType(payload.lbType.toUpperCase());
    };

    const handlePodiumStageChange = (stage: number) => {
      setPodiumStage(stage);
      if (stage === 3) {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 650);
      }
    };

    const handleThemeChange = (newTheme: PresentationTheme) => {
      setBranding((prev: any) => ({ ...prev, presentationTheme: newTheme }));
    };

    socket.on('join-success', handleJoinSuccess);
    socket.on('session-info', handleSessionInfo);
    socket.on('session-branding', handleSessionBranding);
    socket.on('connection-url-changed', (url) => url && setConnectionUrl(url));
    socket.on('tunnel-ready', (data) => data?.url && setConnectionUrl(data.url));
    socket.on('state-update', handleStateUpdate);
    socket.on('session-paused', handleSessionPaused);
    socket.on('session-resumed', handleSessionResumed);
    socket.on('blackout-toggled', handleBlackoutToggled);
    socket.on('session-ended', handleSessionEnded);
    socket.on('session-closed', handleSessionEnded);
    socket.on('votes-updated', handleVotesUpdated);
    socket.on('presence-update', handlePresenceUpdate);
    socket.on('results-revealed', handleResultsRevealed);
    socket.on('play-sfx', handlePlaySfx);
    socket.on('buzzer-race-press', handleBuzzerRacePress);
    socket.on('toggle-audience-chart', handleToggleChart);
    socket.on('toggle-team-leaderboard', handleToggleTeamView);
    socket.on('toggle-large-qr', handleToggleLargeQr);
    socket.on('player-buzzer-test', handleBuzzerTest);
    socket.on('leaderboard-update', handleLeaderboardUpdate);
    socket.on('team-leaderboard-update', handleTeamLeaderboardUpdate);
    socket.on('podium-stage-change', handlePodiumStageChange);
    socket.on('leaderboard-page-change', (page: number) => setLeaderboardPage(page));
    socket.on('theme-changed', handleThemeChange);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'c' || e.key === 'C') { e.preventDefault(); setIsStatsVisible((prev) => !prev); }
      else if (e.key === 't' || e.key === 'T') { e.preventDefault(); setShowTeamLeaderboard((prev) => !prev); setLeaderboardPage(0); }
      else if (e.key === 'q' || e.key === 'Q') { e.preventDefault(); setShowLargeQr((prev) => !prev); }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      socket.off('join-success', handleJoinSuccess);
      socket.off('session-info', handleSessionInfo);
      socket.off('session-branding', handleSessionBranding);
      socket.off('connection-url-changed');
      socket.off('tunnel-ready');
      socket.off('state-update', handleStateUpdate);
      socket.off('session-paused', handleSessionPaused);
      socket.off('session-resumed', handleSessionResumed);
      socket.off('blackout-toggled', handleBlackoutToggled);
      socket.off('session-ended', handleSessionEnded);
      socket.off('session-closed', handleSessionEnded);
      socket.off('votes-updated', handleVotesUpdated);
      socket.off('presence-update', handlePresenceUpdate);
      socket.off('results-revealed', handleResultsRevealed);
      socket.off('play-sfx', handlePlaySfx);
      socket.off('buzzer-race-press', handleBuzzerRacePress);
      socket.off('toggle-audience-chart', handleToggleChart);
      socket.off('toggle-team-leaderboard', handleToggleTeamView);
      socket.off('toggle-large-qr', handleToggleLargeQr);
      socket.off('player-buzzer-test', handleBuzzerTest);
      socket.off('leaderboard-update', handleLeaderboardUpdate);
      socket.off('team-leaderboard-update', handleTeamLeaderboardUpdate);
      socket.off('podium-stage-change', handlePodiumStageChange);
      socket.off('leaderboard-page-change');
      socket.off('theme-changed');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [routePin]);

  const isTeamMode = !!branding?.teamModeEnabled;
  const currentSub = (subState || scene?.subState || 'IDLE').toUpperCase();
  const isQuestionType = scene?.type === 'QUESTION' || scene?.type === 'QUIZ' || scene?.type === 'MAJORITY' || scene?.type === 'VOTE' || scene?.type === 'ORDERING';
  const isRoundLb = (scene?.config?.lbType || leaderboardType || '').toUpperCase() === 'ROUND';
  const isFinalLb = scene?.type === 'LEADERBOARD' && (scene?.config?.lbType === 'FINAL' || leaderboardType === 'FINAL');
  const isFullContent = scene?.type === 'BILLBOARD' || scene?.type === 'LEADERBOARD' || scene?.type === 'TIMER';

  useEffect(() => {
    if (!isMediaReady || !audioBank.current) return;
    if (isBlackout) {
      pauseSoundOnly(audioBank.current.timer);
      stopSound(audioBank.current.timeUp);
      stopSound(audioBank.current.reveal);
      stopSound(audioBank.current.finals);
      return;
    }
    if (currentSub === 'PAUSED') { pauseSoundOnly(audioBank.current.timer); return; }
    if (currentSub === 'ACTIVE' && isQuestionType) {
      stopSound(audioBank.current.timeUp);
      stopSound(audioBank.current.reveal);
      stopSound(audioBank.current.finals);
      if (hasCustomMediaDuringQuestion) pauseSoundOnly(audioBank.current.timer);
      else playSound(audioBank.current.timer);
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
  }, [currentSub, isQuestionType, hasCustomMediaDuringQuestion, isFinalLb, isMediaReady, isBlackout]);

  const handleCustomMediaEnded = () => {
    if (currentSub === 'ACTIVE' && isQuestionType && audioBank.current && !isBlackout) {
      playSound(audioBank.current.timer);
    }
  };

  const handleStartPresentation = async () => {
    setIsMediaReady(true);
    getSharedAudioContext()?.resume().catch(() => {});
    if (!audioBank.current) return;
    for (const sound of Object.values(audioBank.current)) {
      try {
        sound.muted = true;
        await sound.play();
        sound.pause();
        sound.currentTime = 0;
        sound.muted = false;
        sound.volume = 1.0;
      } catch {
        sound.muted = false;
        sound.volume = 1.0;
      }
    }
  };

  if (isSessionClosed) {
    return (
      <div style={fullScreenCenter}>
        <div style={{ textAlign: 'center', background: 'rgba(20, 20, 20, 0.95)', padding: '40px', borderRadius: '24px' }}>
          <h1 style={{ color: '#ffc107', fontSize: '3vw', margin: '0 0 15px 0' }}>👋 SPĒLES SESIJA IR BEIGUSIES</h1>
          <p style={{ color: '#ccc', fontSize: '1.4vw', margin: '0 0 25px 0' }}>Vadītājs ir noslēdzis šo sesiju. Šo logu var droši aizvērt.</p>
          <button onClick={() => window.close()} style={bigBtn}>Aizvērt logu</button>
        </div>
      </div>
    );
  }

  if (!isMediaReady) {
    return (
      <div style={fullScreenCenter}>
        <button onClick={handleStartPresentation} style={bigBtn}>🚀 SĀKT PREZENTĀCIJU</button>
      </div>
    );
  }

  const baseHost = connectionUrl && connectionUrl.trim() !== '' ? connectionUrl.trim() : window.location.origin;
  const joinUrl = `${baseHost.replace(/\/$/, '')}/?pin=${pin}`;
  const qrCodeUrl = getOfflineQrCodeUrl(joinUrl, 380);

  if (isBlackout) {
    return (
      <div style={{ ...fullScreenCenter, backgroundColor: '#000000', zIndex: 9999999 }}>
        {branding.appLogo ? (
          <img
            src={`${MEDIA_BASE_URL}/${branding.appLogo}`}
            alt="Logo"
            style={{ maxHeight: '180px', maxWidth: '75%', objectFit: 'contain', opacity: 0.9, filter: 'drop-shadow(0 0 30px rgba(255,255,255,0.2))' }}
          />
        ) : (
          <div style={{ color: '#333', fontSize: '2.5vw', fontWeight: 'bold', letterSpacing: '4px' }}>
            EVENT STUDIO
          </div>
        )}
      </div>
    );
  }

  if (!scene) {
    const lobbyMode = branding?.lobbyMode || 'INTERACTIVE_DOTS';
    const lobbyBg = branding.lobbyBgImage
      ? `url(${MEDIA_BASE_URL}/${encodeURIComponent(branding.lobbyBgImage).replace(/%2F/g, '/')}) center/cover no-repeat`
      : branding.lobbyBgColor || '#0a0a0a';

    const lobbyBoxBg = hexToRgba(branding.lobbyBoxBgColor || '#000000', branding.lobbyBoxBgOpacity ?? 85);
    const lobbyBorder = branding.lobbyBoxBorderColor || '#00ff00';

    const titleText = (branding.lobbyTitleText || '🎮 PIESLĒGUŠIES DALĪBNIEKI ({count}):').replace('{count}', String(participantCount));
    const subtitleText = branding.lobbySubtitleText || 'Spiediet telefonā "Pārbaudīt pulti", lai bumbiņa pulsētu! 💥';
    const qrTitle = branding.lobbyQrTitle || 'Skenē kamerā!';
    const qrSubtitle = branding.lobbyQrSubtitle || 'Pieslēdzies spēlei';

    if (lobbyMode === 'INTERACTIVE_DOTS') {
      const orbCfg = getDynamicOrbConfig(players.length);
      return (
        <div style={{ ...fullScreen, background: lobbyBg, padding: '24px 35px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div style={{ border: `3.5px solid ${lobbyBorder}`, padding: '10px 30px', borderRadius: '18px', background: lobbyBoxBg, backdropFilter: 'blur(10px)' }}>
              <span style={{ fontSize: '1.4vw', color: '#aaa' }}>PIN: </span>
              <span style={{ fontSize: '3.6vw', color: lobbyBorder, fontWeight: 'bold' }}>{pin}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', background: '#fff', padding: '12px 22px', borderRadius: '20px', boxShadow: `0 10px 40px ${hexToRgba(lobbyBorder, 40)}` }}>
              <img src={qrCodeUrl} alt="QR" style={{ width: '140px', height: '140px' }} />
              <div style={{ textAlign: 'left', color: '#000' }}>
                <div style={{ fontWeight: '900', fontSize: '1.4vw', textTransform: 'uppercase' }}>{qrTitle}</div>
                <div style={{ fontSize: '1vw', color: '#333', marginTop: '4px' }}>{qrSubtitle}</div>
              </div>
            </div>
          </div>

          <div style={{ margin: '10px 0', textAlign: 'center' }}>
            <h2 style={{ fontSize: '2.2vw', color: branding.lobbyTitleColor || '#ffc107', margin: 0, fontWeight: '900' }}>
              {titleText}
            </h2>
            <span style={{ fontSize: '1vw', color: branding.lobbySubtitleColor || '#aaaaaa' }}>
              {subtitleText}
            </span>
          </div>

          <div style={{ flex: 1, width: '100%', display: 'flex', flexWrap: 'wrap', gap: `${orbCfg.gap}px`, justifyContent: 'center', alignItems: 'center', alignContent: 'center', overflow: 'hidden' }}>
            {players.length === 0 ? (
              <div style={{ color: '#666', fontSize: '1.8vw', fontStyle: 'italic' }}>Gaidām dalībnieku pieslēgšanos...</div>
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

                return (
                  <div key={p.id || idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: `${orbCfg.maxW}px`, transform: `scale(${currentScale})`, transition: 'all 0.25s ease' }}>
                    <div style={{ width: `${orbCfg.size}px`, height: `${orbCfg.size}px`, borderRadius: '50%', background: `radial-gradient(circle at 35% 35%, #fff, ${pal.base} 45%, ${pal.dark} 100%)`, boxShadow: `0 0 25px ${pal.glow}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: pal.text, fontWeight: '900', fontSize: orbCfg.numFont }}>
                      #{p.deviceNumber || idx + 1}
                    </div>
                    {orbCfg.showName && (
                      <span style={{ fontSize: orbCfg.nameFont, fontWeight: 'bold', color: '#fff', marginTop: '4px', maxWidth: `${orbCfg.maxW}px`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

    const circleSize = `${Math.min(14 + participantCount * 0.2, 28)}vw`;
    return (
      <div style={{ ...fullScreenCenter, background: lobbyBg, gap: '2vw' }}>
        <h1 style={{ fontSize: '2.5vw', color: branding.lobbyTitleColor || '#aaa', margin: 0, letterSpacing: '2px', fontWeight: '900' }}>
          {titleText}
        </h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '50px' }}>
          <div style={{ border: `6px solid ${lobbyBorder}`, padding: '1.5vw 3.5vw', borderRadius: '30px', background: lobbyBoxBg, boxShadow: `0 0 40px ${hexToRgba(lobbyBorder, 35)}` }}>
            <h1 style={{ fontSize: '8vw', margin: 0, letterSpacing: '0.8vw', lineHeight: 1, color: '#fff' }}>{pin}</h1>
          </div>
          
          <div style={{ background: '#fff', padding: '18px 24px', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 15px 50px rgba(255,255,255,0.2)' }}>
            <img src={qrCodeUrl} alt="QR" style={{ width: '220px', height: '220px', display: 'block' }} />
            <span style={{ color: '#000', fontSize: '1.1vw', fontWeight: '900', marginTop: '10px', textTransform: 'uppercase' }}>
              {qrTitle}
            </span>
          </div>
        </div>

        <div style={{ width: circleSize, height: circleSize, border: `0.8vw solid ${lobbyBorder}`, borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 50px ${lobbyBorder}`, background: lobbyBoxBg }}>
          <span style={{ fontSize: '5vw', fontWeight: 'bold', color: '#fff', lineHeight: 1 }}>{participantCount}</span>
          <span style={{ fontSize: '1.1vw', color: branding.lobbySubtitleColor || '#aaa', marginTop: '0.4vw', textTransform: 'uppercase' }}>
            {participantCount === 1 ? 'Dalībnieks' : 'Dalībnieki'}
          </span>
        </div>
      </div>
    );
  }

  const getThemeBackground = () => {
    if (scene?.config?.backgroundUrl) {
      return `url(${MEDIA_BASE_URL}/${encodeURIComponent(scene.config.backgroundUrl).replace(/%2F/g, '/')}) center / cover no-repeat`;
    }
    switch (activeTheme) {
      case 'TV_SHOW': return 'radial-gradient(ellipse at 50% 30%, #0d1b33 0%, #030712 100%)';
      case 'ARENA': return 'linear-gradient(135deg, #120207 0%, #050505 60%, #150009 100%)';
      case 'MINIMAL': return 'linear-gradient(180deg, #18181b 0%, #09090b 100%)';
      case 'NEON':
      default: return '#000000';
    }
  };

  const containerStyle: React.CSSProperties = {
    ...fullScreen,
    backgroundColor: '#000000',
    background: getThemeBackground(),
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    position: 'relative'
  };

  const rawOptions: string[] = scene?.config?.options || (scene?.config?.optionsCount ? ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, scene.config.optionsCount) : []);
  const optionsList: string[] = rawOptions.length > 0 ? rawOptions : ['A', 'B', 'C', 'D'];
  const optLayout = scene?.config?.optionsLayout || 'INDIVIDUAL';
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
  const currentRemainingPageList = remainingList.slice(leaderboardPage * 12, (leaderboardPage + 1) * 12);

  const maxClimberDelta = Math.max(0, ...activePodiumList.map((x) => (x.previousRank ? (x.rankDelta || 0) : 0)));
  const biggestClimber = (!isRoundLb && maxClimberDelta > 1) ? activePodiumList.find((x) => x.rankDelta === maxClimberDelta && x.previousRank) : null;

  const optionsRevealTiming = branding?.optionsRevealTiming || 'ON_ACTIVE';
  const shouldShowOptions =
    isQuestionType &&
    optionsList.length > 0 &&
    (optionsRevealTiming === 'ALWAYS' ? true : ['ACTIVE', 'PAUSED', 'STATS', 'SUMMARY', 'REVEAL'].includes(currentSub));

  const effectiveCorrectAnswers = isRevealed ? (revealedCorrectAnswers.length > 0 ? revealedCorrectAnswers : (scene?.config?.correctAnswers || [])) : [];
  const effectiveCorrectnessMap = isRevealed ? (Object.keys(revealedCorrectnessMap).length > 0 ? revealedCorrectnessMap : (scene?.config?.answerCorrectness || {})) : {};

  const optCustomBg = scene?.config?.optionsBgColor || '#000000';
  const optCustomOpacity = scene?.config?.optionsBgOpacity ?? 85;
  const optCustomColor = scene?.config?.optionsColor || '#ffffff';
  const optCorrectColor = scene?.config?.optionsCorrectColor || '#00ff00';
  const totalVotesReceived = voteData.votedCount || 1;

  // 🌟 PREZĪZI SALABOTS ATBILŽU LOGU KRĀSAS RENDERIS
  const renderOptionItem = (opt: string, i: number, customStyle: React.CSSProperties = {}) => {
    const letter = String.fromCharCode(65 + i);
    const optKey = (opt && opt.trim() !== '') ? opt : letter;
    const isCorrect = isRevealed && (
      effectiveCorrectAnswers.includes(optKey) ||
      effectiveCorrectAnswers.includes(letter) ||
      (opt && opt.trim() !== '' && effectiveCorrectAnswers.includes(opt))
    );

    const count = voteData.summary[opt] ?? voteData.summary[letter] ?? 0;
    const pct = effectiveCorrectnessMap[optKey] ?? effectiveCorrectnessMap[letter];
    const pctOfVotes = Math.round((count / totalVotesReceived) * 100);
    const isOnlyLetter = !opt || opt.trim() === '';
    const isZeroOpacity = optCustomOpacity === 0;

    // 1. Pamatkrāsa tieši no Studijā iestatītās krāsas un caurspīdīguma
    let cardBg = isZeroOpacity || isOnlyLetter ? 'transparent' : hexToRgba(optCustomBg, optCustomOpacity);

    // 2. Ja atbilde ir atklāta kā pareiza — maigi sapludinām lietotāja fonu ar pareizās atbildes krāsu
    if (!isZeroOpacity && !isOnlyLetter) {
      if (isCorrect) {
        cardBg = `linear-gradient(135deg, ${hexToRgba(optCorrectColor, 65)}, ${hexToRgba(optCustomBg, Math.min(100, optCustomOpacity + 10))})`;
      } else if (optCustomBg.toLowerCase() === '#000000' && optCustomOpacity === 85) {
        // TIKAI tad, ja lietotājs VISPĀR NAV mainījis noklusēto melno krāsu, piemērojam tēmas fona efektu:
        if (activeTheme === 'TV_SHOW') {
          cardBg = 'linear-gradient(135deg, rgba(16, 26, 46, 0.95), rgba(7, 13, 26, 0.95))';
        } else if (activeTheme === 'ARENA') {
          cardBg = 'rgba(15, 15, 15, 0.95)';
        } else if (activeTheme === 'MINIMAL') {
          cardBg = 'rgba(25, 25, 25, 0.75)';
        }
      }
    }

    let cardBorder = isZeroOpacity || isOnlyLetter
      ? 'none'
      : isCorrect
      ? (activeTheme === 'TV_SHOW' ? '3px solid #ffd700' : `3.5px solid ${optCorrectColor}`)
      : activeTheme === 'TV_SHOW'
      ? '2px solid rgba(255, 215, 0, 0.4)'
      : activeTheme === 'ARENA'
      ? '2px solid #333'
      : activeTheme === 'MINIMAL'
      ? '1px solid rgba(255,255,255,0.18)'
      : '1px solid rgba(255,255,255,0.12)';

    return (
      <div
        key={`opt-${i}`}
        style={{
          ...optionCard,
          ...customStyle,
          background: cardBg,
          backdropFilter: isZeroOpacity || isOnlyLetter ? 'none' : 'blur(14px)',
          boxShadow: isZeroOpacity || isOnlyLetter
            ? 'none'
            : isCorrect
            ? `0 0 18px ${optCorrectColor}, 0 0 40px ${hexToRgba(optCorrectColor, 60)}, 0 0 75px ${hexToRgba(optCorrectColor, 35)}, 0 10px 30px rgba(0,0,0,0.85)`
            : '0 10px 30px rgba(0,0,0,0.85)',
          border: cardBorder,
          position: customStyle.position || 'relative',
          overflow: 'visible',
          animation: (!isOnlyLetter && isCorrect) ? 'correctGlowPulse 1.4s infinite ease-in-out' : 'none',
          padding: isOnlyLetter ? '0' : isZeroOpacity ? '4px 8px' : '10px 18px',
          justifyContent: isOnlyLetter ? 'center' : 'space-between',
          zIndex: isCorrect ? 25 : 10,
          boxSizing: 'border-box'
        }}
      >
        {isRevealed && !isOnlyLetter && (
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%', width: `${pctOfVotes}%`,
            background: isCorrect ? hexToRgba(optCorrectColor, 25) : 'rgba(255, 255, 255, 0.08)',
            borderRadius: '16px', zIndex: 1, transition: 'width 0.8s cubic-bezier(0.1, 0.9, 0.2, 1)'
          }} />
        )}

        <div style={{ display: 'flex', alignItems: 'center', zIndex: 2, flex: isOnlyLetter ? 'none' : 1, width: isOnlyLetter ? 'auto' : '100%', justifyContent: isOnlyLetter ? 'center' : 'flex-start', overflow: 'visible' }}>
          <div style={{
            width: '50px', height: '50px',
            borderRadius: activeTheme === 'TV_SHOW' ? '14px' : '50%',
            background: isCorrect ? optCorrectColor : activeTheme === 'TV_SHOW' ? '#ffd700' : '#111',
            color: isCorrect ? '#000' : activeTheme === 'TV_SHOW' ? '#000' : '#ffc107',
            border: isCorrect ? '3.5px solid #ffffff' : activeTheme === 'TV_SHOW' ? '2px solid #fff' : '2px solid #ffc107',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '1.8vw',
            flexShrink: 0,
            boxShadow: isCorrect ? `0 0 15px ${optCorrectColor}, 0 0 30px ${hexToRgba(optCorrectColor, 60)}` : 'none',
            transition: 'all 0.3s ease'
          }}>
            {letter}
          </div>

          {!isOnlyLetter && (
            <span style={{
              fontSize: getOptionFontSize(opt),
              color: isCorrect ? '#ffffff' : optCustomColor,
              fontWeight: 'bold',
              marginLeft: '14px',
              wordBreak: 'break-word',
              lineHeight: 1.2
            }}>
              {opt} {isCorrect && pct !== undefined && pct < 100 && `(+${pct}%)`}
            </span>
          )}
        </div>

        {(isStatsVisible || isRevealed) && !isOnlyLetter && (
          <span style={{ ...voteBadge, zIndex: 2 }}>{count} ({pctOfVotes}%)</span>
        )}
      </div>
    );
  };

  const getLeaderboardTitle = () => {
    if (isTeamMode && showTeamLeaderboard) {
      return isRoundLb ? '🏆 KOMANDU KĀRTAS REZULTĀTI' : '👥 KOMANDU KOPVĒRTĒJUMS';
    }
    return isRoundLb ? '🏆 KĀRTAS REZULTĀTI' : '⭐ KOPVĒRTĒJUMS';
  };

  return (
    <div style={containerStyle} className={isShaking ? 'screen-shake' : ''}>
      <style>{`
        @keyframes correctGlowPulse {
          0% { transform: scale(1); box-shadow: 0 0 15px ${optCorrectColor}, 0 0 35px ${hexToRgba(optCorrectColor, 60)}, 0 0 65px ${hexToRgba(optCorrectColor, 30)}; }
          50% { transform: scale(1.03); box-shadow: 0 0 25px ${optCorrectColor}, 0 0 55px ${hexToRgba(optCorrectColor, 75)}, 0 0 95px ${hexToRgba(optCorrectColor, 40)}, 0 0 130px ${hexToRgba(optCorrectColor, 20)}; }
          100% { transform: scale(1); box-shadow: 0 0 15px ${optCorrectColor}, 0 0 35px ${hexToRgba(optCorrectColor, 60)}, 0 0 65px ${hexToRgba(optCorrectColor, 30)}; }
        }
        @keyframes dangerPulse {
          0% { transform: scale(1); filter: drop-shadow(0 0 10px #ff0055); }
          100% { transform: scale(1.12); filter: drop-shadow(0 0 35px #ff0055); }
        }
        @keyframes impactShake {
          0% { transform: translate(0, 0); }
          20% { transform: translate(-8px, 6px); }
          40% { transform: translate(8px, -6px); }
          60% { transform: translate(-5px, -3px); }
          80% { transform: translate(4px, 4px); }
          100% { transform: translate(0, 0); }
        }
        .screen-shake {
          animation: impactShake 0.6s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
        @keyframes swingBeamLeft {
          0% { transform: rotate(-28deg); opacity: 0.35; }
          50% { transform: rotate(14deg); opacity: 0.65; }
          100% { transform: rotate(-28deg); opacity: 0.35; }
        }
        @keyframes swingBeamRight {
          0% { transform: rotate(28deg); opacity: 0.35; }
          50% { transform: rotate(-14deg); opacity: 0.65; }
          100% { transform: rotate(28deg); opacity: 0.35; }
        }
        .spotlight-beam-left {
          position: absolute; top: -100px; left: 15%; width: 280px; height: 1400px;
          background: linear-gradient(180deg, rgba(255, 215, 0, 0.28) 0%, rgba(255, 215, 0, 0) 80%);
          transform-origin: top center; animation: swingBeamLeft 7s infinite ease-in-out; filter: blur(25px);
        }
        .spotlight-beam-right {
          position: absolute; top: -100px; right: 15%; width: 280px; height: 1400px;
          background: linear-gradient(180deg, rgba(0, 229, 255, 0.28) 0%, rgba(0, 229, 255, 0) 80%);
          transform-origin: top center; animation: swingBeamRight 7s infinite ease-in-out; filter: blur(25px);
        }
      `}</style>

      {(activeTheme === 'TV_SHOW' || activeTheme === 'ARENA' || isFinalLb) && <SpotlightBeams />}
      <ConfettiCanvas active={isFinalLb && podiumStage >= 3} />

      <TopTimeProgressBar
        remainingSec={remainingTimerSeconds}
        totalSec={totalTimerSeconds}
        isPaused={currentSub === 'PAUSED'}
        isActive={currentSub === 'ACTIVE'}
      />

      {scene?.type === 'TIMER' && scene.config?.timerBgVideo && (
        <video
          src={`${MEDIA_BASE_URL}/${scene.config.timerBgVideo}`}
          autoPlay loop={scene.config.timerBgVideoLoop !== false} muted playsInline
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1 }}
        />
      )}

      {!isFullContent && (
        <TopBar
          pin={pin} qrCodeUrl={qrCodeUrl} scene={scene} subState={subState}
          summaryStats={summaryStats} participantCount={participantCount} voteData={voteData}
          players={players} isRevealed={isRevealed} isTeamMode={isTeamMode}
          showLargeQr={showLargeQr} setShowLargeQr={setShowLargeQr} theme={activeTheme}
          remainingSeconds={remainingTimerSeconds} totalDurationSeconds={totalTimerSeconds}
          currentQuestionNum={currentQuestionNum} totalQuestions={totalQuestions} isScorable={isScorable}
        />
      )}

      {/* 🎯 GALVENAIS 16:9 KANVAS LAUKUMS */}
      <div style={{
        position: 'absolute', top: isFullContent ? 0 : '84px', bottom: 0, left: 0, right: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', zIndex: 10
      }}>
        <div style={{
          width: isFullContent ? 'min(100vw, calc(100vh * 16 / 9))' : 'min(100vw, calc((100vh - 84px) * 16 / 9))',
          height: isFullContent ? 'min(100vh, calc(100vw * 9 / 16))' : 'min(calc(100vh - 84px), calc(100vw * 9 / 16))',
          aspectRatio: '16 / 9', position: 'relative', overflow: 'hidden', boxSizing: 'border-box'
        }}>
          {scene?.config?.layout?.map((el: any, idx: number) => (
            <MediaLayoutItem
              key={el.id || `layout-el-${idx}`}
              el={el} subState={currentSub} isRevealed={isRevealed}
              sceneDuration={scene?.config?.duration || scene?.config?.timeLimit || 30}
              sceneType={scene?.type} endTime={scene?.endTime} onCustomMediaEnded={handleCustomMediaEnded}
            />
          ))}

          {/* KONTAKTI */}
          {scene?.type === 'CONTACTS' && (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', zIndex: 20, padding: '40px', boxSizing: 'border-box' }}>
              <div style={{ background: 'rgba(10, 15, 25, 0.94)', border: '3px solid #00e5ff', borderRadius: '24px', padding: '40px 60px', maxWidth: '820px', boxShadow: '0 20px 70px rgba(0, 229, 255, 0.25)', backdropFilter: 'blur(16px)' }}>
                <div style={{ fontSize: '4.5rem', marginBottom: '8px' }}>📋</div>
                <h1 style={{ fontSize: '3vw', color: '#00e5ff', margin: '0 0 12px 0', fontWeight: '900', letterSpacing: '1px' }}>
                  {scene.config?.contactsTitle || 'DALĪBNIEKU ANKETA'}
                </h1>
                <p style={{ fontSize: '1.4vw', color: '#fff', margin: '0 0 25px 0', lineHeight: 1.4 }}>
                  {scene.config?.contactsDescription || 'Lūdzu, atveriet savu tālruni un aizpildiet dalībnieka anketu!'}
                </p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '15px', background: 'rgba(0, 229, 255, 0.15)', border: '1.5px solid #00e5ff', padding: '12px 28px', borderRadius: '16px' }}>
                  <span style={{ fontSize: '1.2vw', color: '#aaa', fontWeight: 'bold' }}>Aizpildījuši dalībnieki:</span>
                  <span style={{ fontSize: '2.2vw', fontWeight: '900', color: '#00ff66' }}>{voteData.votedCount} / {participantCount}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAIMERIS */}
          {scene?.type === 'TIMER' && (
            <div style={{
              position: 'absolute', left: scene.config?.timerPlacement === 'TOP_RIGHT' ? 'auto' : '50%',
              right: scene.config?.timerPlacement === 'TOP_RIGHT' ? '25px' : 'auto',
              top: scene.config?.timerPlacement === 'TOP_RIGHT' ? '25px' : '50%',
              transform: scene.config?.timerPlacement === 'TOP_RIGHT' ? 'none' : 'translate(-50%, -50%)',
              background: 'rgba(0, 0, 0, 0.85)',
              border: activeTheme === 'TV_SHOW' ? '4px solid #ffd700' : '4px solid #ffc107',
              borderRadius: '20px', padding: scene.config?.timerPlacement === 'TOP_RIGHT' ? '15px 25px' : '30px 60px',
              textAlign: 'center', boxShadow: '0 10px 40px rgba(255, 193, 7, 0.4)', zIndex: 20
            }}>
              {scene.config?.timerLabel && (
                <div style={{ fontSize: '1.8vw', color: '#00e5ff', fontWeight: 'bold', marginBottom: '6px' }}>{scene.config.timerLabel}</div>
              )}
              <div style={{ fontSize: '7.5vw', fontWeight: '900', color: '#ffc107', letterSpacing: '4px', lineHeight: 1 }}>
                {scene.config?.timerType === 'CLOCK' ? <ClockDisplay /> : <CountdownDisplay durationSeconds={scene.config?.timerDuration || 300} />}
              </div>
            </div>
          )}

          {/* ĀTRĀ PULTS */}
          {scene?.type === 'BUZZER_RACE' && (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {buzzerWinnerData ? (
                <div style={{ background: 'rgba(20, 15, 0, 0.94)', border: '4px solid #ffd700', borderRadius: '24px', padding: '30px 50px', textAlign: 'center', animation: 'correctGlowPulse 1.2s infinite ease-in-out' }}>
                  <div style={{ fontSize: '3vw', color: '#ffd700', fontWeight: '900' }}>🚨 ĀTRĀKĀ PULTS NOPIKSTĒJA! 🚨</div>
                  <div style={{ fontSize: '4.5vw', color: '#fff', fontWeight: '900', margin: '10px 0' }}>
                    #{buzzerWinnerData.deviceNumber} {buzzerWinnerData.name}
                  </div>
                  {buzzerWinnerData.teamName && (
                    <div style={{ fontSize: '2.5vw', color: '#00e5ff', fontWeight: 'bold', marginBottom: '10px' }}>
                      👥 {buzzerWinnerData.teamName}
                    </div>
                  )}
                  <div style={{ fontSize: '2vw', color: '#00ff00', fontWeight: 'bold' }}>
                    ⏱️ Reakcijas laiks: {formatThinkingTime(buzzerWinnerData.timeSpentMs)}
                  </div>
                </div>
              ) : (
                <div style={{ background: 'rgba(0,0,0,0.8)', border: '2px solid #00e5ff', padding: '25px 40px', borderRadius: '20px', textAlign: 'center' }}>
                  <h1 style={{ fontSize: '3.5vw', color: '#ffc107', margin: 0 }}>⚡ ĀTRĀ PULTS ⚡</h1>
                  <p style={{ fontSize: '1.8vw', color: '#fff', marginTop: '10px' }}>Gatavojieties spiest pogu telefonā!</p>
                </div>
              )}
            </div>
          )}

          {/* SECĪBA */}
          {scene?.type === 'ORDERING' && (
            <div style={{ position: 'absolute', bottom: '35px', width: '85%', left: '7.5%', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 10 }}>
              {optionsList.map((item: string, idx: number) => (
                <div key={item} style={{
                  ...optionCard,
                  background: isRevealed ? 'rgba(40, 167, 69, 0.85)' : 'rgba(0,0,0,0.85)',
                  border: isRevealed ? '2px solid #00ff00' : 'none', padding: '12px 24px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{ fontSize: '2vw', color: '#00e5ff', fontWeight: '900' }}>#{idx + 1}</span>
                    <span style={{ fontSize: getOptionFontSize(item), color: '#fff', fontWeight: 'bold' }}>{item}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* STANDARTA JAUTĀJUMU ATBILDES */}
          {shouldShowOptions && scene?.type !== 'ORDERING' && scene?.type !== 'BUZZER_RACE' && scene?.type !== 'TIMER' && scene?.type !== 'CONTACTS' && (
            optionsList.map((opt: string, i: number) => {
              const totalOpt = optionsList.length;
              let defaultPos = {
                x: 10 + (i % 2) * 42,
                y: totalOpt > 4 ? 52 + Math.floor(i / 2) * 12 : 58 + Math.floor(i / 2) * 13,
                w: 38, h: totalOpt > 4 ? 9 : 10
              };

              if (optLayout === 'RIGHT_COLUMN') {
                const itemHeight = Math.min(12, Math.floor(65 / totalOpt) - 2);
                defaultPos = { x: 56, y: 20 + i * (itemHeight + 3), w: 40, h: itemHeight };
              }

              const savedPos = optPositions[i] || optPositions[String(i)] || optPositions[opt];
              const pos = (optLayout === 'INDIVIDUAL' && savedPos) ? savedPos : defaultPos;
              const isOnlyLetter = !opt || opt.trim() === '';

              return renderOptionItem(opt, i, {
                position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`,
                width: isOnlyLetter ? `${pos.w || 8}%` : `${pos.w}%`,
                height: `${pos.h}%`, minHeight: `${pos.h}%`
              });
            })
          )}

          {/* 🏆 LĪDERU TABULA */}
          {scene?.type === 'LEADERBOARD' && !isFinalLb && (
            <div style={{
              width: '94%', height: '92%', margin: 'auto', display: 'flex', flexDirection: 'column',
              background: 'rgba(10, 10, 10, 0.94)', borderRadius: '24px',
              border: '1px solid rgba(255, 255, 255, 0.12)', padding: '18px 30px',
              boxSizing: 'border-box', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.95)',
              backdropFilter: 'blur(20px)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '10px', flexShrink: 0 }}>
                <div>
                  <h1 style={{ fontSize: '2.2vw', color: '#ffc107', margin: 0, fontWeight: '900', letterSpacing: '1px' }}>
                    {getLeaderboardTitle()}
                  </h1>
                  <span style={{ fontSize: '0.9vw', color: isRoundLb ? '#00e5ff' : '#aaa', fontWeight: 'bold' }}>
                    {isRoundLb ? '📍 Šīs kārtas rezultāti' : '⭐ Kopējā punktu summa visā spēlē'}
                  </span>
                </div>

                {!isRoundLb && biggestClimber && (
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.25), rgba(255, 87, 34, 0.25))',
                    border: '1.5px solid #ff9800', padding: '4px 12px', borderRadius: '14px',
                    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85vw',
                    color: '#ffd700', fontWeight: 'bold', boxShadow: '0 0 15px rgba(255, 152, 0, 0.5)'
                  }}>
                    <span>🚀 Kārtas kāpējs:</span>
                    <strong style={{ color: '#fff' }}>{biggestClimber.name}</strong>
                    <span style={{ color: '#00ff66' }}>(+{maxClimberDelta} vietas)</span>
                  </div>
                )}
              </div>

              <div style={{
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                flex: 1, marginTop: '12px', gap: '6px', overflow: 'visible'
              }}>
                {(isTeamMode && showTeamLeaderboard ? teamLeaderboard : sortedLeaderboard)
                  .slice(leaderboardPage * 12, (leaderboardPage + 1) * 12)
                  .map((item, i) => {
                    const currentNum = leaderboardPage * 12 + i + 1;
                    const isTopClimber = !isRoundLb && item.rankDelta === maxClimberDelta && maxClimberDelta > 1;

                    const itemScore = isRoundLb ? (item.roundScore ?? 0) : (item.score ?? 0);
                    const itemTime = isRoundLb ? (item.roundTimeMs ?? 0) : (item.totalTimeMs ?? 0);
                    const hasBaseline = Boolean(item.previousRank !== null && item.previousRank !== undefined);
                    const hasPoints = itemScore > 0;

                    let rowBorder = '1px solid rgba(255, 255, 255, 0.08)';
                    let rowBackground = 'rgba(255, 255, 255, 0.03)';
                    let medalBadge = `${currentNum}.`;
                    let auraShadow = 'none';

                    if (currentNum === 1) {
                      rowBorder = '1.8px solid #ffd700';
                      rowBackground = 'linear-gradient(90deg, rgba(255, 215, 0, 0.22) 0%, rgba(20, 20, 20, 0.85) 75%)';
                      medalBadge = '🥇';
                      auraShadow = '0 0 15px rgba(255, 215, 0, 0.35)';
                    } else if (currentNum === 2) {
                      rowBorder = '1.5px solid #cbd5e1';
                      rowBackground = 'linear-gradient(90deg, rgba(200, 210, 225, 0.16) 0%, rgba(20, 20, 20, 0.85) 75%)';
                      medalBadge = '🥈';
                      auraShadow = '0 0 12px rgba(200, 210, 225, 0.25)';
                    } else if (currentNum === 3) {
                      rowBorder = '1.5px solid #cd7f32';
                      rowBackground = 'linear-gradient(90deg, rgba(205, 127, 50, 0.16) 0%, rgba(20, 20, 20, 0.85) 75%)';
                      medalBadge = '🥉';
                      auraShadow = '0 0 12px rgba(205, 127, 50, 0.25)';
                    } else if (isTopClimber) {
                      rowBorder = '1.5px solid #ff9800';
                      rowBackground = 'rgba(255, 152, 0, 0.14)';
                    }

                    return (
                      <div
                        key={item.id || item.name || i}
                        style={{
                          flex: 1, minHeight: '34px', display: 'flex', alignItems: 'center',
                          justifyContent: 'space-between', padding: '0 16px', borderRadius: '8px',
                          border: rowBorder, background: rowBackground, boxShadow: auraShadow,
                          boxSizing: 'border-box'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{
                            fontWeight: '900', minWidth: '28px',
                            fontSize: currentNum <= 3 ? '1.3vw' : '1vw',
                            color: currentNum === 1 ? '#ffd700' : currentNum === 2 ? '#cbd5e1' : currentNum === 3 ? '#cd7f32' : '#888'
                          }}>
                            {medalBadge}
                          </span>

                          {!isRoundLb && renderPresentationDelta(item.rankDelta, isTopClimber, hasBaseline)}

                          <span style={{
                            fontWeight: currentNum <= 3 ? '900' : 'bold',
                            fontSize: 'clamp(0.95rem, 1.25vw, 1.5rem)',
                            color: currentNum === 1 ? '#ffd700' : '#fff'
                          }}>
                            {item.name} {isTeamMode && !showTeamLeaderboard && item.teamName && `[${item.teamName}]`}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                          <span style={{
                            ...timeTagStyle,
                            color: hasPoints ? '#00e5ff' : '#666',
                            background: hasPoints ? 'rgba(0, 229, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                            border: hasPoints ? '1px solid rgba(0, 229, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)'
                          }}>
                            ⏱️ {formatThinkingTime(itemTime)}
                          </span>

                          <div style={{ minWidth: '90px', textAlign: 'right' }}>
                            <span style={{
                              fontWeight: '900',
                              color: !hasPoints ? '#555' : currentNum === 1 ? '#ffd700' : 'gold',
                              fontSize: 'clamp(1.1rem, 1.4vw, 1.8rem)'
                            }}>
                              {itemScore}
                            </span>
                            <span style={{
                              fontSize: '0.85rem', fontWeight: 700,
                              color: hasPoints ? '#ffc107' : '#555', marginLeft: '4px'
                            }}>
                              pt
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* FINĀLA APBALVOŠANA (PODIJS) */}
          {scene?.type === 'LEADERBOARD' && isFinalLb && (
            <div style={podiumWrapper}>
              {podiumStage < 4 && (
                <div style={podiumFlexContainer}>
                  <div style={podiumTitleBox}>
                    <h1 style={{ fontSize: '2.4vw', color: '#ffd700', margin: 0, fontWeight: '900', letterSpacing: '2px' }}>
                      {finalIsTeamPodium ? '🏆 KOMANDU FINĀLA APBALVOŠANA 🏆' : '🏆 INDIVIDUĀLĀ FINĀLA APBALVOŠANA 🏆'}
                    </h1>
                  </div>

                  <div style={podiumStagesContainer}>
                    {secondPlace && (
                      <div style={{
                        ...pedestalColumn,
                        opacity: podiumStage >= 2 ? 1 : 0,
                        transform: podiumStage >= 2 ? 'translateY(0)' : 'translateY(50px)',
                        transition: 'all 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                      }}>
                        <div style={rankTitleBadge}>🥈 VICEČEMPIONS</div>
                        <div style={podiumTextBadge}>
                          <span style={podiumNameText} title={secondPlace.name}>
                            {finalIsTeamPodium ? `👥 ${secondPlace.name}` : secondPlace.name}
                          </span>
                          <span style={{ fontSize: '1.4rem', color: '#ffd700', fontWeight: '900' }}>{secondPlace.score} pt</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span style={{ fontSize: '0.85rem', color: '#00e5ff' }}>⏱️ {formatThinkingTime(secondPlace.totalTimeMs)}</span>
                            {renderPresentationDelta(secondPlace.rankDelta, false, Boolean(secondPlace.previousRank))}
                          </div>
                        </div>
                        <div style={silverPedestal}><span style={pedestalNumberText}>2</span></div>
                      </div>
                    )}

                    {firstPlace && (
                      <div style={{
                        ...pedestalColumn,
                        opacity: podiumStage >= 3 ? 1 : 0,
                        transform: podiumStage >= 3 ? 'translateY(0)' : 'translateY(60px)',
                        transition: 'all 0.9s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                      }}>
                        <div style={{ fontSize: '3rem', marginBottom: '-6px', filter: 'drop-shadow(0 0 15px gold)' }}>👑</div>
                        <div style={{ ...rankTitleBadge, background: 'linear-gradient(90deg, #ffd700, #ff9800)', color: '#000' }}>
                          🏆 ABSOLŪTAIS ČEMPIONS 🏆
                        </div>
                        <div style={{ ...podiumTextBadge, border: '3px solid #ffd700', boxShadow: '0 0 35px rgba(255,215,0,0.7)' }}>
                          <span style={{ ...podiumNameText, color: '#ffd700', fontWeight: '900' }} title={firstPlace.name}>
                            {finalIsTeamPodium ? `👥 ${firstPlace.name}` : firstPlace.name}
                          </span>
                          <span style={{ fontSize: '1.7rem', color: '#fff', fontWeight: '900' }}>{firstPlace.score} pt</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span style={{ fontSize: '0.9rem', color: '#00e5ff' }}>⏱️ {formatThinkingTime(firstPlace.totalTimeMs)}</span>
                            {renderPresentationDelta(firstPlace.rankDelta, false, Boolean(firstPlace.previousRank))}
                          </div>
                        </div>
                        <div style={goldPedestal}><span style={pedestalNumberText}>1</span></div>
                      </div>
                    )}

                    {thirdPlace && (
                      <div style={{
                        ...pedestalColumn,
                        opacity: podiumStage >= 1 ? 1 : 0,
                        transform: podiumStage >= 1 ? 'translateY(0)' : 'translateY(50px)',
                        transition: 'all 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                      }}>
                        <div style={rankTitleBadge}>🥉 BRONZAS GODA VIETA</div>
                        <div style={podiumTextBadge}>
                          <span style={podiumNameText} title={thirdPlace.name}>
                            {finalIsTeamPodium ? `👥 ${thirdPlace.name}` : thirdPlace.name}
                          </span>
                          <span style={{ fontSize: '1.4rem', color: '#ffd700', fontWeight: '900' }}>{thirdPlace.score} pt</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span style={{ fontSize: '0.85rem', color: '#00e5ff' }}>⏱️ {formatThinkingTime(thirdPlace.totalTimeMs)}</span>
                            {renderPresentationDelta(thirdPlace.rankDelta, false, Boolean(thirdPlace.previousRank))}
                          </div>
                        </div>
                        <div style={bronzePedestal}><span style={pedestalNumberText}>3</span></div>
                      </div>
                    )}
                  </div>

                  {biggestClimber && podiumStage >= 3 && (
                    <div style={{
                      marginTop: '15px', background: 'rgba(20, 20, 20, 0.85)', border: '2px solid #ff9800',
                      padding: '8px 24px', borderRadius: '16px', display: 'flex', alignItems: 'center',
                      gap: '10px', boxShadow: '0 0 25px rgba(255, 152, 0, 0.4)'
                    }}>
                      <span style={{ fontSize: '1.2vw', color: '#ffd700' }}>🔥 Turnīra lielākais kāpējs:</span>
                      <strong style={{ fontSize: '1.3vw', color: '#fff' }}>{biggestClimber.name}</strong>
                      <span style={{ fontSize: '1.2vw', color: '#00ff66', fontWeight: 'bold' }}>(+{maxClimberDelta} vietas uz augšu!)</span>
                    </div>
                  )}

                  <div style={{
                    width: '75%', height: '25px',
                    background: 'radial-gradient(ellipse at center, rgba(255, 215, 0, 0.35) 0%, rgba(0,0,0,0) 80%)',
                    filter: 'blur(8px)', marginTop: '-5px'
                  }} />
                </div>
              )}

              {/* PODIJA 4. POSMS (NO 4. VIETAS) */}
              {podiumStage >= 4 && (
                <div style={{
                  width: '92%', height: '92%', margin: 'auto', display: 'flex', flexDirection: 'column',
                  background: 'rgba(10, 10, 10, 0.94)', borderRadius: '24px',
                  border: '1px solid rgba(255, 255, 255, 0.12)', padding: '1.5% 2.5%',
                  boxSizing: 'border-box', overflow: 'hidden'
                }}>
                  <h1 style={{ fontSize: '2.2vw', color: '#ffc107', margin: '0 0 10px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.8%' }}>
                    {finalIsTeamPodium ? 'KOMANDU KOPVĒRTĒJUMS (NO 4. VIETAS)' : 'KOPVĒRTĒJUMS (NO 4. VIETAS)'}
                  </h1>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', flex: 1, gap: '6px', overflow: 'hidden' }}>
                    {currentRemainingPageList.map((item, i) => (
                      <div key={item.id || item.name || i} style={{
                        height: 'calc((100% - 66px) / 12)', minHeight: '34px', maxHeight: '48px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0 16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)',
                        background: 'rgba(255, 255, 255, 0.03)', boxSizing: 'border-box'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '1vw', color: '#aaa' }}>{4 + leaderboardPage * 12 + i}.</span>
                          {renderPresentationDelta(item.rankDelta, false, Boolean(item.previousRank))}
                          <span style={{ fontWeight: 'bold', fontSize: 'clamp(0.95rem, 1.25vw, 1.5rem)' }}>{item.name}</span>
                        </div>
                        <span style={{ fontWeight: '900', color: 'gold', fontSize: 'clamp(1rem, 1.4vw, 1.8rem)' }}>{item.score} pt</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// STILI
const fullScreen: React.CSSProperties = {
  height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'flex-start', color: '#fff',
  fontFamily: 'Segoe UI, Arial, sans-serif', overflow: 'hidden', position: 'relative',
  overscrollBehavior: 'none'
};

const fullScreenCenter: React.CSSProperties = {
  ...fullScreen, justifyContent: 'center', backgroundColor: '#000'
};

const votersBox: React.CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'
};

const statsBadge: React.CSSProperties = {
  fontSize: '1.15rem', fontWeight: 'bold', background: 'rgba(0,0,0,0.7)',
  padding: '6px 14px', borderRadius: '10px'
};

const bigBtn: React.CSSProperties = {
  padding: '30px 60px', fontSize: '2.5rem', cursor: 'pointer', background: '#28a745',
  color: '#fff', border: 'none', borderRadius: '20px', fontWeight: 'bold'
};

const optionCard: React.CSSProperties = {
  padding: '12px 20px', borderRadius: '16px', display: 'flex',
  justifyContent: 'space-between', alignItems: 'center',
  boxShadow: '0 10px 30px rgba(0,0,0,0.85)', boxSizing: 'border-box'
};

const voteBadge: React.CSSProperties = {
  background: '#007bff', color: '#fff', padding: '4px 14px', borderRadius: '20px',
  fontSize: '1.3vw', fontWeight: 'bold'
};

const summaryPillGreen: React.CSSProperties = {
  background: 'rgba(40, 167, 69, 0.3)', border: '2px solid #28a745', color: '#00ff00',
  padding: '4px 12px', borderRadius: '10px', fontWeight: 'bold'
};

const summaryPillYellow: React.CSSProperties = {
  background: 'rgba(255, 193, 7, 0.25)', border: '2px solid #ffc107', color: '#ffc107',
  padding: '4px 10px', borderRadius: '10px', fontWeight: 'bold'
};

const summaryPillRed: React.CSSProperties = {
  background: 'rgba(220, 53, 69, 0.3)', border: '2px solid #dc3545', color: '#ff4d4d',
  padding: '4px 12px', borderRadius: '10px', fontWeight: 'bold'
};

const timeTagStyle: React.CSSProperties = {
  fontSize: '1.1vw', color: '#00e5ff', background: 'rgba(0, 229, 255, 0.15)',
  padding: '2px 8px', borderRadius: '6px'
};

const podiumWrapper: React.CSSProperties = {
  width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center'
};

const podiumFlexContainer: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  width: '100%', height: '100%'
};

const podiumTitleBox: React.CSSProperties = {
  background: 'rgba(10, 10, 10, 0.85)', padding: '8px 36px', borderRadius: '16px',
  marginBottom: '20px', border: '2px solid #ffd700', boxShadow: '0 0 25px rgba(255, 215, 0, 0.4)'
};

const podiumStagesContainer: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '30px', width: '100%'
};

const pedestalColumn: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end'
};

const rankTitleBadge: React.CSSProperties = {
  background: '#1a1a1a', border: '1px solid #ffd700', color: '#ffd700',
  fontSize: '0.85vw', fontWeight: '900', padding: '3px 12px', borderRadius: '6px',
  marginBottom: '6px', letterSpacing: '1px'
};

const podiumTextBadge: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  background: 'rgba(12, 12, 12, 0.92)', padding: '8px 16px', borderRadius: '14px',
  marginBottom: '8px', boxShadow: '0 8px 25px rgba(0,0,0,0.9)', width: '260px'
};

const podiumNameText: React.CSSProperties = {
  fontSize: '1.4vw', fontWeight: 'bold', color: '#fff', width: '100%',
  textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
};

const pedestalNumberText: React.CSSProperties = {
  fontSize: '4.5rem', fontWeight: '900', color: '#000'
};

const goldPedestal: React.CSSProperties = {
  width: '220px', height: '220px', background: 'linear-gradient(to top, #b7791f, #f6e05e, #ecc94b)',
  borderRadius: '20px 20px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '3px solid #fff', boxShadow: '0 0 50px rgba(246, 224, 94, 0.8)'
};

const silverPedestal: React.CSSProperties = {
  width: '190px', height: '165px', background: 'linear-gradient(to top, #4a5568, #cbd5e0, #e2e8f0)',
  borderRadius: '16px 16px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '3px solid #fff', boxShadow: '0 0 35px rgba(226, 232, 240, 0.6)'
};

const bronzePedestal: React.CSSProperties = {
  width: '190px', height: '125px', background: 'linear-gradient(to top, #744210, #d69e2e, #b7791f)',
  borderRadius: '16px 16px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '3px solid #fff', boxShadow: '0 0 30px rgba(214, 158, 46, 0.6)'
};

const modalOverlay: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
  background: 'rgba(0,0,0,0.88)', zIndex: 99999, display: 'flex',
  alignItems: 'center', justifyContent: 'center'
};

const modalCard: React.CSSProperties = {
  background: 'rgba(20, 20, 20, 0.95)', padding: '35px', borderRadius: '24px',
  border: '3px solid #00ff00', textAlign: 'center'
};

const btnCloseModal: React.CSSProperties = {
  marginTop: '15px', padding: '10px 25px', background: '#444', color: '#fff',
  border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'
};
