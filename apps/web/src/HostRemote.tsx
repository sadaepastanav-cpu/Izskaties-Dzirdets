import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { BACKEND_URL } from './config';

export default function HostRemote() {
  const params = new URLSearchParams(window.location.search);
  const [pin, setPin] = useState(params.get('pin') || localStorage.getItem('host_remote_pin') || '');
  const [hostToken, setHostToken] = useState(params.get('token') || localStorage.getItem('host_remote_token') || '');
  const [hostName, setHostName] = useState(localStorage.getItem('host_name') || '');

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Cilnes vadītāja tālrunī: Galvenā pults VAI Slaidu saraksts
  const [activeTab, setActiveTab] = useState<'REMOTE' | 'SLIDES'>('REMOTE');
  const [slideSearchQuery, setSlideSearchQuery] = useState('');

  const [gameState, setGameState] = useState<{
    currentScene: any;
    subState: string;
    currentSceneIdx: number;
    totalScenes: number;
    nextSceneTitle: string;
    votedCount: number;
    totalParticipantsCount: number;
    hostName?: string;
    allScenes?: { index: number; id: string; title: string; type: string; question?: string; notes?: string }[];
  } | null>(null);

  const prevSubStateRef = useRef<string>('');

  // 1. Ekrāna negulēšana vadītājam (WakeLock)
  useEffect(() => {
    let wakeLock: any = null;
    const requestLock = async () => {
      if ('wakeLock' in navigator && (navigator as any).wakeLock) {
        try { wakeLock = await (navigator as any).wakeLock.request('screen'); } catch {}
      }
    };
    requestLock();
    return () => { if (wakeLock) wakeLock.release().catch(() => {}); };
  }, []);

  // 2. Haptiskā vibrācija pie fāžu maiņas [C punkts]
  useEffect(() => {
    const curSub = gameState?.subState;
    if (curSub && curSub !== prevSubStateRef.current) {
      if (curSub === 'ACTIVE') {
        try { if ('vibrate' in navigator) navigator.vibrate(60); } catch {}
      } else if (curSub === 'STATS') {
        try { if ('vibrate' in navigator) navigator.vibrate([80, 60, 80]); } catch {}
      } else if (curSub === 'REVEAL') {
        try { if ('vibrate' in navigator) navigator.vibrate([100, 50, 100, 50, 150]); } catch {}
      }
      prevSubStateRef.current = curSub;
    }
  }, [gameState?.subState]);

  useEffect(() => {
    const s = io(BACKEND_URL, { reconnection: true });
    setSocket(s);

    s.on('connect', () => {
      if (pin && hostToken) {
        s.emit('host:join-remote', { pin: pin.trim(), hostToken: hostToken.trim(), hostName: hostName.trim() });
      }
    });

    s.on('host-state-update', (data: any) => {
      setIsAuthorized(true);
      setGameState(data);
      if (data.hostName && !hostName) {
        setHostName(data.hostName);
      }
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

    return () => { s.disconnect(); };
  }, [pin, hostToken]);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
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

  // Vadības komandas
  const handleAdvance = () => {
    if (gameState?.subState === 'ACTIVE') return; // Bloķēts, kamēr rit laiks!
    try { if ('vibrate' in navigator) navigator.vibrate(50); } catch {}
    socket?.emit('host:advance', { pin, hostToken, force: true });
  };

  const handleBacktrack = () => {
    if (!window.confirm('Vai tiešām vēlies spert soli atpakaļ?')) return;
    try { if ('vibrate' in navigator) navigator.vibrate(80); } catch {}
    socket?.emit('host:backtrack', { pin, hostToken });
  };

  const handleTogglePause = () => {
    try { if ('vibrate' in navigator) navigator.vibrate(40); } catch {}
    if (gameState?.subState === 'PAUSED') {
      socket?.emit('host:resume-session', { pin, hostToken });
    } else {
      socket?.emit('host:pause-session', { pin, hostToken });
    }
  };

  const handleRestartScene = () => {
    if (!window.confirm('Restartēt šo jautājumu no jauna?')) return;
    try { if ('vibrate' in navigator) navigator.vibrate(100); } catch {}
    socket?.emit('host:restart-scene', { pin, hostToken });
  };

  const handleToggleStageQr = () => {
    try { if ('vibrate' in navigator) navigator.vibrate(35); } catch {}
    socket?.emit('host:toggle-qr-zoom', { pin, hostToken });
  };

  const handleJumpToScene = (sceneIndex: number) => {
    try { if ('vibrate' in navigator) navigator.vibrate(70); } catch {}
    socket?.emit('host:jump-to-scene', { pin, hostToken, sceneIndex });
    setActiveTab('REMOTE');
  };

  const handlePlaySfx = (sfx: string) => {
    try { if ('vibrate' in navigator) navigator.vibrate(30); } catch {}
    socket?.emit('host:play-sfx', { pin, hostToken, sfx });
  };

  if (!isAuthorized) {
    return (
      <div style={containerStyle}>
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
  const config = scene?.config || {};
  const correctAnswers = config.correctAnswers || config.correctOrder || [];
  const notes = config.notes || '';
  const isTimeActive = subState === 'ACTIVE';

  // Slaidu saraksta meklētājs [E punkts]
  const filteredScenes = (gameState?.allScenes || []).filter((sc) =>
    sc.title.toLowerCase().includes(slideSearchQuery.toLowerCase()) ||
    (sc.question && sc.question.toLowerCase().includes(slideSearchQuery.toLowerCase()))
  );

  return (
    <div style={containerStyle}>
      {/* 1. AUGŠĒJĀ JOSLA */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={badgePin}>PIN: {pin}</span>
          <span style={{ fontSize: '0.8rem', color: '#aaa' }}>
            #{ (gameState?.currentSceneIdx ?? 0) + 1 } / { gameState?.totalScenes }
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button onClick={() => setActiveTab(activeTab === 'REMOTE' ? 'SLIDES' : 'REMOTE')} style={btnTabToggle}>
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

      {/* 2. CILNE: SLAIDU SARAKSTS AR MEKLĒTĀJU & TIEŠO LĒKŠANU */}
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
                  onClick={() => handleJumpToScene(sc.index)}
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
                  {isCurrent && <span style={{ color: '#00ff00', fontWeight: 'bold', fontSize: '0.8rem' }}>AKTUĀLS</span>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* 3. CILNE: GALVENĀ VADĪBAS PULTS AR ŠPIKERI */
        <div style={{ flex: 1, padding: '10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          {/* Host Vārda atgādinājums */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#181818', padding: '4px 8px', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: '#888' }}>Vadītājs:</span>
            <input
              value={hostName}
              onChange={(e) => handleUpdateHostName(e.target.value)}
              placeholder="Ievadi savu vārdu..."
              style={{ background: 'transparent', border: 'none', color: '#ffc107', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'right', outline: 'none' }}
            />
          </div>

          {/* Pašreizējais slaids */}
          <div style={sectionBox}>
            <div style={{ fontSize: '0.75rem', color: '#ffc107', fontWeight: 'bold' }}>
              📋 PAŠREIZĒJAIS SLAIDS:
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#fff', marginTop: '2px' }}>
              {scene?.title || 'Slaids'} ({scene?.type})
            </div>
            {config.layout?.find((el: any) => el.type === 'QUESTION')?.content && (
              <div style={{ fontSize: '0.9rem', color: '#ddd', marginTop: '4px', fontStyle: 'italic' }}>
                "{config.layout.find((el: any) => el.type === 'QUESTION')?.content}"
              </div>
            )}
          </div>

          {/* 🌟 PAREIZĀ ATBILDE (ŠPIKERIS) */}
          {correctAnswers.length > 0 && (
            <div style={{ ...sectionBox, border: '2px solid #00ff00', background: 'rgba(0, 255, 0, 0.08)' }}>
              <div style={{ fontSize: '0.75rem', color: '#00ff00', fontWeight: 'bold' }}>
                ✅ PAREIZĀ ATBILDE:
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#00ff00', marginTop: '2px' }}>
                {correctAnswers.join(' | ')}
              </div>
            </div>
          )}

          {/* 📝 PIEZĪMES VADĪTĀJAM (HOST NOTES) */}
          {notes && (
            <div style={{ ...sectionBox, border: '1px solid #ffc107', background: 'rgba(255, 193, 7, 0.08)' }}>
              <div style={{ fontSize: '0.75rem', color: '#ffc107', fontWeight: 'bold' }}>
                💡 PIEZĪMES VADĪTĀJAM:
              </div>
              <div style={{ fontSize: '0.9rem', color: '#fff', marginTop: '3px', whiteSpace: 'pre-wrap', lineHeight: 1.3 }}>
                {notes}
              </div>
            </div>
          )}

          {/* Nākamais slaids */}
          <div style={{ fontSize: '0.75rem', color: '#888', textAlign: 'center' }}>
            🔜 Nākamais: <strong style={{ color: '#aaa' }}>{gameState?.nextSceneTitle}</strong>
          </div>

          {/* 🔊 ĀTRAIS SKAŅU DĒLIS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '4px' }}>
            <button onClick={() => handlePlaySfx('correct')} style={btnSfx}>🔔 Pareizi</button>
            <button onClick={() => handlePlaySfx('wrong')} style={btnSfx}>❌ Kļūda</button>
            <button onClick={() => handlePlaySfx('buzzer_hit')} style={btnSfx}>⚡ Pults</button>
            <button onClick={() => handlePlaySfx('suspense')} style={btnSfx}>🥁 Spriedze</button>
          </div>

          {/* Avārijas pogas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
            <button onClick={handleBacktrack} style={btnSecondary}>↩️ Atpakaļ</button>
            <button onClick={handleTogglePause} style={{ ...btnSecondary, color: '#ff9800' }}>
              {subState === 'PAUSED' ? '▶️ Turpināt' : '⏸️ Pauze'}
            </button>
            <button onClick={handleRestartScene} style={{ ...btnSecondary, color: '#ff4d4d' }}>🔄 Restartēt</button>
          </div>
        </div>
      )}

      {/* 🚀 MILZĪGĀ SPACE / TĀLĀK POGA AR LIVE SKAITĪTĀJU [B punkts] */}
      <div style={{ padding: '10px 12px', background: '#181818', borderTop: '1px solid #333' }}>
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

          {/* Live balsošanas progress uz pogas */}
          {gameState && (
            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginTop: '2px', opacity: 0.9 }}>
              [ {gameState.votedCount} / {gameState.totalParticipantsCount} nobalsojuši ]
            </div>
          )}
        </button>
      </div>
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
  overflow: 'hidden'
};

const headerStyle: React.CSSProperties = {
  height: '46px',
  background: '#1a1a1a',
  borderBottom: '1px solid #333',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 10px',
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
  boxShadow: '0 4px 15px rgba(0,0,0,0.4)'
};

const btnSecondary: React.CSSProperties = {
  padding: '7px 4px',
  background: '#222',
  color: '#ccc',
  border: '1px solid #444',
  borderRadius: '6px',
  fontSize: '0.75rem',
  fontWeight: 'bold',
  cursor: 'pointer'
};

const btnSfx: React.CSSProperties = {
  padding: '7px 2px',
  background: '#2a2a2a',
  color: '#00e5ff',
  border: '1px solid #444',
  borderRadius: '6px',
  fontSize: '0.75rem',
  fontWeight: 'bold',
  cursor: 'pointer'
};

const btnTabToggle: React.CSSProperties = {
  padding: '4px 8px',
  background: '#333',
  color: '#00e5ff',
  border: '1px solid #00e5ff',
  borderRadius: '4px',
  fontSize: '0.75rem',
  fontWeight: 'bold',
  cursor: 'pointer'
};

const btnQrHeader: React.CSSProperties = {
  padding: '4px 8px',
  background: '#007bff',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  fontSize: '0.75rem',
  fontWeight: 'bold',
  cursor: 'pointer'
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