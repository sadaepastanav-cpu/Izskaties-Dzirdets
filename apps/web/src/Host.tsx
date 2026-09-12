import React, { useState, useEffect } from 'react';
import { socket } from './socket';

export default function Host() {
  const [pin, setPin] = useState<string | null>(localStorage.getItem('active_pin'));
  const [scenes, setScenes] = useState<any[]>([]);
  const [currentScene, setCurrentScene] = useState<any>(null);
  const [folder, setFolder] = useState(
    localStorage.getItem('event_studio_folder') || 'C:/ManiSovi'
  );
  const [localProjects, setLocalProjects] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [leaderboardPage, setLeaderboardPage] = useState<number>(0);
  const [podiumStage, setPodiumStage] = useState<number>(0);

  const [playersList, setPlayersList] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'SCENES' | 'ANALYZER'>('SCENES');

  const loadProjects = async (folderPath?: string) => {
    try {
      setIsLoading(true);
      const targetFolder = folderPath || folder;
      const res = await fetch(`http://${window.location.hostname}:3000/api/set-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetFolder })
      });
      const data = await res.json();
      if (Array.isArray(data.projects)) {
        setLocalProjects(data.projects);
        setFolder(data.currentPath);
        localStorage.setItem('event_studio_folder', data.currentPath);
      }
    } catch {
      alert('❌ Kļūda piekļūstot mapei!');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetch(`http://${window.location.hostname}:3000/api/check-recovery`)
      .then((res) => res.json())
      .then((data) => {
        if (data.canRecover && data.pin) {
          const shouldRecover = window.confirm(
            `Atrasta nepabeigta sesija ar PIN: ${data.pin} ("${data.title || 'Aktīvā spēle'}"). Vai atjaunot?`
          );
          if (shouldRecover) {
            fetch(`http://${window.location.hostname}:3000/api/recover-session`, { method: 'POST' })
              .then((r) => r.json())
              .then((rec) => {
                if (rec.success) {
                  setPin(rec.pin);
                  setCurrentScene(rec.state?.currentScene);
                  setScenes(rec.state?.scenes || []);
                  localStorage.setItem('active_pin', rec.pin);
                }
              });
          }
        }
      })
      .catch(() => {});

    loadProjects();
  }, []);

  const startProject = async (fileName: string) => {
    try {
      setIsLoading(true);
      const res = await fetch(`http://${window.location.hostname}:3000/api/load-project/${fileName}`);
      if (!res.ok) throw new Error();

      const projectData = await res.json();
      socket.emit('host:create-session', { projectData });
    } catch {
      alert('❌ Neizdevās palaist projektu!');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndSession = () => {
    setPin(null);
    setCurrentScene(null);
    setScenes([]);
    setLeaderboardPage(0);
    setPodiumStage(0);
    setPlayersList([]);
    localStorage.removeItem('active_pin');
  };

  const changeLeaderboardPage = (newPage: number) => {
    if (newPage < 0 || !pin) return;
    setLeaderboardPage(newPage);
    socket.emit('host:change-leaderboard-page', { pin, page: newPage });
  };

  // Pārslēgt statistiku ekrānā ar 'C'
  const toggleChart = () => {
    if (pin) socket.emit('host:toggle-chart', { pin });
  };

  useEffect(() => {
    const handleSessionInfo = (data: any) => {
      setPin(data.pin);
      setScenes(data.state?.scenes || []);
      setCurrentScene(data.state?.currentScene);
      localStorage.setItem('active_pin', data.pin);
    };

    const handleStateUpdate = (s: any) => {
      setCurrentScene(s);
      if (s?.type === 'LEADERBOARD') {
        setLeaderboardPage(0);
        setPodiumStage(0);
      }
    };

    const handlePresence = (data: any) => {
      if (Array.isArray(data?.players)) {
        setPlayersList(data.players);
      }
    };

    const handleLeaderboard = (payload: any) => {
      const list = Array.isArray(payload) ? payload : (payload?.data || []);
      setPlayersList(list);
    };

    socket.on('session-info', handleSessionInfo);
    socket.on('state-update', handleStateUpdate);
    socket.on('presence-update', handlePresence);
    socket.on('leaderboard-update', handleLeaderboard);
    socket.on('podium-stage-change', (stage: number) => setPodiumStage(stage));

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space' && pin) {
        e.preventDefault();
        socket.emit('host:advance', pin);
      } else if ((e.key === 'c' || e.key === 'C') && pin) {
        e.preventDefault();
        toggleChart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      socket.off('session-info', handleSessionInfo);
      socket.off('state-update', handleStateUpdate);
      socket.off('presence-update', handlePresence);
      socket.off('leaderboard-update', handleLeaderboard);
      socket.off('podium-stage-change');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pin]);

  if (!pin) {
    return (
      <div style={panelContainer}>
        <h1 style={{ color: '#007bff', marginBottom: '25px' }}>EVENT STUDIO — VADĪTĀJA PANELIS</h1>
        <div style={cardBox}>
          <h3>📂 AKTUĀLĀ DARBA MAPE</h3>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
            <input
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="C:/ManiSovi"
              style={folderInputHost}
            />
            <button onClick={() => loadProjects(folder)} disabled={isLoading} style={btnScan}>
              {isLoading ? '...' : 'SKENĒT'}
            </button>
          </div>

          <div style={{ marginTop: '20px', textAlign: 'left' }}>
            <h4 style={{ color: '#aaa', borderBottom: '1px solid #444', paddingBottom: '8px' }}>
              Pieejamie projekti ({localProjects.length}):
            </h4>
            {localProjects.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic' }}>Šajā mapē nav neviena .json faila.</p>
            ) : (
              localProjects.map((p) => (
                <button key={p} onClick={() => startProject(p)} disabled={isLoading} style={projectBtn}>
                  🚀 Sākt šovu: {p}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  const isFinalLb = currentScene?.type === 'LEADERBOARD' && currentScene?.config?.lbType === 'FINAL';

  return (
    <div style={panelContainer}>
      <div style={topBar}>
        <div>
          <span style={{ color: '#aaa', fontSize: '1.2rem' }}>Aktīvā sesija: </span>
          <span style={{ color: '#28a745', fontSize: '1.8rem', fontWeight: 'bold' }}>PIN: {pin}</span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {/* STATISTIKAS PĀRSLĒGŠANAS POGA */}
          <button onClick={toggleChart} style={btnPurple} title="Ieslēgt / Izslēgt balsošanas skaitļus ekrānā">
            📊 Statistika [C]
          </button>
          <button onClick={() => socket.emit('host:simulate-players', { pin, count: 20 })} style={btnGray}>
            🤖 +20 Boti
          </button>
          <button onClick={() => window.open(`/present/${pin}`, '_blank')} style={btnBlue}>
            🖥️ Projektora ekrāns
          </button>
          <button onClick={handleEndSession} style={btnRed}>
            ❌ Beigt sesiju
          </button>
        </div>
      </div>

      <div style={instructionBox}>
        <div style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>⌨️ SPIED [ SPACE ] TAUSTIŅU, LAI VADĪTU ŠOVU</div>
        <div style={{ marginTop: '5px', opacity: 0.9 }}>
          Slaids: <strong>{currentScene?.title || 'Nav sākts'}</strong> | Fāze:{' '}
          <span style={{ color: '#ffc107', fontWeight: 'bold' }}>{currentScene?.subState || 'IDLE'}</span>
          {' '}| <em>Spiediet [ C ], lai parādītu/paslēptu statistiku!</em>
        </div>
      </div>

      {isFinalLb && (
        <div style={{ background: '#1c3d1c', border: '2px solid #28a745', padding: '15px', borderRadius: '8px', textAlign: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#00ff00' }}>🥇 FINĀLA APBALVOŠANA NORIT</h3>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
            Pašreizējais solis: {podiumStage === 0 && 'Gatavībā'}
            {podiumStage === 1 && '🥉 3. vieta parādīta'}
            {podiumStage === 2 && '🥈 2. vieta parādīta'}
            {podiumStage === 3 && '👑 1. VIETA PARĀDĪTA (Uzvarētājs)'}
            {podiumStage >= 4 && '📋 Pilnais saraksts'}
          </div>
        </div>
      )}

      {currentScene?.type === 'LEADERBOARD' && !isFinalLb && (
        <div style={leaderControlBox}>
          <h4 style={{ margin: '0 0 10px 0', color: '#ffc107' }}>
            🏆 LĪDERU TABULA: {currentScene?.config?.lbType || 'TOTAL'}
          </h4>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', alignItems: 'center' }}>
            <button onClick={() => changeLeaderboardPage(leaderboardPage - 1)} disabled={leaderboardPage === 0} style={btnNav}>
              ⬅️ Iepriekšējā lapa
            </button>
            <span style={{ fontWeight: 'bold' }}>Lapa: {leaderboardPage + 1}</span>
            <button onClick={() => changeLeaderboardPage(leaderboardPage + 1)} style={btnNav}>
              Nākamā lapa ➡️
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '850px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '10px', borderBottom: '2px solid #333', marginBottom: '15px' }}>
          <button
            onClick={() => setActiveTab('SCENES')}
            style={{
              ...tabButton,
              borderBottom: activeTab === 'SCENES' ? '3px solid #007bff' : 'none',
              color: activeTab === 'SCENES' ? '#fff' : '#888'
            }}
          >
            📋 Slaidu secība ({scenes.length})
          </button>
          <button
            onClick={() => setActiveTab('ANALYZER')}
            style={{
              ...tabButton,
              borderBottom: activeTab === 'ANALYZER' ? '3px solid #00e5ff' : 'none',
              color: activeTab === 'ANALYZER' ? '#00e5ff' : '#888'
            }}
          >
            📈 Analītika & Spēlētāju laiki ({playersList.length})
          </button>
        </div>

        {activeTab === 'SCENES' && (
          <div>
            {scenes.map((s, i) => {
              const isActive = currentScene?.id === s.id;
              return (
                <div
                  key={s.id || i}
                  onClick={() => socket.emit('host:next-scene', { pin, scene: s })}
                  style={{
                    ...slideRow,
                    background: isActive ? '#28a745' : '#222',
                    border: isActive ? '2px solid #fff' : '1px solid #444'
                  }}
                >
                  <span>
                    {i + 1}. {s.config?.question || s.title || `Slaids #${i + 1}`} ({s.type})
                    {s.type === 'LEADERBOARD' && ` [${s.config?.lbType || 'TOTAL'}]`}
                  </span>
                  {isActive && <span style={activeBadge}>{currentScene?.subState || 'IDLE'}</span>}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'ANALYZER' && (
          <div style={{ background: '#1c1c1c', borderRadius: '8px', padding: '15px', border: '1px solid #333' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#00e5ff' }}>
              ⏱️ SPĒLĒTĀJU REZULTĀTI UN APDOMAS LAIKI (TIE-BREAKER ANALYZER)
            </h4>

            {playersList.length === 0 ? (
              <p style={{ color: '#888', fontStyle: 'italic' }}>Pagaidām nav pieslēdzies neviens spēlētājs.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #444', color: '#aaa' }}>
                    <th style={{ padding: '8px' }}>#</th>
                    <th style={{ padding: '8px' }}>Vārds</th>
                    <th style={{ padding: '8px' }}>Pults ID</th>
                    <th style={{ padding: '8px' }}>Punkti</th>
                    <th style={{ padding: '8px' }}>Kārtas punkti</th>
                    <th style={{ padding: '8px' }}>Kopējais laiks</th>
                  </tr>
                </thead>
                <tbody>
                  {playersList.map((p, idx) => (
                    <tr key={p.id || idx} style={{ borderBottom: '1px solid #2a2a2a' }}>
                      <td style={{ padding: '8px', fontWeight: 'bold', color: idx === 0 ? 'gold' : '#fff' }}>
                        {idx + 1}.
                      </td>
                      <td style={{ padding: '8px' }}>{p.name}</td>
                      <td style={{ padding: '8px', color: '#ffc107' }}>Pults #{p.deviceNumber || idx + 1}</td>
                      <td style={{ padding: '8px', fontWeight: 'bold', color: 'gold' }}>{p.score ?? 0} pt</td>
                      <td style={{ padding: '8px', color: '#28a745' }}>{p.roundScore ?? 0} pt</td>
                      <td style={{ padding: '8px', color: '#00e5ff', fontWeight: 'bold' }}>
                        ⏱️ {((p.totalTimeMs || 0) / 1000).toFixed(2)}s
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- STILI ---
const panelContainer: React.CSSProperties = {
  padding: '30px',
  background: '#111',
  color: '#fff',
  minHeight: '100vh',
  fontFamily: 'Segoe UI, Arial, sans-serif',
  boxSizing: 'border-box'
};

const cardBox: React.CSSProperties = {
  maxWidth: '550px',
  margin: '0 auto',
  background: '#1e1e1e',
  padding: '25px',
  borderRadius: '12px',
  border: '1px solid #333'
};

const folderInputHost: React.CSSProperties = {
  flex: 1,
  padding: '10px',
  background: '#000',
  color: '#0f0',
  border: '1px solid #555',
  borderRadius: '6px',
  fontSize: '0.95rem'
};

const btnScan: React.CSSProperties = {
  padding: '10px 18px',
  background: '#007bff',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 'bold'
};

const topBar: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  background: '#1e1e1e',
  padding: '15px 20px',
  borderRadius: '10px',
  border: '1px solid #333',
  marginBottom: '20px'
};

const instructionBox: React.CSSProperties = {
  background: '#004085',
  color: '#b8daff',
  padding: '15px',
  borderRadius: '8px',
  textAlign: 'center',
  marginBottom: '20px',
  border: '1px solid #0056b3'
};

const leaderControlBox: React.CSSProperties = {
  background: '#332700',
  border: '1px solid #ffc107',
  padding: '12px',
  borderRadius: '8px',
  textAlign: 'center',
  marginBottom: '20px'
};

const projectBtn: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '14px',
  margin: '10px 0',
  background: '#2d2d2d',
  color: '#fff',
  border: '1px solid #444',
  borderRadius: '8px',
  textAlign: 'left',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '1rem'
};

const slideRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 20px',
  margin: '8px 0',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '1.05rem'
};

const activeBadge: React.CSSProperties = {
  background: '#fff',
  color: '#28a745',
  padding: '2px 10px',
  borderRadius: '4px',
  fontSize: '0.8rem',
  fontWeight: 'bold'
};

const btnBlue: React.CSSProperties = {
  padding: '10px 16px',
  background: '#007bff',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 'bold'
};

const btnPurple: React.CSSProperties = {
  padding: '10px 16px',
  background: '#6f42c1',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 'bold'
};

const btnRed: React.CSSProperties = {
  padding: '10px 16px',
  background: '#dc3545',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 'bold'
};

const btnGray: React.CSSProperties = {
  padding: '10px 14px',
  background: '#444',
  color: '#fff',
  border: '1px solid #666',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 'bold'
};

const btnNav: React.CSSProperties = {
  padding: '8px 16px',
  background: '#ffc107',
  color: '#000',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 'bold'
};

const tabButton: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: '10px 15px',
  fontSize: '1rem',
  fontWeight: 'bold',
  cursor: 'pointer'
};