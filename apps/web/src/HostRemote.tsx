import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { BACKEND_URL } from './config';

// 🌟 UNIVERSĀLA HAPTISKĀ REAKCIJA VADĪTĀJAM (Android vibrācija + iPhone taktilais mehāniskais klikšķis)
let sharedHapticCtx: AudioContext | null = null;
const initHapticContext = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx && !sharedHapticCtx) {
      sharedHapticCtx = new AudioCtx();
    }
    if (sharedHapticCtx && sharedHapticCtx.state === 'suspended') {
      sharedHapticCtx.resume().catch(() => {});
    }
  } catch {}
};

const triggerHaptic = (type: 'success' | 'warn' | 'tap' = 'tap') => {
  if ('vibrate' in navigator) {
    try {
      if (type === 'success') navigator.vibrate([80, 50, 140]);
      else if (type === 'warn') navigator.vibrate([100, 50, 100]);
      else navigator.vibrate(60);
    } catch {}
  }

  try {
    initHapticContext();
    if (sharedHapticCtx && sharedHapticCtx.state === 'running') {
      const osc = sharedHapticCtx.createOscillator();
      const gain = sharedHapticCtx.createGain();
      osc.type = 'triangle';

      const startFreq = type === 'success' ? 440 : type === 'warn' ? 220 : 320;
      const endFreq = type === 'success' ? 160 : type === 'warn' ? 70 : 80;
      osc.frequency.setValueAtTime(startFreq, sharedHapticCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(endFreq, sharedHapticCtx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.7, sharedHapticCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, sharedHapticCtx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(sharedHapticCtx.destination);
      osc.start();
      osc.stop(sharedHapticCtx.currentTime + 0.04);
    }
  } catch {}
};

export default function HostRemote() {
  const params = new URLSearchParams(window.location.search);
  const [pin, setPin] = useState(params.get('pin') || localStorage.getItem('host_remote_pin') || '');
  const [hostToken, setHostToken] = useState(params.get('token') || localStorage.getItem('host_remote_token') || '');
  const [hostName, setHostName] = useState(localStorage.getItem('host_name') || '');

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Cilnes vadītāja tālrunī: Galvenā pults VAI Slaidu saraksts
  const [activeTab, setActiveTab] = useState<'REMOTE' | 'SLIDES'>('REMOTE');
  const [slideSearchQuery, setSlideSearchQuery] = useState('');

  // 🌟 DROŠĪBAS APSTIPRINĀJUMS PIRMS PĀRLĒKŠANAS UZ CITU SLAIDU
  const [pendingJumpScene, setPendingJumpScene] = useState<any | null>(null);

  // Līderu tabulas paginācijas stāvoklis
  const [lbPage, setLbPage] = useState<number>(0);

  const [gameState, setGameState] = useState<{
    currentScene: any;
    subState: string;
    isBlackout?: boolean;
    currentSceneIdx: number;
    totalScenes: number;
    nextSceneTitle: string;
    votedCount: number;
    totalParticipantsCount: number;
    hostName?: string;
    allScenes?: { index: number; id: string; title: string; type: string; question?: string; notes?: string }[];
  } | null>(null);

  const prevSubStateRef = useRef<string>('');
  const lastAdvanceTap = useRef<number>(0);
  const noSleepVideoRef = useRef<HTMLVideoElement | null>(null);

  // Pārbaudām, vai ierīce atbalsta Fullscreen API
  const isFullscreenSupported = typeof document !== 'undefined' && Boolean(
    document.fullscreenEnabled || (document as any).webkitFullscreenEnabled
  );

  const toggleFullscreen = () => {
    triggerHaptic('tap');
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  // 🌟 1. NEIZSLĒDZAMĀ EKRĀNA DZINĒJS (Android & iOS WakeLock + Video Loop)
  useEffect(() => {
    let wakeLock: any = null;
    let isLocked = false;

    const requestLock = async () => {
      if ('wakeLock' in navigator && (navigator as any).wakeLock) {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          isLocked = true;
          wakeLock.addEventListener('release', () => {
            isLocked = false;
          });
        } catch {}
      }
    };

    requestLock();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestLock();
      }
    };

    const handleUserInteraction = () => {
      initHapticContext();
      if (!isLocked) requestLock();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    document.addEventListener('touchstart', handleUserInteraction, { passive: true });
    document.addEventListener('click', handleUserInteraction, { passive: true });

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 2;
      canvas.height = 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 2, 2);
      }
      if ((canvas as any).captureStream && noSleepVideoRef.current) {
        const stream = (canvas as any).captureStream(2);
        noSleepVideoRef.current.srcObject = stream;
        noSleepVideoRef.current.play().catch(() => {});
      }
    } catch {}

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('click', handleUserInteraction);
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, []);

  // 🌟 2. Haptiskā atbilde pie fāžu maiņas
  useEffect(() => {
    const curSub = gameState?.subState;
    if (curSub && curSub !== prevSubStateRef.current) {
      if (curSub === 'ACTIVE') {
        triggerHaptic('tap');
      } else if (curSub === 'STATS') {
        triggerHaptic('tap');
      } else if (curSub === 'REVEAL') {
        triggerHaptic('success');
      }
      prevSubStateRef.current = curSub;
    }
  }, [gameState?.subState]);

  // 3. Socket savienojums
  useEffect(() => {
    const s = io(BACKEND_URL, { reconnection: true });
    setSocket(s);

    s.on('connect', () => {
      const initialPin = params.get('pin') || localStorage.getItem('host_remote_pin');
      const initialToken = params.get('token') || localStorage.getItem('host_remote_token');
      const initialName = localStorage.getItem('host_name') || '';

      if (initialPin && initialToken) {
        s.emit('host:join-remote', { 
          pin: initialPin.trim(), 
          hostToken: initialToken.trim(), 
          hostName: initialName.trim() 
        });
      }
    });

    s.on('host-state-update', (data: any) => {
      setIsAuthorized(true);
      setGameState(data);
      if (data.hostName && !hostName) {
        setHostName(data.hostName);
      }
      if (data.currentSceneIdx !== gameState?.currentSceneIdx) {
        setLbPage(0);
      }
    });

    s.on('leaderboard-page-change', (page: number) => {
      setLbPage(page);
    });

    s.on('blackout-toggled', (isBlackout: boolean) => {
      setGameState((prev) => (prev ? { ...prev, isBlackout } : prev));
      triggerHaptic('warn');
    });

    s.on('session-ended', () => {
      alert('Spēles sesija ir noslēgta.');
      setIsAuthorized(false);
      setGameState(null);
    });

    s.on('error-message', (msg: string) => {
      alert(msg);
      setIsAuthorized(false);
    });

    return () => { 
      s.disconnect(); 
    };
  }, []);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic('tap');
    if (!pin || !hostToken) return alert('Ievadi PIN un Host Token!');
    localStorage.setItem('host_remote_pin', pin.trim());
    localStorage.setItem('host_remote_token', hostToken.trim());
    localStorage.setItem('host_name', hostName.trim());
    socket?.emit('host:join-remote', { pin: pin.trim(), hostToken: hostToken.trim(), hostName: hostName.trim() });
  };

  const handleUpdateHostName = (newName: string) => {
    setHostName(newName);
    localStorage.setItem('host_name', newName);
    if (socket && pin && hostToken) {
      socket.emit('host:set-name', { pin, hostToken, hostName: newName });
    }
  };

  const handleAdvance = () => {
    if (gameState?.subState === 'ACTIVE') return;

    const now = Date.now();
    if (now - lastAdvanceTap.current < 500) return;
    lastAdvanceTap.current = now;

    triggerHaptic('tap');
    socket?.emit('host:advance', { pin, hostToken });
  };

  const handleBacktrack = () => {
    if (!window.confirm('Vai tiešām vēlies spert soli atpakaļ?')) return;
    triggerHaptic('warn');
    socket?.emit('host:backtrack', { pin, hostToken });
  };

  const handleTogglePause = () => {
    triggerHaptic('tap');
    if (gameState?.subState === 'PAUSED') {
      socket?.emit('host:resume-session', { pin, hostToken });
    } else {
      socket?.emit('host:pause-session', { pin, hostToken });
    }
  };

  const handleRestartScene = () => {
    if (!window.confirm('Restartēt šo jautājumu no jauna?')) return;
    triggerHaptic('warn');
    socket?.emit('host:restart-scene', { pin, hostToken });
  };

  const handleToggleStageQr = () => {
    triggerHaptic('tap');
    socket?.emit('host:toggle-qr-zoom', { pin, hostToken });
  };

  const handleToggleBlackout = () => {
    triggerHaptic('warn');
    socket?.emit('host:toggle-blackout', { pin, hostToken });
  };

  const handleToggleChart = () => {
    triggerHaptic('tap');
    socket?.emit('host:toggle-chart', { pin, hostToken });
  };

  const handleToggleTeamView = () => {
    triggerHaptic('tap');
    socket?.emit('host:toggle-team-view', { pin, hostToken });
  };

  const handleChangeLbPage = (delta: number) => {
    const newPage = Math.max(0, lbPage + delta);
    setLbPage(newPage);
    triggerHaptic('tap');
    socket?.emit('host:change-leaderboard-page', { pin, hostToken, page: newPage });
  };

  const handleJumpToScene = (sceneIndex: number) => {
    triggerHaptic('warn');
    socket?.emit('host:jump-to-scene', { pin, hostToken, sceneIndex });
    setActiveTab('REMOTE');
  };

  const handlePlaySfx = (sfx: string) => {
    triggerHaptic('tap');
    socket?.emit('host:play-sfx', { pin, hostToken, sfx });
  };

  if (!isAuthorized) {
    return (
      <div style={containerStyle}>
        <video ref={noSleepVideoRef} playsInline muted loop style={{ display: 'none' }} />

        <div style={cardStyle}>
          <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🎙️</div>
          <h1 style={{ color: '#ffc107', margin: '0 0 8px 0', fontSize: '1.4rem' }}>VADĪTĀJA PULTS</h1>
          <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '15px' }}>
            Savienojies ar spēles sesiju:
          </p>
          <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              style={inputStyle}
              placeholder="Tavs Vārds (Vadītājs)"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="PIN kods"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="Host Token (Atslēga)"
              value={hostToken}
              onChange={(e) => setHostToken(e.target.value)}
            />
            <button type="submit" style={btnPrimary}>PIESLĒGTIES PULTIJ 🚀</button>
          </form>
        </div>
      </div>
    );
  }

  const scene = gameState?.currentScene;
  const subState = gameState?.subState || 'IDLE';
  const isBlackout = !!gameState?.isBlackout;
  const isLeaderboardScene = scene?.type === 'LEADERBOARD';
  const config = scene?.config || {};
  const correctAnswers = config.correctAnswers || config.correctOrder || [];
  const notes = config.notes || '';
  const isTimeActive = subState === 'ACTIVE';

  const filteredScenes = (gameState?.allScenes || []).filter((sc) =>
    sc.title.toLowerCase().includes(slideSearchQuery.toLowerCase()) ||
    (sc.question && sc.question.toLowerCase().includes(slideSearchQuery.toLowerCase()))
  );

  return (
    <div style={containerStyle}>
      <video ref={noSleepVideoRef} playsInline muted loop style={{ display: 'none' }} />

      {/* 1. AUGŠĒJĀ JOSLA */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={badgePin}>PIN: {pin}</span>
          <span style={{ fontSize: '0.8rem', color: '#aaa' }}>
            #{ (gameState?.currentSceneIdx ?? 0) + 1 } / { gameState?.totalScenes }
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          {isFullscreenSupported && (
            <button onClick={toggleFullscreen} style={btnHeaderSquare} title="Ieslēgt / Izslēgt pilnekrānu">
              {isFullscreen ? '⛶' : '⛶'}
            </button>
          )}
          <button onClick={() => { triggerHaptic('tap'); setActiveTab(activeTab === 'REMOTE' ? 'SLIDES' : 'REMOTE'); }} style={btnTabToggle}>
            {activeTab === 'REMOTE' ? '📋 Slaidi' : '🎙️ Pults'}
          </button>
          <button onClick={handleToggleStageQr} style={btnQrHeader} title="Ieslēgt/izslēgt QR lielajā ekrānā">
            📱 QR
          </button>
          <span style={{ ...badgeState, background: getSubStateColor(subState) }}>
            {subState}
          </span>
        </div>
      </div>

      {/* BRĪDINĀJUMS, JA SKATUVES EKRĀNS IR AIZSEGTS */}
      {isBlackout && (
        <div
          onClick={handleToggleBlackout}
          style={{
            background: '#dc3545',
            color: '#fff',
            padding: '8px',
            textAlign: 'center',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            borderBottom: '2px solid #fff'
          }}
        >
          🚨 SKATUVE AIZSEGTA (BLACKOUT)! Pieskaries, lai atvērtu.
        </div>
      )}

      {/* 2. CILNE: SLAIDU SARAKSTS */}
      {activeTab === 'SLIDES' ? (
        <div style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
            style={{ ...inputStyle, padding: '8px 12px', fontSize: '0.85rem', borderColor: '#00e5ff' }}
            placeholder="🔍 Meklēt jautājumu..."
            value={slideSearchQuery}
            onChange={(e) => setSlideSearchQuery(e.target.value)}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
            {filteredScenes.map((sc) => {
              const isCurrent = sc.index === gameState?.currentSceneIdx;
              return (
                <div
                  key={sc.id || sc.index}
                  onClick={() => {
                    triggerHaptic('tap');
                    setPendingJumpScene(sc);
                  }}
                  style={{
                    padding: '10px 12px',
                    background: isCurrent ? 'rgba(40,167,69,0.3)' : '#1c1c1c',
                    border: isCurrent ? '2px solid #00ff00' : '1px solid #333',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: isCurrent ? '#00ff00' : '#fff' }}>
                      {sc.index + 1}. {sc.title} ({sc.type})
                    </div>
                    {sc.question && (
                      <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sc.question}
                      </div>
                    )}
                  </div>
                  {isCurrent ? (
                    <span style={{ color: '#00ff00', fontWeight: 'bold', fontSize: '0.8rem' }}>AKTUĀLS</span>
                  ) : (
                    <span style={{ color: '#00e5ff', fontSize: '0.75rem' }}>Apskatīt ➔</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* 3. CILNE: GALVENĀ VADĪBAS PULTS */
        <div style={{ flex: 1, padding: '10px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#181818', padding: '4px 10px', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: '#888' }}>Vadītājs:</span>
            <input
              value={hostName}
              onChange={(e) => handleUpdateHostName(e.target.value)}
              placeholder="Ievadi savu vārdu..."
              style={{ background: 'transparent', border: 'none', color: '#ffc107', fontWeight: 'bold', fontSize: '0.85rem', textAlign: 'right', outline: 'none' }}
            />
          </div>

          {/* Pašreizējais slaids */}
          <div style={sectionBox}>
            <div style={{ fontSize: '0.72rem', color: '#ffc107', fontWeight: 'bold' }}>
              📋 PAŠREIZĒJAIS SLAIDS:
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#fff', marginTop: '2px' }}>
              {scene?.title || 'Slaids'} ({scene?.type})
            </div>
            {config.layout?.find((el: any) => el.type === 'QUESTION')?.content && (
              <div style={{ fontSize: '0.88rem', color: '#ddd', marginTop: '4px', fontStyle: 'italic' }}>
                "{config.layout.find((el: any) => el.type === 'QUESTION')?.content}"
              </div>
            )}
          </div>

          {/* Špikeris vadītājam */}
          {correctAnswers.length > 0 && (
            <div style={{ ...sectionBox, border: '2px solid #00ff00', background: 'rgba(0, 255, 0, 0.08)' }}>
              <div style={{ fontSize: '0.72rem', color: '#00ff00', fontWeight: 'bold' }}>
                ✅ PAREIZĀ ATBILDE (ŠPIKERIS):
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#00ff00', marginTop: '2px' }}>
                {correctAnswers.join(' | ')}
              </div>
            </div>
          )}

          {/* Piezīmes */}
          {notes && (
            <div style={{ ...sectionBox, border: '1px solid #ffc107', background: 'rgba(255, 193, 7, 0.08)' }}>
              <div style={{ fontSize: '0.72rem', color: '#ffc107', fontWeight: 'bold' }}>
                💡 PIEZĪMES VADĪTĀJAM:
              </div>
              <div style={{ fontSize: '0.88rem', color: '#fff', marginTop: '3px', whiteSpace: 'pre-wrap', lineHeight: 1.3 }}>
                {notes}
              </div>
            </div>
          )}

          <div style={{ fontSize: '0.75rem', color: '#888', textAlign: 'center' }}>
            🔜 Nākamais: <strong style={{ color: '#aaa' }}>{gameState?.nextSceneTitle}</strong>
          </div>

          {/* LĪDERU TABULAS VADĪBA */}
          {isLeaderboardScene && (
            <div style={{ background: '#1c1c1c', border: '1px solid #ffc107', borderRadius: '10px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '0.75rem', color: '#ffc107', fontWeight: 'bold', textAlign: 'center' }}>
                🏆 LĪDERU TABULAS LAPAS:
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button onClick={() => handleChangeLbPage(-1)} disabled={lbPage === 0} style={{ ...btnNavTile, opacity: lbPage === 0 ? 0.35 : 1 }}>
                  ⬅️ Iepr. lapa
                </button>
                <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#fff', minWidth: '60px', textAlign: 'center' }}>
                  Lapa {lbPage + 1}
                </span>
                <button onClick={() => handleChangeLbPage(1)} style={btnNavTile}>
                  Nākamā lapa ➡️
                </button>
              </div>
            </div>
          )}

          {/* Skaņas efekti */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
            <button onClick={() => handlePlaySfx('applause')} style={btnSfx}>👏 Aplausi</button>
            <button onClick={() => handlePlaySfx('correct')} style={btnSfx}>🔔 Pareizi</button>
            <button onClick={() => handlePlaySfx('wrong')} style={btnSfx}>❌ Kļūda</button>
            <button onClick={() => handlePlaySfx('buzzer_hit')} style={btnSfx}>⚡ Pults</button>
            <button onClick={() => handlePlaySfx('suspense')} style={btnSfx}>🥁 Spriedze</button>
          </div>
        </div>
      )}

      {/* 🌟 VADĪBAS PULTS BLOKS VIRSS ADVANCE POGAS */}
      {activeTab === 'REMOTE' && (
        <div style={{ padding: '8px 12px', background: '#161616', borderTop: '1px solid #2a2a2a', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
            <button onClick={handleTogglePause} style={{ ...btnTile, color: subState === 'PAUSED' ? '#00ff00' : '#ff9800' }}>
              {subState === 'PAUSED' ? '▶️ Turpināt' : '⏸️ Pauze'}
            </button>
            <button onClick={handleToggleChart} style={{ ...btnTile, color: '#00e5ff' }}>
              📊 Statistika
            </button>
            <button onClick={handleToggleTeamView} style={{ ...btnTile, color: '#ffc107' }}>
              👥 Komandas
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
            <button onClick={handleBacktrack} style={{ ...btnTile, color: '#ccc' }}>
              ↩️ Atpakaļ
            </button>
            <button onClick={handleRestartScene} style={{ ...btnTile, color: '#ff4d4d' }}>
              🔄 No jauna
            </button>
            <button
              onClick={handleToggleBlackout}
              style={{
                ...btnTile,
                background: isBlackout ? '#dc3545' : '#222',
                color: isBlackout ? '#fff' : '#ffc107',
                border: isBlackout ? '1.5px solid #fff' : '1px solid #333'
              }}
            >
              {isBlackout ? '🔴 Aizsegts' : '⬛ Melns'}
            </button>
          </div>
        </div>
      )}

      {/* 🚀 ADVANCE POGA */}
      <div style={{ padding: '10px 12px 14px 12px', background: '#181818', borderTop: '1px solid #333', flexShrink: 0 }}>
        <button
          onClick={handleAdvance}
          disabled={isTimeActive}
          style={{
            ...btnBigAdvance,
            opacity: isTimeActive ? 0.4 : 1,
            background: isTimeActive
              ? '#444'
              : subState === 'PAUSED'
              ? '#ff9800'
              : 'linear-gradient(135deg, #28a745, #20c997)',
            cursor: isTimeActive ? 'not-allowed' : 'pointer'
          }}
        >
          {isTimeActive ? (
            <span>⏳ LAIKS RIT (Nobloķēts)</span>
          ) : subState === 'PAUSED' ? (
            <span>▶️ ATSĀKT LAIKU</span>
          ) : (
            <span>SPACE / TĀLĀK 🚀</span>
          )}

          {gameState && (
            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginTop: '2px', opacity: 0.9 }}>
              [ {gameState.votedCount} / {gameState.totalParticipantsCount} nobalsojuši ]
            </div>
          )}
        </button>
      </div>

      {/* 🌟 4. PUNKTS: DROŠĪBAS APSTIPRINĀJUMA LOGS PIRMS SLAIDA MAIŅAS */}
      {pendingJumpScene && (
        <div style={modalOverlayStyle} onClick={() => setPendingJumpScene(null)}>
          <div style={confirmModalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: '2.5rem', marginBottom: '6px' }}>👁️</div>
            <h3 style={{ color: '#ffc107', margin: '0 0 10px 0', fontSize: '1.2rem', textTransform: 'uppercase' }}>
              Pārlēkt uz šo jautājumu?
            </h3>

            <div style={{ background: '#111', padding: '12px', borderRadius: '10px', textAlign: 'left', marginBottom: '14px', border: '1px solid #333' }}>
              <div style={{ color: '#00e5ff', fontWeight: 'bold', fontSize: '0.95rem' }}>
                #{pendingJumpScene.index + 1}. {pendingJumpScene.title} ({pendingJumpScene.type})
              </div>

              {pendingJumpScene.question && (
                <div style={{ color: '#fff', fontSize: '0.9rem', marginTop: '6px', fontStyle: 'italic', lineHeight: 1.3 }}>
                  "{pendingJumpScene.question}"
                </div>
              )}

              {pendingJumpScene.notes && (
                <div style={{ color: '#ffd700', fontSize: '0.8rem', marginTop: '8px', borderTop: '1px dashed #444', paddingTop: '6px' }}>
                  📝 Piezīmes: {pendingJumpScene.notes}
                </div>
              )}
            </div>

            <p style={{ color: '#bbb', fontSize: '0.82rem', margin: '0 0 16px 0', lineHeight: 1.4 }}>
              ⚠️ Pašreizējais slaids ekrānā tiks pārtraukts un balsis notīrītas.
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  triggerHaptic('tap');
                  setPendingJumpScene(null);
                }}
                style={btnCancelModal}
              >
                ✕ Atcelt
              </button>
              <button
                onClick={() => {
                  handleJumpToScene(pendingJumpScene.index);
                  setPendingJumpScene(null);
                }}
                style={btnConfirmModal}
              >
                🚀 Jā, pārlēkt!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const getSubStateColor = (sub: string) => {
  switch (sub) {
    case 'ACTIVE': return '#28a745';
    case 'PAUSED': return '#ff9800';
    case 'STATS': return '#007bff';
    case 'SUMMARY': return '#6f42c1';
    case 'REVEAL': return '#00ff00';
    default: return '#555';
  }
};

// STILI
const containerStyle: React.CSSProperties = {
  width: '100vw',
  height: '100dvh',
  background: '#121212',
  color: '#fff',
  fontFamily: 'Segoe UI, sans-serif',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  overscrollBehaviorY: 'contain',
  touchAction: 'manipulation'
};

const headerStyle: React.CSSProperties = {
  height: '46px',
  background: '#1a1a1a',
  borderBottom: '1px solid #333',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 8px',
  flexShrink: 0
};

const cardStyle: React.CSSProperties = {
  margin: 'auto',
  background: '#1c1c1c',
  padding: '20px',
  borderRadius: '16px',
  textAlign: 'center',
  border: '1px solid #333',
  width: '85%',
  maxWidth: '340px'
};

const inputStyle: React.CSSProperties = {
  padding: '10px',
  borderRadius: '8px',
  background: '#000',
  border: '1px solid #444',
  color: '#fff',
  textAlign: 'center',
  fontSize: '0.95rem',
  width: '100%',
  boxSizing: 'border-box'
};

const btnPrimary: React.CSSProperties = {
  padding: '12px',
  background: '#28a745',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  fontWeight: 'bold',
  cursor: 'pointer'
};

const btnBigAdvance: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  color: '#fff',
  border: 'none',
  borderRadius: '12px',
  fontSize: '1.15rem',
  fontWeight: '900',
  boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
  touchAction: 'manipulation'
};

const btnTile: React.CSSProperties = {
  padding: '10px 4px',
  background: '#222',
  border: '1px solid #333',
  borderRadius: '8px',
  fontSize: '0.82rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  touchAction: 'manipulation'
};

const btnNavTile: React.CSSProperties = {
  flex: 1,
  padding: '8px',
  background: '#ffc107',
  color: '#000',
  border: 'none',
  borderRadius: '6px',
  fontWeight: '900',
  fontSize: '0.85rem',
  cursor: 'pointer',
  touchAction: 'manipulation'
};

const btnSfx: React.CSSProperties = {
  padding: '6px 2px',
  background: '#222',
  color: '#00e5ff',
  border: '1px solid #333',
  borderRadius: '6px',
  fontSize: '0.72rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  touchAction: 'manipulation'
};

const btnHeaderSquare: React.CSSProperties = {
  padding: '4px 7px',
  background: '#222',
  color: '#fff',
  border: '1px solid #444',
  borderRadius: '6px',
  fontSize: '0.8rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  touchAction: 'manipulation'
};

const btnTabToggle: React.CSSProperties = {
  padding: '4px 7px',
  background: '#333',
  color: '#00e5ff',
  border: '1px solid #00e5ff',
  borderRadius: '4px',
  fontSize: '0.75rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  touchAction: 'manipulation'
};

const btnQrHeader: React.CSSProperties = {
  padding: '4px 7px',
  background: '#007bff',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  fontSize: '0.75rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  touchAction: 'manipulation'
};

const sectionBox: React.CSSProperties = {
  background: '#1a1a1a',
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid #333'
};

const badgePin: React.CSSProperties = {
  background: '#000',
  border: '1px solid #00ff00',
  color: '#00ff00',
  padding: '2px 6px',
  borderRadius: '4px',
  fontWeight: 'bold',
  fontSize: '0.75rem'
};

const badgeState: React.CSSProperties = {
  color: '#000',
  padding: '2px 6px',
  borderRadius: '4px',
  fontWeight: '900',
  fontSize: '0.75rem'
};

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100dvh',
  background: 'rgba(0,0,0,0.85)',
  backdropFilter: 'blur(8px)',
  zIndex: 999999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  boxSizing: 'border-box'
};

const confirmModalCard: React.CSSProperties = {
  background: '#1c1c1c',
  border: '2px solid #ffc107',
  borderRadius: '16px',
  padding: '20px 18px',
  width: '100%',
  maxWidth: '340px',
  textAlign: 'center',
  boxShadow: '0 10px 40px rgba(0,0,0,0.95)'
};

const btnCancelModal: React.CSSProperties = {
  flex: 1,
  padding: '12px',
  background: '#333',
  color: '#fff',
  border: '1px solid #555',
  borderRadius: '8px',
  fontWeight: 'bold',
  fontSize: '0.95rem',
  cursor: 'pointer'
};

const btnConfirmModal: React.CSSProperties = {
  flex: 1.3,
  padding: '12px',
  background: '#28a745',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  fontWeight: 'bold',
  fontSize: '0.95rem',
  cursor: 'pointer'
};