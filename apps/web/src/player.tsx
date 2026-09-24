import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { BACKEND_URL } from './config';

const formatThinkingTime = (ms?: number): string => {
  if (ms === undefined || ms === null) return '0.00s';
  return (ms / 1000).toFixed(2) + 's';
};

const MEDIA_BASE_URL = `${BACKEND_URL}/project-media`;
const BUTTON_COLORS = ['#007bff', '#fd7e14', '#28a745', '#ffc107', '#6f42c1', '#17a2b8'];

export default function Player() {
  const params = new URLSearchParams(window.location.search);
  const urlPin = params.get('pin') || '';
  const urlTeam = params.get('team') || '';

  const [pin, setPin] = useState(urlPin || localStorage.getItem('player_pin') || '');
  const [name, setName] = useState(localStorage.getItem('player_name') || '');
  const [teamName, setTeamName] = useState(urlTeam || localStorage.getItem('player_team') || '');
  const [isCaptain, setIsCaptain] = useState(urlTeam ? false : localStorage.getItem('player_is_captain') === 'true');
  const [isTeamFromQr] = useState(Boolean(urlTeam));

  const [playerId] = useState(() => {
    let id = localStorage.getItem('player_id');
    if (!id) {
      id = 'p_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('player_id', id);
    }
    return id;
  });

  const [socket, setSocket] = useState<Socket | null>(null);
  const [deviceNumber, setDeviceNumber] = useState<number | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isDisabledAfk, setIsDisabledAfk] = useState(false);
  const [scene, setScene] = useState<any>(null);
  const [subState, setSubState] = useState<string>('IDLE');

  const [myChoice, setMyChoice] = useState<string | null>(null);
  const [selectedMultipleOptions, setSelectedMultipleOptions] = useState<string[]>([]);

  const [playersList, setPlayersList] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [teamLeaderboard, setTeamLeaderboard] = useState<any[]>([]);
  const [leaderboardType, setLeaderboardType] = useState<string>('TOTAL');
  const [podiumStage, setPodiumStage] = useState<number>(0);
  const [buzzerTestPresses, setBuzzerTestPresses] = useState(0);

  const [branding, setBranding] = useState<any>(() => {
    try {
      const cached = localStorage.getItem('cached_branding');
      return cached
        ? JSON.parse(cached)
        : {
            appTitle: 'EVENT BUZZER',
            appLogo: '',
            appBgImage: '',
            welcomeImage: '',
            appBgColor: '#121212',
            lobbyMode: 'CIRCLE',
            teamModeEnabled: Boolean(urlTeam)
          };
    } catch {
      return {
        appTitle: 'EVENT BUZZER',
        appLogo: '',
        appBgImage: '',
        welcomeImage: '',
        appBgColor: '#121212',
        lobbyMode: 'CIRCLE',
        teamModeEnabled: Boolean(urlTeam)
      };
    }
  });

  const [serverBaseUrl, setServerBaseUrl] = useState<string>('');

  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && (navigator as any).wakeLock) {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        } catch {}
      }
    };
    requestWakeLock();
    return () => {
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (urlPin) {
      const cleanP = urlPin.trim();
      setPin(cleanP);
      localStorage.setItem('player_pin', cleanP);

      fetch(`${BACKEND_URL}/api/session-branding/${cleanP}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.branding) {
            setBranding(res.branding);
            localStorage.setItem('cached_branding', JSON.stringify(res.branding));
            if (res.connectionUrl) setServerBaseUrl(res.connectionUrl);
          }
        })
        .catch(() => {});
    }

    if (urlTeam) {
      const cleanT = urlTeam.trim();
      setTeamName(cleanT);
      setIsCaptain(false);
      localStorage.setItem('player_team', cleanT);
      localStorage.setItem('player_is_captain', 'false');
    }
  }, [urlPin, urlTeam]);

  useEffect(() => {
    const s = io(BACKEND_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });
    setSocket(s);

    const tryAutoJoin = () => {
      const savedPin = urlPin || localStorage.getItem('player_pin');
      const savedName = localStorage.getItem('player_name');
      const savedTeam = urlTeam || localStorage.getItem('player_team') || '';
      const savedCaptain = urlTeam ? false : localStorage.getItem('player_is_captain') === 'true';
      const wasJoined = sessionStorage.getItem('player_active_session') === 'true';

      if (savedPin) {
        s.emit('get-branding', { pin: savedPin.trim() });
      }

      if (wasJoined && savedPin && savedName) {
        s.emit('join-session', {
          pin: savedPin.trim(),
          name: savedName.trim(),
          teamName: savedTeam,
          isCaptain: savedCaptain,
          playerId
        });
      }
    };

    s.on('connect', () => {
      tryAutoJoin();
    });

    s.on('join-success', (data: any) => {
      setIsJoined(true);
      setIsGameOver(false);
      setIsDisabledAfk(false);
      sessionStorage.setItem('player_active_session', 'true');
      if (data?.deviceNumber) setDeviceNumber(data.deviceNumber);
      if (data?.teamName) setTeamName(data.teamName);
      if (data?.isCaptain !== undefined) setIsCaptain(data.isCaptain);
      if (data?.connectionUrl) setServerBaseUrl(data.connectionUrl);
      if (data?.branding) {
        setBranding((prev: any) => {
          const updated = { ...prev, ...data.branding };
          localStorage.setItem('cached_branding', JSON.stringify(updated));
          return updated;
        });
      }
      if (data?.currentScene) setScene(data.currentScene);
      const currentSub = (data?.subState || data?.currentScene?.subState || 'IDLE').toUpperCase();
      setSubState(currentSub);
      localStorage.setItem('player_pin', pin.trim());
      localStorage.setItem('player_name', name.trim());
      localStorage.setItem('player_is_captain', String(isCaptain));
      if (teamName) localStorage.setItem('player_team', teamName.trim());
    });

    s.on('session-branding', (br: any) => {
      if (br && Object.keys(br).length > 0) {
        setBranding((prev: any) => {
          const updated = { ...prev, ...br };
          localStorage.setItem('cached_branding', JSON.stringify(updated));
          return updated;
        });
      }
    });

    s.on('presence-update', (data: any) => {
      if (Array.isArray(data?.players)) {
        setPlayersList(data.players);
      }
    });

    s.on('state-update', (newScene: any) => {
      setScene(newScene);
      const newSub = (newScene?.subState || 'READY').toUpperCase();
      setSubState(newSub);
      setMyChoice(null);
      setSelectedMultipleOptions([]);
      setPodiumStage(0);
    });

    s.on('leaderboard-update', (payload: any) => {
      if (Array.isArray(payload)) {
        setLeaderboard(payload);
        setLeaderboardType('TOTAL');
      } else {
        setLeaderboard(payload?.data || []);
        setLeaderboardType((payload?.lbType || 'TOTAL').toUpperCase());
      }
      setPodiumStage(0);
    });

    s.on('team-leaderboard-update', (payload: any) => {
      const list = Array.isArray(payload) ? payload : payload?.data || [];
      setTeamLeaderboard(list);
    });

    s.on('podium-stage-change', (stage: number) => setPodiumStage(stage));

    s.on('player-disabled-afk', (data: { playerId: string }) => {
      if (data.playerId === playerId) setIsDisabledAfk(true);
    });

    s.on('game-over', () => setIsGameOver(true));

    s.on('session-ended', () => {
      sessionStorage.removeItem('player_active_session');
      localStorage.removeItem('player_pin');
      setIsJoined(false);
      setIsGameOver(false);
      setIsDisabledAfk(false);
      setScene(null);
      setMyChoice(null);
      setSelectedMultipleOptions([]);
      setDeviceNumber(null);
      setBuzzerTestPresses(0);
      setPin('');
      alert('Vadītājs ir beidzis spēles sesiju.');
    });

    s.on('error-message', (msg: string) => alert(msg));

    return () => {
      s.disconnect();
    };
  }, [playerId, urlPin, urlTeam, pin, name, isCaptain, teamName]);

  useEffect(() => {
    if (socket && pin && pin.trim().length >= 4) {
      socket.emit('get-branding', { pin: pin.trim() });
    }
  }, [pin, socket]);

  const isTeamMode = Boolean(branding?.teamModeEnabled || urlTeam || isTeamFromQr);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return alert('Lūdzu ievadiet PIN kodu!');
    if (!name.trim()) return alert('Lūdzu ievadiet savu vārdu!');

    if (isTeamMode) {
      if (!isTeamFromQr && !teamName.trim()) {
        return alert('Lūdzu ievadiet savas komandas nosaukumu!');
      }
      if (isTeamFromQr && !teamName.trim()) {
        return alert('Kļūda komandas saitē. Noskenējiet kapteiņa QR kodu vēlreiz.');
      }
    }

    localStorage.setItem('player_pin', pin.trim());
    localStorage.setItem('player_name', name.trim());
    localStorage.setItem('player_is_captain', String(!isTeamFromQr));
    if (isTeamMode && teamName) localStorage.setItem('player_team', teamName.trim());

    if (socket) {
      socket.emit('join-session', {
        pin: pin.trim(),
        name: name.trim(),
        teamName: isTeamMode ? teamName.trim() : '',
        isCaptain: isTeamMode ? !isTeamFromQr : false,
        playerId
      });
    }
  };

  const requiredCount = scene?.config?.requiredCount ?? (scene?.config?.correctAnswers?.length || 1);
  const isMultiSelectMode = scene?.config?.selectionMode === 'ALL' && requiredCount > 1;
  const maxRequiredChoices = requiredCount > 0 ? requiredCount : 1;

  const handleSingleVoteSubmit = (option: string, letter: string) => {
    if (myChoice || !socket || subState === 'PAUSED' || isDisabledAfk) return;
    try { if ('vibrate' in navigator) navigator.vibrate(80); } catch {}
    setMyChoice(option || letter);

    const answers = [option, letter].filter(Boolean);
    socket.emit('participant:submit-answer', { pin, answer: option || letter, answers, playerId });
  };

  const toggleMultiSelectOption = (item: string) => {
    if (myChoice || subState === 'PAUSED' || isDisabledAfk) return;

    setSelectedMultipleOptions((prev) => {
      if (prev.includes(item)) {
        try { if ('vibrate' in navigator) navigator.vibrate(30); } catch {}
        return prev.filter((x) => x !== item);
      } else {
        if (prev.length >= maxRequiredChoices) return prev;
        try { if ('vibrate' in navigator) navigator.vibrate(50); } catch {}
        return [...prev, item];
      }
    });
  };

  const handleMultiVoteSubmit = () => {
    if (myChoice || !socket || selectedMultipleOptions.length !== maxRequiredChoices || subState === 'PAUSED' || isDisabledAfk) return;
    try { if ('vibrate' in navigator) navigator.vibrate(100); } catch {}

    const chosenStr = selectedMultipleOptions.join(', ');
    setMyChoice(chosenStr);

    socket.emit('participant:submit-answer', {
      pin,
      answer: chosenStr,
      answers: selectedMultipleOptions,
      playerId
    });
  };

  const handleTestBuzzer = () => {
    if (!socket) return;
    try { if ('vibrate' in navigator) navigator.vibrate(60); } catch {}
    setBuzzerTestPresses((prev) => prev + 1);
    socket.emit('participant:test-buzzer', { pin, playerId });
  };

  const handleLeaveOrNewGame = () => {
    sessionStorage.removeItem('player_active_session');
    localStorage.removeItem('player_pin');
    localStorage.removeItem('player_team');
    localStorage.removeItem('player_is_captain');
    setIsJoined(false);
    setIsGameOver(false);
    setIsDisabledAfk(false);
    setScene(null);
    setMyChoice(null);
    setSelectedMultipleOptions([]);
    setDeviceNumber(null);
    setBuzzerTestPresses(0);
    setPin('');
  };

  const isRoundLb = leaderboardType === 'ROUND';
  const sortedLeaderboard = [...leaderboard]
    .filter((p) => !p.isDisabled)
    .sort((a, b) => {
      const scoreA = isRoundLb ? a.roundScore ?? 0 : a.score ?? 0;
      const scoreB = isRoundLb ? b.roundScore ?? 0 : b.score ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      const timeA = isRoundLb ? a.roundTimeMs || 0 : a.totalTimeMs || 0;
      const timeB = isRoundLb ? b.roundTimeMs || 0 : b.totalTimeMs || 0;
      return timeA - timeB;
    });

  const totalPlayersCount = sortedLeaderboard.length || 1;
  const myRankIndex = sortedLeaderboard.findIndex((p) => p.id === playerId || p.name === name);
  const myRank = myRankIndex !== -1 ? myRankIndex + 1 : '-';
  const myScoreData = myRankIndex !== -1 ? sortedLeaderboard[myRankIndex] : null;

  const myTeamData = isTeamMode && teamName ? teamLeaderboard.find((t) => t.name?.toLowerCase() === teamName.toLowerCase()) : null;
  const myTeamRankIndex = isTeamMode && teamName ? teamLeaderboard.findIndex((t) => t.name?.toLowerCase() === teamName.toLowerCase()) : -1;
  const myTeamRank = myTeamRankIndex !== -1 ? myTeamRankIndex + 1 : '-';
  const totalTeamsCount = teamLeaderboard.length || 1;

  const appBgStyle: React.CSSProperties = {
    ...fullScreenMobile,
    backgroundColor: branding.appBgColor || '#121212',
    backgroundImage: branding.appBgImage ? `url(${MEDIA_BASE_URL}/${branding.appBgImage})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  };

  const myTeammates = isTeamMode && teamName
    ? playersList.filter((p) => p.teamName?.trim().toLowerCase() === teamName.trim().toLowerCase())
    : [];

  const baseHost = serverBaseUrl && serverBaseUrl.trim() !== '' ? serverBaseUrl.trim() : window.location.origin;
  const captainJoinUrl = `${baseHost.replace(/\/$/, '')}/?pin=${pin}&team=${encodeURIComponent(teamName)}`;
  const captainQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(captainJoinUrl)}`;

  if (!isJoined) {
    return (
      <div style={appBgStyle}>
        <div style={loginCard}>
          {branding.appLogo ? (
            <div style={{ textAlign: 'center', marginBottom: '12px' }}>
              <img
                src={`${MEDIA_BASE_URL}/${branding.appLogo}`}
                alt="Logo"
                style={{ maxHeight: '90px', maxWidth: '85%', objectFit: 'contain' }}
              />
            </div>
          ) : (
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎮</div>
          )}

          <h1 style={{ margin: '0 0 4px 0', fontSize: '1.5rem', color: '#ffc107', fontWeight: '900' }}>
            {branding.appTitle || 'EVENT BUZZER'}
          </h1>
          <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '15px' }}>
            {isTeamMode ? (isTeamFromQr ? '👥 Pievienošanās komandai' : '👑 Komandu spēle: Izveido komandu') : 'Individuālā spēle'}
          </p>

          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              style={mobileInput}
              placeholder="PIN kods"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              maxLength={6}
            />

            <input
              style={mobileInput}
              placeholder="Tavs Vārds"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              autoFocus
            />

            {isTeamMode && (
              isTeamFromQr ? (
                <div style={{ background: '#1c2833', border: '1px solid #00e5ff', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#aaa' }}>Pievienojies komandai:</div>
                  <div style={{ fontSize: '1.2rem', color: '#00ff00', fontWeight: 'bold', marginTop: '2px' }}>
                    {teamName}
                  </div>
                </div>
              ) : (
                <div style={{ background: '#261c02', border: '1px solid #ffc107', padding: '10px', borderRadius: '8px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#ffc107', fontWeight: 'bold', marginBottom: '4px', textAlign: 'left' }}>
                    👑 Ievadi Komandas nosaukumu (Kapteinis):
                  </label>
                  <input
                    style={{ ...mobileInput, borderColor: '#ffc107', color: '#ffc107', fontWeight: 'bold' }}
                    placeholder="Piemēram: Zelta Bulta"
                    value={teamName}
                    onChange={(e) => {
                      setTeamName(e.target.value);
                      setIsCaptain(true);
                    }}
                    maxLength={25}
                  />
                  <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '6px', textAlign: 'left' }}>
                    💡 Biedri pievienosies, noskenējot tavu QR kodu nākamajā solī!
                  </div>
                </div>
              )
            )}

            <button type="submit" style={btnJoin}>
              {isTeamMode && !isTeamFromQr ? 'IZVEIDOT KOMANDU 👑' : 'SĀKT SPĒLI 🚀'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (isDisabledAfk) {
    return (
      <div style={appBgStyle}>
        <div style={infoCard}>
          <div style={{ fontSize: '3rem', marginBottom: '10px' }}>💤</div>
          <h2 style={{ color: '#ff9800', margin: '0 0 10px 0' }}>ESI ATSLĒGTS NEAKTIVITĀTES DĒĻ</h2>
          <p style={{ color: '#ccc', lineHeight: 1.5, margin: '0 0 15px 0' }}>
            Tu ilgstoši neatbildēji uz jautājumiem. Pasaki pasākuma vadītājam, lai tevi pieslēdz atpakaļ!
          </p>
          <button onClick={() => setIsDisabledAfk(false)} style={btnJoin}>
            Pārbaudīt statusu 🔄
          </button>
        </div>
      </div>
    );
  }

  if (!scene) {
    return (
      <div style={{ ...fullScreenMobile, backgroundColor: '#000', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={mobileHeader}>
          <div style={keypadBadge}>📟 #{deviceNumber || 1}</div>
          <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#ffc107' }}>
            {name} {isTeamMode && teamName && `[${teamName}]`}
          </span>
          <button onClick={handleLeaveOrNewGame} style={btnExitSmall}>Iziet</button>
        </div>

        <div style={{ margin: 'auto', textAlign: 'center', padding: '15px', width: '90%', maxWidth: '380px', overflowY: 'auto' }}>
          {isTeamMode && isCaptain && (
            <div style={{ ...infoCard, border: '2px solid #ffc107', marginBottom: '15px', background: '#1c1705' }}>
              <div style={{ fontSize: '0.9rem', color: '#ffc107', fontWeight: 'bold' }}>👑 TAVA KOMANDA: {teamName}</div>
              <p style={{ margin: '6px 0 10px 0', fontSize: '1.1rem', color: '#fff', fontWeight: 'bold' }}>
                Parādi šo QR kodu savam galdiņam!
              </p>
              
              <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
                <img
                  src={captainQrUrl}
                  alt="Captain QR"
                  style={{ width: '160px', height: '160px', borderRadius: '10px', border: '3px solid #ffc107', background: '#fff', padding: '6px' }}
                />
              </div>

              <div style={{ fontSize: '0.85rem', color: '#00ff00', fontWeight: 'bold', marginBottom: '6px' }}>
                👥 Pieslēgušies biedri ({myTeammates.length}):
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center', maxHeight: '80px', overflowY: 'auto' }}>
                {myTeammates.map((m) => (
                  <span key={m.id} style={{ background: '#332700', border: '1px solid #ffc107', padding: '3px 8px', borderRadius: '4px', fontSize: '0.8rem', color: '#fff' }}>
                    {m.name} {m.isCaptain && '👑'}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={infoCard}>
            {branding.appLogo && (
              <img
                src={`${MEDIA_BASE_URL}/${branding.appLogo}`}
                alt="Logo"
                style={{ maxHeight: '80px', maxWidth: '80%', marginBottom: '10px', objectFit: 'contain' }}
              />
            )}
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎯</div>
            <h2 style={{ color: '#00e5ff', margin: '0 0 8px 0', fontSize: '1.3rem' }}>PĀRBAUDI PULTI!</h2>
            {isTeamMode && teamName && (
              <div style={{ color: '#00ff00', fontWeight: 'bold', marginBottom: '8px' }}>
                👥 Komanda: {teamName}
              </div>
            )}
            <p style={{ color: '#ccc', fontSize: '0.85rem', lineHeight: 1.4, marginBottom: '15px' }}>
              Spied pogu, lai pārbaudītu darbību — tava bumbiņa lielajā ekrānā pulsēs!
            </p>

            <button onClick={handleTestBuzzer} style={testBuzzerBtn}>
              🔴 PĀRBAUDĪT PULTI ({buzzerTestPresses > 0 ? `#${buzzerTestPresses} 💥` : 'SPIED ŠEIT 🎯'})
            </button>
          </div>
        </div>

        <div style={darkStatusStrip}>
          <span style={{ color: '#00ff00', fontWeight: 'bold', fontSize: '0.85rem' }}>
            ✅ Esi pieslēdzies! Gaidi vadītāja startu...
          </span>
        </div>
      </div>
    );
  }

  if (isGameOver) {
    return (
      <div style={appBgStyle}>
        <div style={infoCard}>
          <div style={{ fontSize: '3.5rem', marginBottom: '10px' }}>🎉</div>
          <h2 style={{ color: '#ffc107', margin: '0 0 10px 0' }}>SPĒLE IR NOSLĒGUSIES!</h2>

          {isTeamMode && teamName && (
            <div style={{ ...rankBadge, borderColor: '#00e5ff', background: '#0a1d2e', marginBottom: '10px' }}>
              <div style={{ fontSize: '0.85rem', color: '#00e5ff', fontWeight: 'bold' }}>👥 KOMANDAS REZULTĀTS ({teamName}):</div>
              <div style={{ fontSize: '2.4rem', fontWeight: 'bold', color: '#00ff00', margin: '3px 0' }}>
                #{myTeamRank} <span style={{ fontSize: '1.2rem', color: '#888' }}>/ {totalTeamsCount}</span>
              </div>
              <div style={{ fontSize: '1.05rem', color: '#fff' }}>
                Komandas punkti: <strong style={{ color: 'gold' }}>{myTeamData?.score ?? 0} pt</strong>
              </div>
            </div>
          )}

          <div style={rankBadge}>
            <div style={{ fontSize: '0.85rem', color: '#aaa' }}>👤 Tavs individuālais ieguldījums:</div>
            <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: '#ffc107', margin: '3px 0' }}>
              #{myRank} <span style={{ fontSize: '1.2rem', color: '#888' }}>/ {totalPlayersCount}</span>
            </div>
            <div style={{ fontSize: '1.1rem', color: '#fff' }}>
              Individuālie punkti: <strong style={{ color: 'gold' }}>{myScoreData?.score ?? 0} pt</strong>
            </div>
            <div style={{ fontSize: '0.9rem', color: '#00e5ff', marginTop: '4px' }}>
              ⏱️ Atbildes laiks: {formatThinkingTime(myScoreData?.totalTimeMs)}
            </div>
          </div>

          <button onClick={handleLeaveOrNewGame} style={btnJoin}>
            🔄 SĀKT JAUNU SPĒLI
          </button>
        </div>
      </div>
    );
  }

  const slideType = (scene?.type || '').toUpperCase();
  const currentSub = (subState || scene?.subState || 'IDLE').toUpperCase();

  const rawOptions: string[] =
    scene?.config?.options ||
    scene?.options ||
    (scene?.config?.optionsCount
      ? ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, scene.config.optionsCount)
      : []);

  const options = rawOptions.length > 0 ? rawOptions : ['A', 'B', 'C', 'D'];
  const isExactChoicesSelected = selectedMultipleOptions.length === maxRequiredChoices;
  const isFinalLeaderboard = slideType === 'LEADERBOARD' && (scene?.config?.lbType === 'FINAL' || leaderboardType === 'FINAL');

  return (
    <div style={appBgStyle}>
      <div style={mobileHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={keypadBadge}>📟 #{deviceNumber || 1}</div>
          <span style={{ fontWeight: 'bold', fontSize: '0.95rem', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isTeamMode && teamName && <span style={{ fontSize: '0.8rem', color: '#00e5ff' }}>[{teamName}]</span>}
          <div style={{ background: '#000', border: '1px solid #00ff00', borderRadius: '6px', padding: '3px 8px', color: '#00ff00', fontWeight: 'bold', fontSize: '0.85rem' }}>
            PIN: {pin}
          </div>
          <button onClick={handleLeaveOrNewGame} style={btnExitSmall}>Iziet</button>
        </div>
      </div>

      <div style={mobileBody}>
        {currentSub === 'PAUSED' && (
          <div style={{ ...infoCard, borderColor: '#ff9800', marginBottom: '15px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '8px' }}>⏸️</div>
            <h2 style={{ color: '#ff9800', margin: '0 0 8px 0', fontSize: '1.4rem' }}>SPĒLE IR IEPAUZĒTA</h2>
            <p style={{ color: '#ccc', margin: 0, fontSize: '0.95rem' }}>
              Vadītājs ir iepauzējis laika atskaiti. Pultis īslaicīgi nobloķētas!
            </p>
          </div>
        )}

        {slideType === 'BILLBOARD' && currentSub !== 'PAUSED' && (
          <div style={infoCard}>
            <div style={{ fontSize: '3.5rem', marginBottom: '10px' }}>👀</div>
            <h2 style={{ color: '#ffc107', margin: '0 0 10px 0', fontSize: '1.4rem' }}>SEKOJIET EKRĀNAM!</h2>
            <p style={{ color: '#fff', fontSize: '1.05rem', lineHeight: 1.5, margin: 0, fontWeight: 'bold' }}>
              Aicinām sekot līdzi informācijai galvenajā ekrānā!
            </p>
          </div>
        )}

        {slideType === 'LEADERBOARD' && currentSub !== 'PAUSED' && (
          <div style={infoCard}>
            {isFinalLeaderboard && podiumStage < 3 ? (
              <div>
                <div style={{ fontSize: '3.5rem', marginBottom: '10px' }}>🥇</div>
                <h2 style={{ color: '#ffc107', margin: '0 0 12px 0', fontSize: '1.4rem' }}>FINĀLA APBALVOŠANA</h2>
                <p style={{ color: '#00e5ff', fontSize: '1.05rem', fontWeight: 'bold', lineHeight: 1.5, margin: 0 }}>
                  Skaties lielo ekrānu! Tūlīt tiks paziņoti uzvarētāji...
                </p>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '2.5rem', marginBottom: '6px' }}>
                  {isFinalLeaderboard ? '👑' : leaderboardType === 'ROUND' ? '🏆' : '⭐'}
                </div>
                <h2 style={{ color: '#ffc107', margin: '0 0 8px 0', fontSize: '1.3rem' }}>
                  {isFinalLeaderboard
                    ? 'FINĀLA REZULTĀTI'
                    : leaderboardType === 'ROUND'
                    ? 'KĀRTAS REZULTĀTI'
                    : 'KOPVĒRTĒJUMS'}
                </h2>

                {/* 1. Komandas rādītājs */}
                {isTeamMode && teamName && (
                  <div style={{ ...rankBadge, borderColor: '#00e5ff', background: '#0a1d2e', padding: '8px', margin: '6px 0' }}>
                    <div style={{ fontSize: '0.8rem', color: '#00e5ff', fontWeight: 'bold' }}>
                      👥 Komanda: {teamName}
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#00ff00', margin: '2px 0' }}>
                      #{myTeamRank} <span style={{ fontSize: '1rem', color: '#888' }}>/ {totalTeamsCount} komandām</span>
                    </div>
                    <div style={{ fontSize: '0.95rem', color: '#fff' }}>
                      {leaderboardType === 'ROUND' ? 'Kārtas komandas punkti:' : 'Kopējie komandas punkti:'}{' '}
                      <strong style={{ color: 'gold' }}>{myTeamData?.score ?? 0} pt</strong>
                    </div>
                  </div>
                )}

                {/* 2. Individuālais rādītājs */}
                <div style={{ ...rankBadge, padding: '8px', margin: '6px 0' }}>
                  <div style={{ fontSize: '0.8rem', color: '#aaa' }}>
                    👤 Tavs individuālais sniegums:
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#ffc107', margin: '2px 0' }}>
                    #{myRank} <span style={{ fontSize: '1rem', color: '#888' }}>/ {totalPlayersCount} spēlētājiem</span>
                  </div>
                  <div style={{ fontSize: '0.95rem', color: '#fff' }}>
                    {leaderboardType === 'ROUND' ? 'Kārtas punkti:' : 'Kopējie punkti:'}{' '}
                    <strong style={{ color: 'gold' }}>
                      {leaderboardType === 'ROUND' ? (myScoreData?.roundScore ?? 0) : (myScoreData?.score ?? 0)} pt
                    </strong>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#00e5ff', marginTop: '2px' }}>
                    ⏱️ Laiks: {formatThinkingTime(leaderboardType === 'ROUND' ? (myScoreData?.roundTimeMs || 0) : (myScoreData?.totalTimeMs || 0))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {(slideType === 'QUESTION' || slideType === 'QUIZ' || slideType === 'VOTE' || slideType === 'MAJORITY' || slideType === '') && currentSub !== 'PAUSED' && (
          <>
            {currentSub === 'READY' && (
              <div style={infoCard}>
                <div style={{ fontSize: '3.5rem', marginBottom: '10px' }}>⏳</div>
                <h2 style={{ color: '#ffc107', margin: '0 0 12px 0', fontSize: '1.5rem' }}>UZMANĪBU!</h2>
                <p style={{ color: '#fff', fontSize: '1.1rem', lineHeight: 1.5, margin: 0, fontWeight: 'bold' }}>
                  Uzgaidi, tūlīt startēs laiks un parādīsies atbilžu varianti!
                </p>
              </div>
            )}

            {currentSub === 'ACTIVE' && (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box', padding: '5px 0' }}>
                <div style={textHeaderBadge}>
                  {myChoice
                    ? '✅ ATBILDE NOSŪTĪTA'
                    : isMultiSelectMode
                    ? `☑️ ATZĪMĒ TIEŠI ${maxRequiredChoices} VARIANTUS:`
                    : 'SPIED ATBILDI:'}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: options.length > 4 ? '1fr 1fr' : '1fr',
                    gap: '8px',
                    width: '100%',
                    flex: 1,
                    maxHeight: options.length > 4 ? '48vh' : '42vh',
                    alignContent: 'center'
                  }}
                >
                  {options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const itemKey = opt || letter;

                    const isSelectedMulti = selectedMultipleOptions.includes(itemKey) || selectedMultipleOptions.includes(opt) || selectedMultipleOptions.includes(letter);
                    const isChosenSingle = myChoice === opt || myChoice === letter;
                    const isChosen = isMultiSelectMode ? isSelectedMulti : isChosenSingle;

                    return (
                      <button
                        key={i}
                        disabled={!!myChoice}
                        onClick={() => {
                          if (isMultiSelectMode) {
                            toggleMultiSelectOption(itemKey);
                          } else {
                            handleSingleVoteSubmit(opt, letter);
                          }
                        }}
                        style={{
                          ...buzzerBtnCompact,
                          minHeight: options.length > 4 ? '44px' : '50px',
                          maxHeight: options.length > 4 ? '56px' : '62px',
                          background: isChosen ? '#28a745' : BUTTON_COLORS[i % BUTTON_COLORS.length],
                          border: isChosen ? '3px solid #fff' : 'none',
                          opacity: myChoice && !isChosen ? 0.35 : 1,
                          boxShadow: isChosen ? '0 0 20px #28a745' : '0 4px 10px rgba(0,0,0,0.6)'
                        }}
                      >
                        <span style={{ fontSize: '1.6rem', fontWeight: '900', marginRight: opt && opt.trim() !== '' ? '8px' : '0' }}>
                          {isMultiSelectMode ? (isChosen ? '☑️ ' : '⬜ ') : ''}{letter}
                        </span>
                        {opt && opt.trim() !== '' && (
                          <span style={{ fontSize: '1rem', fontWeight: 'bold', flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {opt}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {isMultiSelectMode && !myChoice && (
                  <button
                    onClick={handleMultiVoteSubmit}
                    disabled={!isExactChoicesSelected}
                    style={{
                      ...btnSubmitMulti,
                      opacity: isExactChoicesSelected ? 1 : 0.4,
                      cursor: isExactChoicesSelected ? 'pointer' : 'not-allowed',
                      background: isExactChoicesSelected ? 'linear-gradient(135deg, #28a745, #20c997)' : '#333'
                    }}
                  >
                    {isExactChoicesSelected
                      ? `🚀 IESNIEGT ATBILDES (${selectedMultipleOptions.length}/${maxRequiredChoices})`
                      : `Izvēlies vēl ${maxRequiredChoices - selectedMultipleOptions.length} (${selectedMultipleOptions.length}/${maxRequiredChoices})`}
                  </button>
                )}

                {myChoice && (
                  <div style={voteConfirmedBadge}>
                    ✅ Atbilde ({myChoice}) pieņemta!
                  </div>
                )}
              </div>
            )}

            {(currentSub === 'STATS' || currentSub === 'SUMMARY' || currentSub === 'REVEAL') && (
              <div style={infoCard}>
                <div style={{ fontSize: '3rem', marginBottom: '10px' }}>
                  {currentSub === 'SUMMARY' ? '⏳' : '📊'}
                </div>
                <h2 style={{ color: currentSub === 'SUMMARY' ? '#ffc107' : '#28a745', margin: '0 0 10px 0' }}>
                  {currentSub === 'SUMMARY' ? 'APKOPO REZULTĀTUS...' : 'BALSOŠANA NOSLĒGUSIES!'}
                </h2>
                <p style={{ color: '#ccc', fontSize: '1rem', margin: 0 }}>
                  {currentSub === 'REVEAL'
                    ? 'Pareizā atbilde atklāta lielajā ekrānā!'
                    : currentSub === 'SUMMARY'
                    ? 'Skaties rezultātu apkopojumu lielajā ekrānā!'
                    : 'Gaidiet rezultātu apkopojumu...'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// STILI
const fullScreenMobile: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100vw',
  height: '100dvh',
  maxHeight: '100dvh',
  color: '#fff',
  fontFamily: 'Segoe UI, Arial, sans-serif',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 999999,
  overflow: 'hidden',
  overscrollBehavior: 'none',
  touchAction: 'manipulation',
  boxSizing: 'border-box'
};

const mobileHeader: React.CSSProperties = {
  height: '50px',
  background: 'rgba(18, 18, 18, 0.92)',
  backdropFilter: 'blur(10px)',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 12px',
  flexShrink: 0
};

const keypadBadge: React.CSSProperties = {
  background: '#ffc107',
  color: '#000',
  fontWeight: 'bold',
  padding: '3px 8px',
  borderRadius: '6px',
  fontSize: '0.85rem'
};

const btnExitSmall: React.CSSProperties = {
  background: 'rgba(50, 50, 50, 0.8)',
  border: '1px solid #555',
  color: '#ccc',
  padding: '3px 8px',
  borderRadius: '4px',
  fontSize: '0.75rem',
  cursor: 'pointer'
};

const mobileBody: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 15px',
  overflowY: 'hidden',
  boxSizing: 'border-box'
};

const loginCard: React.CSSProperties = {
  margin: 'auto',
  background: 'rgba(20, 20, 20, 0.92)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: '16px',
  padding: '20px 18px',
  width: '85%',
  maxWidth: '360px',
  textAlign: 'center',
  boxShadow: '0 10px 35px rgba(0,0,0,0.9)',
  backdropFilter: 'blur(12px)'
};

const mobileInput: React.CSSProperties = {
  padding: '10px',
  borderRadius: '8px',
  background: 'rgba(0, 0, 0, 0.8)',
  border: '1px solid #555',
  color: '#fff',
  fontSize: '1rem',
  textAlign: 'center',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box'
};

const btnJoin: React.CSSProperties = {
  padding: '12px',
  borderRadius: '8px',
  background: '#28a745',
  color: '#fff',
  border: 'none',
  fontSize: '1rem',
  fontWeight: 'bold',
  cursor: 'pointer'
};

const infoCard: React.CSSProperties = {
  textAlign: 'center',
  background: 'rgba(20, 20, 20, 0.9)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: '16px',
  padding: '20px 15px',
  width: '90%',
  maxWidth: '360px',
  boxShadow: '0 10px 30px rgba(0,0,0,0.9)',
  backdropFilter: 'blur(12px)'
};

const rankBadge: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.75)',
  border: '2px solid #ffc107',
  borderRadius: '10px',
  padding: '12px',
  margin: '12px 0'
};

const textHeaderBadge: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.85)',
  padding: '6px 14px',
  borderRadius: '8px',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  textAlign: 'center',
  color: '#ffc107',
  fontWeight: 'bold',
  fontSize: '0.95rem',
  margin: '0 auto 4px auto'
};

const voteConfirmedBadge: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.85)',
  padding: '6px 14px',
  borderRadius: '8px',
  border: '1px solid #28a745',
  textAlign: 'center',
  color: '#00ff00',
  fontWeight: 'bold',
  fontSize: '0.95rem',
  marginTop: '5px'
};

const btnSubmitMulti: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  borderRadius: '10px',
  color: '#fff',
  border: '2px solid #fff',
  fontSize: '1.05rem',
  fontWeight: 'bold',
  marginTop: '8px'
};

const darkStatusStrip: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.9)',
  padding: '12px',
  textAlign: 'center',
  borderTop: '1px solid rgba(255, 255, 255, 0.1)'
};

const buzzerBtnCompact: React.CSSProperties = {
  width: '100%',
  borderRadius: '10px',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 15px',
  cursor: 'pointer',
  boxSizing: 'border-box',
  userSelect: 'none'
};

const testBuzzerBtn: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  borderRadius: '12px',
  background: 'linear-gradient(135deg, #e63946, #d90429)',
  color: '#fff',
  border: '2px solid #fff',
  fontSize: '1rem',
  fontWeight: 'bold',
  cursor: 'pointer'
};