import React, { useState, useEffect, useRef } from 'react';
import { socket } from './socket';
import { BACKEND_URL, ADMIN_API_KEY, getAdminHeaders } from './config';

const formatThinkingTime = (ms?: number): string => {
  if (ms === undefined || ms === null) return '0.00s';
  return (ms / 1000).toFixed(2) + 's';
};

export default function Host() {
  const [pin, setPin] = useState<string | null>(localStorage.getItem('active_pin'));
  const [hostToken, setHostToken] = useState<string | null>(localStorage.getItem('active_host_token'));
  const [scenes, setScenes] = useState<any[]>([]);
  const [currentScene, setCurrentScene] = useState<any>(null);
  const [folder, setFolder] = useState(
    localStorage.getItem('event_studio_folder') || ''
  );
  const [localProjects, setLocalProjects] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStartingTunnel, setIsStartingTunnel] = useState(false);
  const [leaderboardPage, setLeaderboardPage] = useState<number>(0);
  const [podiumStage, setPodiumStage] = useState<number>(0);

  const [playersList, setPlayersList] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'SCENES' | 'ANALYZER'>('SCENES');
  const [sortMode, setSortMode] = useState<'ORDER' | 'SCORE'>('ORDER');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // TĪKLA UN TUNEĻA IESTATĪJUMI
  const [connectionMode, setConnectionMode] = useState<'LAN' | 'TUNNEL'>(
    (localStorage.getItem('event_conn_mode') as any) || 'TUNNEL'
  );
  const [localIp, setLocalIp] = useState<string>('localhost');
  const [customTunnelUrl, setCustomTunnelUrl] = useState<string>(
    localStorage.getItem('event_tunnel_url') || ''
  );
  const [isTunnelAutoDetected, setIsTunnelAutoDetected] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tunnelParam = urlParams.get('tunnel');
    if (tunnelParam) {
      setCustomTunnelUrl(tunnelParam);
      setConnectionMode('TUNNEL');
      setIsTunnelAutoDetected(true);
      localStorage.setItem('event_tunnel_url', tunnelParam);
    }

    fetch(`${BACKEND_URL}/api/network-ip`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.localIp) setLocalIp(d.localIp);
        if (d?.tunnelUrl) {
          setCustomTunnelUrl(d.tunnelUrl);
          setConnectionMode('TUNNEL');
          setIsTunnelAutoDetected(true);
          localStorage.setItem('event_tunnel_url', d.tunnelUrl);
        }
      })
      .catch(() => {});

    const handleTunnelReady = (data: { url: string }) => {
      if (data?.url) {
        console.log('🚀 [Cloudflare] Tunelis gatavs:', data.url);
        setCustomTunnelUrl(data.url);
        setConnectionMode('TUNNEL');
        setIsTunnelAutoDetected(true);
        setIsStartingTunnel(false);
        localStorage.setItem('event_tunnel_url', data.url);
      }
    };

    socket.on('tunnel-ready', handleTunnelReady);

    return () => {
      socket.off('tunnel-ready', handleTunnelReady);
    };
  }, []);

  const activeBaseUrl =
    connectionMode === 'TUNNEL' && customTunnelUrl.trim() !== ''
      ? (customTunnelUrl.trim().startsWith('http') ? customTunnelUrl.trim() : `https://${customTunnelUrl.trim()}`).replace(/\/$/, '')
      : `http://${localIp}:5173`;

  const handleStartTunnel = () => {
    setIsStartingTunnel(true);
    socket.emit('host:start-tunnel');
  };

  const loadProjects = async (folderPath?: string) => {
    try {
      setIsLoading(true);
      const targetFolder = folderPath !== undefined ? folderPath : folder;
      const res = await fetch(`${BACKEND_URL}/api/set-path`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ path: targetFolder })
      });
      const data = await res.json();
      if (data.success) {
        if (Array.isArray(data.projects)) setLocalProjects(data.projects);
        setFolder(data.currentPath);
        localStorage.setItem('event_studio_folder', data.currentPath);
      } else {
        setLocalProjects([]);
      }
    } catch {
      console.error('Kļūda skenējot mapi');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/current-path`, {
      headers: getAdminHeaders()
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.currentPath) {
          const pathToUse = localStorage.getItem('event_studio_folder') || d.currentPath;
          setFolder(pathToUse);
          loadProjects(pathToUse);
        } else {
          loadProjects();
        }
      })
      .catch(() => loadProjects());

    fetch(`${BACKEND_URL}/api/check-recovery`)
      .then((res) => res.json())
      .then((data) => {
        if (data.canRecover && data.pin) {
          const shouldRecover = window.confirm(
            `Atrasta nepabeigta sesija ar PIN: ${data.pin} ("${data.title || 'Aktīvā spēle'}"). Vai atjaunot?`
          );
          if (shouldRecover) {
            fetch(`${BACKEND_URL}/api/recover-session`, {
              method: 'POST',
              headers: getAdminHeaders()
            })
              .then((r) => r.json())
              .then((rec) => {
                if (rec.success) {
                  setPin(rec.pin);
                  setHostToken(rec.hostToken);
                  setCurrentScene(rec.state?.currentScene);
                  setScenes(rec.state?.scenes || []);
                  localStorage.setItem('active_pin', rec.pin);
                  if (rec.hostToken) localStorage.setItem('active_host_token', rec.hostToken);
                }
              });
          }
        }
      })
      .catch(() => {});
  }, []);

  const startProject = async (fileName: string) => {
    try {
      setIsLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/load-project/${fileName}`, {
        headers: { 'x-admin-key': ADMIN_API_KEY }
      });
      if (!res.ok) throw new Error();

      const projectData = await res.json();
      localStorage.setItem('event_conn_mode', connectionMode);
      localStorage.setItem('event_tunnel_url', customTunnelUrl);

      socket.emit('host:create-session', {
        projectData,
        connectionUrl: activeBaseUrl
      });
    } catch {
      alert('❌ Neizdevās palaist projektu!');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectFileOpen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const projectData = JSON.parse(event.target?.result as string);
        if (projectData && (projectData.scenes || Array.isArray(projectData))) {
          const formattedData = Array.isArray(projectData) ? { scenes: projectData } : projectData;

          localStorage.setItem('event_conn_mode', connectionMode);
          localStorage.setItem('event_tunnel_url', customTunnelUrl);

          socket.emit('host:create-session', {
            projectData: formattedData,
            connectionUrl: activeBaseUrl
          });
        } else {
          alert('❌ Fails nesatur derīgus projekta slaidus!');
        }
      } catch {
        alert('❌ Neizdevās nolasīt .json failu!');
      }
    };
    reader.readAsText(file);
  };

  const handleEndSession = () => {
    if (pin && hostToken) {
      socket.emit('host:end-session', { pin, hostToken });
    }
    setPin(null);
    setHostToken(null);
    setCurrentScene(null);
    setScenes([]);
    setLeaderboardPage(0);
    setPodiumStage(0);
    setPlayersList([]);
    localStorage.removeItem('active_pin');
    localStorage.removeItem('active_host_token');
  };

  const changeLeaderboardPage = (newPage: number) => {
    if (newPage < 0 || !pin || !hostToken) return;
    setLeaderboardPage(newPage);
    socket.emit('host:change-leaderboard-page', { pin, hostToken, page: newPage });
  };

  const toggleChart = () => {
    if (pin && hostToken) socket.emit('host:toggle-chart', { pin, hostToken });
  };

  const updatePlayer = (playerId: string, updates: any) => {
    if (!pin || !hostToken) return;
    socket.emit('host:update-player', { pin, hostToken, playerId, ...updates });
  };

  useEffect(() => {
    const handleSessionInfo = (data: any) => {
      setPin(data.pin);
      if (data.hostToken) {
        setHostToken(data.hostToken);
        localStorage.setItem('active_host_token', data.hostToken);
      }
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

      if (e.code === 'Space' && pin && hostToken) {
        e.preventDefault();
        socket.emit('host:advance', { pin, hostToken });
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
  }, [pin, hostToken]);

  const joinUrl = `${activeBaseUrl}/?pin=${pin}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(joinUrl)}`;

  // SKATS 1: PROJEKTA IZVĒLE
  if (!pin) {
    return (
      <div style={panelContainer}>
        <input
          type="file"
          ref={fileInputRef}
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleDirectFileOpen}
        />

        <h1 style={{ color: '#007bff', marginBottom: '20px' }}>EVENT STUDIO — VADĪTĀJA PANELIS</h1>
        
        {/* TĪKLA UN TUNEĻA KONFIGURĀCIJA */}
        <div style={{ ...cardBox, border: '1px solid #007bff', marginBottom: '20px', background: '#182430' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, color: '#00e5ff' }}>📡 KĀ SPĒLĒTĀJI PIESLĒGSIES?</h3>
            {!customTunnelUrl && (
              <button
                onClick={handleStartTunnel}
                disabled={isStartingTunnel}
                style={{ ...btnScan, background: '#6f42c1', fontSize: '0.85rem', padding: '6px 12px' }}
              >
                {isStartingTunnel ? '⏳ Startējam...' : '🚀 Palaist Cloudflare tuneli'}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <button
              onClick={() => setConnectionMode('TUNNEL')}
              style={{
                ...btnMode,
                background: connectionMode === 'TUNNEL' ? '#6f42c1' : '#222',
                borderColor: connectionMode === 'TUNNEL' ? '#00e5ff' : '#444'
              }}
            >
              🌐 Publiskais tunelis (Cloudflare)
            </button>
            <button
              onClick={() => setConnectionMode('LAN')}
              style={{
                ...btnMode,
                background: connectionMode === 'LAN' ? '#007bff' : '#222',
                borderColor: connectionMode === 'LAN' ? '#00e5ff' : '#444'
              }}
            >
              📶 Lokālais Wi-Fi (LAN)
            </button>
          </div>

          {connectionMode === 'LAN' ? (
            <div style={noticeBox}>
              <span style={{ color: '#00ff00', fontWeight: 'bold' }}>✓ Wi-Fi adrese: </span>
              <code>http://{localIp}:5173</code>
              <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>
                Telefoniem jābūt tajā pašā Wi-Fi tīklā.
              </div>
            </div>
          ) : (
            <div style={{ ...noticeBox, background: '#1a1025', borderColor: customTunnelUrl ? '#00ff00' : '#d63384' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.85rem', color: customTunnelUrl ? '#00ff00' : '#ff79c6', fontWeight: 'bold' }}>
                  {customTunnelUrl ? '✓ Cloudflare tunelis aktīvs:' : '⏳ Tunelis nav palaists (nospiediet augšā pogu):'}
                </span>
                {isTunnelAutoDetected && (
                  <span style={{ fontSize: '0.75rem', background: '#28a745', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>
                    AUTO
                  </span>
                )}
              </div>
              <input
                value={customTunnelUrl}
                onChange={(e) => setCustomTunnelUrl(e.target.value)}
                placeholder="Palaidiet tuneli vai ievadiet manuāli..."
                style={{
                  ...folderInputHost,
                  color: '#00e5ff',
                  borderColor: customTunnelUrl ? '#00e5ff' : '#555',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}
        </div>

        {/* PROJEKTU MAPE */}
        <div style={cardBox}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0 }}>📂 AKTUĀLĀ PROJEKTU MAPE</h3>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ ...btnScan, background: '#28a745' }}
              title="Atvērt jebkuru .json failu no sava datora"
            >
              📄 Pārlūkot failu (.json)
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
            <input
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="C:/ManiSovi vai relatīvais ceļš..."
              style={folderInputHost}
            />
            <button onClick={() => loadProjects(folder)} disabled={isLoading} style={btnScan}>
              {isLoading ? '...' : '🔍 SKENĒT'}
            </button>
          </div>

          <div style={{ marginTop: '20px', textAlign: 'left' }}>
            <h4 style={{ color: '#aaa', borderBottom: '1px solid #444', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Pieejamie projekti mapē ({localProjects.length}):</span>
              <span style={{ fontSize: '0.8rem', color: '#666' }}>{folder}</span>
            </h4>
            {localProjects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '15px 0' }}>
                <p style={{ color: '#888', fontStyle: 'italic', margin: '0 0 12px 0' }}>
                  Šajā mapē nav neviena .json projekta faila vai mape vēl nav noskenēta.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{ ...btnScan, background: '#007bff' }}
                >
                  📂 Atvērt projektu tieši no datora failiem
                </button>
              </div>
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

  const sortedPlayers = [...playersList].sort((a, b) => {
    if (sortMode === 'SCORE') {
      if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
      return (a.totalTimeMs || 0) - (b.totalTimeMs || 0);
    }
    return (a.deviceNumber || 0) - (b.deviceNumber || 0);
  });

  const isCurrentMulti =
    currentScene?.config?.selectionMode === 'ALL' &&
    (currentScene?.config?.correctAnswers?.length || 0) > 1;

  const isCurrentAnyOne =
    currentScene?.config?.selectionMode === 'ANY_ONE' &&
    (currentScene?.config?.correctAnswers?.length || 0) > 1;

  return (
    <div style={panelContainer}>
      <div style={topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div>
            <span style={{ color: '#aaa', fontSize: '1.1rem' }}>Aktīvā sesija: </span>
            <span style={{ color: '#28a745', fontSize: '1.8rem', fontWeight: 'bold' }}>PIN: {pin}</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#00e5ff', background: 'rgba(0,229,255,0.15)', padding: '4px 10px', borderRadius: '6px', border: '1px solid #00e5ff' }}>
            🔗 {activeBaseUrl}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={toggleChart} style={btnPurple} title="Ieslēgt / Izslēgt balsošanas skaitļus ekrānā">
            📊 Statistika [C]
          </button>
          <button onClick={() => socket.emit('host:simulate-players', { pin, hostToken, count: 20 })} style={btnGray}>
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
          {isCurrentMulti && (
            <span style={{ marginLeft: '10px', background: '#007bff', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>
              ☑️ Daudzizvēle
            </span>
          )}
          {isCurrentAnyOne && (
            <span style={{ marginLeft: '10px', background: '#17a2b8', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>
              ☝️ Viens no
            </span>
          )}
        </div>
      </div>

      {currentScene?.config?.notes && currentScene.config.notes.trim() !== '' && (
        <div style={hostNotesCard}>
          <div style={{ fontWeight: 'bold', color: '#ffc107', marginBottom: '5px', fontSize: '0.95rem' }}>
            📝 VADĪTĀJA PIEZĪMES ŠIM SLAIDAM (Nav redzams skatītājiem):
          </div>
          <div style={{ fontSize: '1.05rem', color: '#fff', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
            {currentScene.config.notes}
          </div>
        </div>
      )}

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

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #333', marginBottom: '15px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
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
              👥 Spēlētāju vadība & Laiki ({playersList.length})
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src={qrCodeUrl}
              alt="QR"
              style={{ width: '45px', height: '45px', borderRadius: '4px', cursor: 'pointer', border: '1px solid #fff' }}
              title="Atvērt spēles saiti"
              onClick={() => window.open(joinUrl, '_blank')}
            />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.8rem', color: '#00ff00', fontWeight: 'bold' }}>QR Kods gatavs</div>
              <div style={{ fontSize: '0.75rem', color: '#888', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeBaseUrl}
              </div>
            </div>
          </div>
        </div>

        {activeTab === 'SCENES' && (
          <div>
            {scenes.map((s, i) => {
              const isActive = currentScene?.id === s.id;
              const hasMulti = s.config?.selectionMode === 'ALL' && (s.config?.correctAnswers?.length || 0) > 1;
              const hasAnyOne = s.config?.selectionMode === 'ANY_ONE' && (s.config?.correctAnswers?.length || 0) > 1;

              return (
                <div
                  key={s.id || i}
                  onClick={() => hostToken && socket.emit('host:next-scene', { pin, hostToken, scene: s })}
                  style={{
                    ...slideRow,
                    background: isActive ? '#28a745' : '#222',
                    border: isActive ? '2px solid #fff' : '1px solid #444'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                      <span>{i + 1}. {s.config?.question || s.title || `Slaids #${i + 1}`} ({s.type})</span>
                      {s.type === 'LEADERBOARD' && <span>[{s.config?.lbType || 'TOTAL'}]</span>}
                      {hasMulti && (
                        <span style={{ fontSize: '0.75rem', background: '#007bff', color: '#fff', padding: '1px 6px', borderRadius: '4px' }}>
                          ☑️ Daudzizvēle
                        </span>
                      )}
                      {hasAnyOne && (
                        <span style={{ fontSize: '0.75rem', background: '#17a2b8', color: '#fff', padding: '1px 6px', borderRadius: '4px' }}>
                          ☝️ Viens no
                        </span>
                      )}
                    </div>
                    {s.config?.notes && (
                      <div style={{ fontSize: '0.8rem', color: '#ffc107', marginTop: '3px' }}>
                        💬 {s.config.notes}
                      </div>
                    )}
                  </div>
                  {isActive && <span style={activeBadge}>{currentScene?.subState || 'IDLE'}</span>}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'ANALYZER' && (
          <div style={{ background: '#1c1c1c', borderRadius: '8px', padding: '15px', border: '1px solid #333' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, color: '#00e5ff' }}>👥 DALĪBNIEKU PĀRVALDĪBA UN REZULTĀTI</h4>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setSortMode('ORDER')}
                  style={{ ...btnSmallSort, background: sortMode === 'ORDER' ? '#007bff' : '#333' }}
                >
                  Pēc pults #
                </button>
                <button
                  onClick={() => setSortMode('SCORE')}
                  style={{ ...btnSmallSort, background: sortMode === 'SCORE' ? '#007bff' : '#333' }}
                >
                  Pēc punktiem (Līderi)
                </button>
              </div>
            </div>

            {sortedPlayers.length === 0 ? (
              <p style={{ color: '#888', fontStyle: 'italic' }}>Pagaidām nav pieslēdzies neviens spēlētājs.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #444', color: '#aaa' }}>
                    <th style={{ padding: '8px' }}>Pults</th>
                    <th style={{ padding: '8px' }}>Vārds (Rediģējams)</th>
                    <th style={{ padding: '8px' }}>Punkti</th>
                    <th style={{ padding: '8px' }}>Apdomas laiks</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Darbība</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #2a2a2a', opacity: p.isDisabled ? 0.4 : 1 }}>
                      <td style={{ padding: '8px', fontWeight: 'bold', color: '#ffc107' }}>
                        #{p.deviceNumber || 1}
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input
                          value={p.name}
                          onChange={(e) => updatePlayer(p.id, { name: e.target.value })}
                          style={tableInput}
                          title="Klikšķini, lai mainītu vārdu"
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input
                          type="number"
                          value={p.score ?? 0}
                          onChange={(e) => updatePlayer(p.id, { score: Number(e.target.value) })}
                          style={{ ...tableInput, width: '60px', color: 'gold', fontWeight: 'bold' }}
                          title="Klikšķini, lai labotu punktus"
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input
                          type="number"
                          step="100"
                          value={p.totalTimeMs ?? 0}
                          onChange={(e) => updatePlayer(p.id, { totalTimeMs: Number(e.target.value) })}
                          style={{ ...tableInput, width: '90px', color: '#00e5ff' }}
                          title="Laiks milisekundēs"
                        />
                        <span style={{ fontSize: '0.8rem', color: '#888', marginLeft: '6px' }}>
                          ({formatThinkingTime(p.totalTimeMs)})
                        </span>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <button
                          onClick={() => updatePlayer(p.id, { isDisabled: !p.isDisabled })}
                          style={{
                            padding: '4px 10px',
                            background: p.isDisabled ? '#28a745' : '#dc3545',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 'bold'
                          }}
                        >
                          {p.isDisabled ? 'Ieslēgt' : 'Atslēgt'}
                        </button>
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

const btnMode: React.CSSProperties = {
  flex: 1,
  padding: '12px',
  color: '#fff',
  border: '2px solid',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '0.95rem',
  transition: 'all 0.15s ease'
};

const noticeBox: React.CSSProperties = {
  padding: '12px 15px',
  background: '#112211',
  border: '1px solid #28a745',
  borderRadius: '6px',
  fontSize: '0.95rem'
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
  padding: '12px',
  borderRadius: '8px',
  textAlign: 'center',
  marginBottom: '15px',
  border: '1px solid #0056b3'
};

const hostNotesCard: React.CSSProperties = {
  background: 'rgba(50, 40, 0, 0.7)',
  border: '2px solid #ffc107',
  padding: '12px 18px',
  borderRadius: '8px',
  marginBottom: '15px',
  boxShadow: '0 4px 15px rgba(255, 193, 7, 0.2)'
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
  padding: '12px 18px',
  margin: '8px 0',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '1rem'
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

const btnSmallSort: React.CSSProperties = {
  padding: '5px 10px',
  color: '#fff',
  border: '1px solid #555',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontWeight: 'bold'
};

const tableInput: React.CSSProperties = {
  background: '#000',
  border: '1px solid #444',
  color: '#fff',
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '0.9rem',
  boxSizing: 'border-box'
};