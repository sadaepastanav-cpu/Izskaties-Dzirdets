import React, { useState, useEffect } from 'react';
import { socket } from './socket';
import { BACKEND_URL, getAdminHeaders } from './config';

const formatThinkingTime = (ms?: number): string => {
  if (ms === undefined || ms === null) return '0.00s';
  return (ms / 1000).toFixed(2) + 's';
};

export default function Host() {
  const [pin, setPin] = useState<string | null>(localStorage.getItem('active_pin'));
  const [hostToken, setHostToken] = useState<string | null>(localStorage.getItem('active_host_token'));
  const [scenes, setScenes] = useState<any[]>([]);
  const [currentScene, setCurrentScene] = useState<any>(null);
  const [branding, setBranding] = useState<any>({});
  const [folder, setFolder] = useState<string>(
    localStorage.getItem('event_studio_folder') || ''
  );
  const [localProjects, setLocalProjects] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStartingTunnel, setIsStartingTunnel] = useState(false);
  const [leaderboardPage, setLeaderboardPage] = useState<number>(0);
  const [podiumStage, setPodiumStage] = useState<number>(0);

  const [playersList, setPlayersList] = useState<any[]>([]);
  const [teamLeaderboard, setTeamLeaderboard] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'SCENES' | 'ANALYZER' | 'TEAMS'>('SCENES');
  const [sortMode, setSortMode] = useState<'ORDER' | 'SCORE'>('ORDER');

  // TĪKLA UN TUNEĻA IESTATĪJUMI
  const [connectionMode, setConnectionMode] = useState<'LAN' | 'TUNNEL'>(
    (localStorage.getItem('event_conn_mode') as any) || 'TUNNEL'
  );
  const [localIp, setLocalIp] = useState<string>('localhost');
  const [customTunnelUrl, setCustomTunnelUrl] = useState<string>('');
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
        } else {
          setCustomTunnelUrl('');
        }
      })
      .catch(() => {});

    const handleTunnelReady = (data: { url: string }) => {
      if (data?.url) {
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
        headers: {
          'Content-Type': 'application/json',
          ...getAdminHeaders()
        },
        body: JSON.stringify({ path: targetFolder })
      });
      
      const data = await res.json();
      if (data.success) {
        setLocalProjects(Array.isArray(data.projects) ? data.projects : []);
        setFolder(data.currentPath);
        localStorage.setItem('event_studio_folder', data.currentPath);
      } else {
        setLocalProjects([]);
        alert(`❌ Kļūda: ${data.error || 'Neizdevās nolasīt mapi'}`);
      }
    } catch {
      alert('❌ Neizdevās sazināties ar serveri! Pārbaudiet vai backend darbojas.');
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
              headers: {
                'Content-Type': 'application/json',
                ...getAdminHeaders()
              }
            })
              .then((r) => r.json())
              .then((rec) => {
                if (rec.success) {
                  setPin(rec.pin);
                  setHostToken(rec.hostToken);
                  setCurrentScene(rec.state?.currentScene);
                  setScenes(rec.state?.scenes || []);
                  if (rec.state?.branding) setBranding(rec.state.branding);
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
      const res = await fetch(`${BACKEND_URL}/api/load-project/${encodeURIComponent(fileName)}`, {
        headers: getAdminHeaders()
      });
      if (!res.ok) throw new Error('Neizdevās ielādēt failu');

      const projectData = await res.json();
      setBranding(projectData.branding || {});
      localStorage.setItem('event_conn_mode', connectionMode);
      localStorage.setItem('event_tunnel_url', customTunnelUrl);

      socket.emit('host:create-session', {
        projectData,
        connectionUrl: activeBaseUrl
      });
    } catch {
      alert(`❌ Neizdevās palaist projektu "${fileName}"!`);
    } finally {
      setIsLoading(false);
    }
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
    setTeamLeaderboard([]);
    localStorage.removeItem('active_pin');
    localStorage.removeItem('active_host_token');
  };

  const handlePauseResume = () => {
    if (!pin || !hostToken) return;
    if (currentScene?.subState === 'ACTIVE') {
      socket.emit('host:pause-session', { pin, hostToken });
    } else if (currentScene?.subState === 'PAUSED') {
      socket.emit('host:resume-session', { pin, hostToken });
    }
  };

  const handleRestartQuestion = () => {
    if (!pin || !hostToken) return;
    if (window.confirm('Vai tiešām vēlies sākt šo jautājumu no jauna? Balsis tiks notīrītas.')) {
      socket.emit('host:restart-scene', { pin, hostToken });
    }
  };

  const handleExportCsv = async () => {
    if (!pin) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/export-csv/${pin}`, {
        headers: getAdminHeaders()
      });

      if (!response.ok) {
        const err = await response.json();
        return alert(`❌ Kļūda: ${err.error || 'Neizdevās eksportēt'}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `rezultati_sesija_${pin}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('❌ Neizdevās lejupielādēt CSV failu!');
    }
  };

  // 1-KLIKŠĶA DIPLOMU DRUKA (Top 3)
  const handlePrintDiplomas = () => {
    const sorted = [...playersList].filter((p) => !p.isDisabled).sort((a, b) => (b.score || 0) - (a.score || 0));
    const top3 = sorted.slice(0, 3);
    if (top3.length === 0) return alert('Nav spēlētāju diplomu ģenerēšanai!');

    const printWin = window.open('', '_blank');
    if (!printWin) return;

    printWin.document.write(`
      <html>
        <head>
          <title>Top 3 Diplomi - PIN ${pin}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; background: #fff; text-align: center; }
            .diploma { page-break-after: always; height: 95vh; display: flex; flex-direction: column; justify-content: center; align-items: center; border: 15px solid #ffc107; margin: 20px; box-sizing: border-box; }
            h1 { font-size: 3rem; color: #333; margin: 0; text-transform: uppercase; }
            h2 { font-size: 2rem; color: #ffc107; margin: 10px 0; }
            .winner { font-size: 3.5rem; font-weight: bold; color: #007bff; margin: 20px 0; }
            .score { font-size: 1.8rem; color: #555; }
            .footer { margin-top: 40px; font-size: 1.2rem; color: #888; }
          </style>
        </head>
        <body>
          ${top3.map((p, idx) => `
            <div class="diploma">
              <h1>🏆 DIPLOMS 🏆</h1>
              <h2>Par iegūto ${idx + 1}. vietu spēlē</h2>
              <div class="winner">${p.name} ${branding?.teamModeEnabled && p.teamName ? `(${p.teamName})` : ''}</div>
              <div class="score">Iegūtie punkti: <strong>${p.score || 0} pt</strong></div>
              <div class="footer">Event Studio • Spēles PIN: ${pin} • ${new Date().toLocaleDateString('lv-LV')}</div>
            </div>
          `).join('')}
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWin.document.close();
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
      if (data.state?.branding) setBranding(data.state.branding);
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

    const handleTeamLeaderboard = (payload: any) => {
      const list = Array.isArray(payload) ? payload : (payload?.data || []);
      setTeamLeaderboard(list);
    };

    socket.on('session-info', handleSessionInfo);
    socket.on('state-update', handleStateUpdate);
    socket.on('presence-update', handlePresence);
    socket.on('leaderboard-update', handleLeaderboard);
    socket.on('team-leaderboard-update', handleTeamLeaderboard);
    socket.on('podium-stage-change', (stage: number) => setPodiumStage(stage));

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space' && pin && hostToken) {
        e.preventDefault();
        if (currentScene?.subState === 'ACTIVE') return;
        socket.emit('host:advance', { pin, hostToken });
      } else if ((e.key === 'p' || e.key === 'P') && pin && hostToken) {
        e.preventDefault();
        handlePauseResume();
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
      socket.off('team-leaderboard-update', handleTeamLeaderboard);
      socket.off('podium-stage-change');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pin, hostToken, currentScene?.subState]);

  const isTeamMode = !!branding?.teamModeEnabled;
  const joinUrl = `${activeBaseUrl}/?pin=${pin}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(joinUrl)}`;

  // SKATS 1: PROJEKTA IZVĒLE
  if (!pin) {
    return (
      <div style={panelContainer}>
        <h1 style={{ color: '#007bff', textAlign: 'center', marginBottom: '25px', fontSize: '2rem' }}>
          EVENT STUDIO — VADĪTĀJA PANELIS
        </h1>
        
        {/* TĪKLA KONFIGURĀCIJA */}
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
                  {customTunnelUrl ? '✓ Cloudflare tunelis aktīvs:' : '⏳ Tunelis nav palaists:'}
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
          <h3 style={{ margin: '0 0 12px 0', color: '#ffc107' }}>📂 AKTUĀLĀ PROJEKTU MAPE</h3>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
            <input
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="C:\ManiProjekti vai mapes ceļš..."
              style={folderInputHost}
              onKeyDown={(e) => {
                if (e.key === 'Enter') loadProjects(folder);
              }}
            />
            <button onClick={() => loadProjects(folder)} disabled={isLoading} style={btnScan}>
              {isLoading ? '⏳...' : '🔍 SKENĒT'}
            </button>
          </div>

          <div style={{ marginTop: '15px', textAlign: 'left' }}>
            <h4 style={{ color: '#aaa', borderBottom: '1px solid #444', paddingBottom: '8px', margin: '0 0 10px 0' }}>
              Pieejamie projekti ({localProjects.length}):
            </h4>

            {localProjects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#888' }}>
                <p style={{ fontStyle: 'italic', margin: 0 }}>Šajā mapē nav atrasts neviens .json projekts.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {localProjects.map((p) => (
                  <button key={p} onClick={() => startProject(p)} disabled={isLoading} style={projectBtn}>
                    <span style={{ fontSize: '1.2rem' }}>🚀</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 'bold', color: '#00ff00' }}>SĀKT ŠOVU: {p}</div>
                      <div style={{ fontSize: '0.75rem', color: '#aaa' }}>Klikšķini, lai atvērtu spēli</div>
                    </div>
                  </button>
                ))}
              </div>
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

  const currentIdx = scenes.findIndex((s) => s.id === currentScene?.id);
  const nextScene = currentIdx !== -1 && currentIdx < scenes.length - 1 ? scenes[currentIdx + 1] : null;

  const isCurrentActive = currentScene?.subState === 'ACTIVE';
  const isCurrentPaused = currentScene?.subState === 'PAUSED';

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
          {(isCurrentActive || isCurrentPaused) && (
            <button
              onClick={handlePauseResume}
              style={{ ...btnPurple, background: isCurrentPaused ? '#28a745' : '#ff9800', color: '#000', fontWeight: 'bold' }}
              title="Pauze / Turpināt [P]"
            >
              {isCurrentPaused ? '▶️ Turpināt laiku [P]' : '⏸️ Iepauzēt [P]'}
            </button>
          )}

          {(isCurrentActive || isCurrentPaused || currentScene?.subState === 'STATS') && (
            <button onClick={handleRestartQuestion} style={btnGray} title="Sākt šo jautājumu no jauna bez punktiem">
              🔄 No jauna
            </button>
          )}

          <button onClick={toggleChart} style={btnPurple} title="Ieslēgt / Izslēgt balsošanas skaitļus ekrānā">
            📊 Statistika [C]
          </button>
          <button onClick={handleExportCsv} style={{ ...btnGray, background: '#198754' }} title="Lejupielādēt CSV">
            📥 CSV
          </button>
          <button onClick={handlePrintDiplomas} style={{ ...btnGray, background: '#d63384' }} title="Ģenerēt diplomus Top 3">
            🏆 Diplomi
          </button>
          <button onClick={() => socket.emit('host:simulate-players', { pin, hostToken, count: 20 })} style={btnGray}>
            🤖 +20 Boti
          </button>
          <button onClick={() => window.open(`/present/${pin}`, '_blank')} style={btnBlue}>
            🖥️ Ekrāns
          </button>
          <button onClick={handleEndSession} style={btnRed}>
            ❌ Beigt sesiju
          </button>
        </div>
      </div>

      {/* VADĪBAS JOSLA & NĀKAMĀ SLAIDA PRIEKŠSKATĪJUMS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '15px', marginBottom: '15px' }}>
        <div style={instructionBox}>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
            {isCurrentActive ? '⏳ LAIKA ATSKAITE RIT (Space nobloķēts. Spied [P], lai pauzētu)' : '⌨️ SPIED [ SPACE ] TAUSTIŅU, LAI VADĪTU ŠOVU'}
          </div>
          <div style={{ marginTop: '5px', opacity: 0.9, fontSize: '0.95rem' }}>
            Slaids: <strong>{currentScene?.title || 'Nav sākts'}</strong> | Fāze:{' '}
            <span style={{ color: isCurrentPaused ? '#ff5722' : '#ffc107', fontWeight: 'bold' }}>
              {currentScene?.subState || 'IDLE'}
            </span>
          </div>
        </div>

        <div style={{ background: '#1c1c1c', border: '1px solid #444', borderRadius: '8px', padding: '10px 15px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: '#00e5ff', fontWeight: 'bold' }}>⏭️ NĀKAMAIS SLAIDS (PREVIEW):</div>
          <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 'bold', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {nextScene ? `${nextScene.config?.question || nextScene.title} (${nextScene.type})` : '🏁 Spēles noslēgums'}
          </div>
          {nextScene?.config?.notes && (
            <div style={{ fontSize: '0.75rem', color: '#ffc107', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              📝 {nextScene.config.notes}
            </div>
          )}
        </div>
      </div>

      {currentScene?.config?.notes && currentScene.config.notes.trim() !== '' && (
        <div style={hostNotesCard}>
          <div style={{ fontWeight: 'bold', color: '#ffc107', marginBottom: '5px', fontSize: '0.95rem' }}>
            📝 VADĪTĀJA PIEZĪMES ŠIM SLAIDAM:
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

      <div style={{ maxWidth: '950px', margin: '0 auto' }}>
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
              📋 Slaidi ({scenes.length})
            </button>
            <button
              onClick={() => setActiveTab('ANALYZER')}
              style={{
                ...tabButton,
                borderBottom: activeTab === 'ANALYZER' ? '3px solid #00e5ff' : 'none',
                color: activeTab === 'ANALYZER' ? '#00e5ff' : '#888'
              }}
            >
              👥 Spēlētāji ({playersList.length})
            </button>
            {isTeamMode && (
              <button
                onClick={() => setActiveTab('TEAMS')}
                style={{
                  ...tabButton,
                  borderBottom: activeTab === 'TEAMS' ? '3px solid #ffc107' : 'none',
                  color: activeTab === 'TEAMS' ? '#ffc107' : '#888'
                }}
              >
                🏆 Komandas ({teamLeaderboard.length})
              </button>
            )}
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
                    <div style={{ fontWeight: 'bold' }}>
                      <span>{i + 1}. {s.config?.question || s.title || `Slaids #${i + 1}`} ({s.type})</span>
                    </div>
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
              <h4 style={{ margin: 0, color: '#00e5ff' }}>👥 DALĪBNIEKU PĀRVALDĪBA</h4>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setSortMode('ORDER')} style={{ ...btnSmallSort, background: sortMode === 'ORDER' ? '#007bff' : '#333' }}>
                  Pēc pults #
                </button>
                <button onClick={() => setSortMode('SCORE')} style={{ ...btnSmallSort, background: sortMode === 'SCORE' ? '#007bff' : '#333' }}>
                  Pēc punktiem
                </button>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #444', color: '#aaa' }}>
                  <th style={{ padding: '8px' }}>Pults</th>
                  <th style={{ padding: '8px' }}>Vārds</th>
                  {isTeamMode && <th style={{ padding: '8px' }}>Komanda</th>}
                  <th style={{ padding: '8px' }}>Punkti</th>
                  <th style={{ padding: '8px' }}>Laiks</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Darbība</th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #2a2a2a', opacity: p.isDisabled ? 0.4 : 1 }}>
                    <td style={{ padding: '8px', fontWeight: 'bold', color: '#ffc107' }}>#{p.deviceNumber || 1}</td>
                    <td style={{ padding: '8px' }}>
                      <input value={p.name} onChange={(e) => updatePlayer(p.id, { name: e.target.value })} style={tableInput} />
                      {p.missedQuestionsCount >= 3 && !p.isDisabled && (
                        <span style={{ fontSize: '0.75rem', color: '#ff9800', marginLeft: '5px' }}>[Kavē: {p.missedQuestionsCount}]</span>
                      )}
                      {p.isDisabled && (
                        <span style={{ fontSize: '0.75rem', color: '#dc3545', marginLeft: '5px', fontWeight: 'bold' }}>[Atslēgts]</span>
                      )}
                    </td>
                    {isTeamMode && (
                      <td style={{ padding: '8px' }}>
                        <input value={p.teamName || ''} onChange={(e) => updatePlayer(p.id, { teamName: e.target.value })} placeholder="Komanda" style={{ ...tableInput, width: '110px' }} />
                      </td>
                    )}
                    <td style={{ padding: '8px' }}>
                      <input type="number" value={p.score ?? 0} onChange={(e) => updatePlayer(p.id, { score: Number(e.target.value) })} style={{ ...tableInput, width: '60px', color: 'gold', fontWeight: 'bold' }} />
                    </td>
                    <td style={{ padding: '8px', color: '#00e5ff' }}>{formatThinkingTime(p.totalTimeMs)}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <button
                        onClick={() => updatePlayer(p.id, { isDisabled: !p.isDisabled, missedQuestionsCount: 0 })}
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
          </div>
        )}

        {isTeamMode && activeTab === 'TEAMS' && (
          <div style={{ background: '#1c1c1c', borderRadius: '8px', padding: '15px', border: '1px solid #333' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#ffc107' }}>🏆 KOMANDU KOPVĒRTĒJUMS</h4>
            {teamLeaderboard.length === 0 ? (
              <p style={{ color: '#888', fontStyle: 'italic' }}>Nav reģistrēta neviena komanda.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #444', color: '#aaa' }}>
                    <th style={{ padding: '8px' }}>Vieta</th>
                    <th style={{ padding: '8px' }}>Komandas nosaukums</th>
                    <th style={{ padding: '8px' }}>Dalībnieki</th>
                    <th style={{ padding: '8px' }}>Vidējais / Kopējais rezultāts</th>
                  </tr>
                </thead>
                <tbody>
                  {teamLeaderboard.map((t, idx) => (
                    <tr key={t.name} style={{ borderBottom: '1px solid #2a2a2a' }}>
                      <td style={{ padding: '8px', fontWeight: 'bold', color: '#00ff00' }}>#{idx + 1}</td>
                      <td style={{ padding: '8px', fontWeight: 'bold', color: '#fff', fontSize: '1rem' }}>{t.name}</td>
                      <td style={{ padding: '8px', color: '#aaa' }}>{t.memberCount} spēlētāji ({t.members?.join(', ')})</td>
                      <td style={{ padding: '8px', color: 'gold', fontWeight: 'bold', fontSize: '1.1rem' }}>{t.score} pt</td>
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
  maxWidth: '580px',
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
  padding: '12px',
  background: '#000',
  color: '#0f0',
  border: '1px solid #555',
  borderRadius: '6px',
  fontSize: '0.95rem'
};

const btnScan: React.CSSProperties = {
  padding: '12px 22px',
  background: '#007bff',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '1rem'
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
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  width: '100%',
  padding: '14px 18px',
  background: '#1c2e20',
  color: '#fff',
  border: '1px solid #28a745',
  borderRadius: '8px',
  cursor: 'pointer',
  boxSizing: 'border-box'
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