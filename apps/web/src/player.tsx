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

  const [showCaptainQrModal, setShowCaptainQrModal] = useState(false);

  const [myChoice, setMyChoice] = useState<string | null>(null);
  const [stagedChoice, setStagedChoice] = useState<string | null>(null);
  const [selectedMultipleOptions, setSelectedMultipleOptions] = useState<string[]>([]);

  // 🔢 SECĪBAS KĀRTOŠANAS SARAKSTS (ORDERING)
  const [orderedItems, setOrderedItems] = useState<string[]>([]);
  // ⚡ ĀTRĀS PULTS REĀLLAIKA STATUSS (BUZZER RACE)
  const [buzzerPressedOrder, setBuzzerPressedOrder] = useState<number | null>(null);
  const [isMyBuzzerTurn, setIsMyBuzzerTurn] = useState<boolean>(false);

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
      if (data?.currentScene) {
        setScene(data.currentScene);
        if (data.currentScene.type === 'ORDERING') {
          const initialOpts = [...(data.currentScene.config?.options || [])];
          setOrderedItems(initialOpts);
        }
      }
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
      setStagedChoice(null);
      setSelectedMultipleOptions([]);
      setBuzzerPressedOrder(null);
      setIsMyBuzzerTurn(false);
      setPodiumStage(0);

      if (newScene?.type === 'ORDERING') {
        const raw = [...(newScene.config?.options || [])];
        setOrderedItems(raw);
      }
    });

    s.on('buzzer-race-press', (data: { winner: any; allWinners: any[] }) => {
      if (data?.winner?.playerId === playerId) {
        setBuzzerPressedOrder(data.winner.position);
        setIsMyBuzzerTurn(true);
      } else {
        setIsMyBuzzerTurn(false);
      }
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
      setStagedChoice(null);
      setSelectedMultipleOptions([]);
      setDeviceNumber(null);
      setBuzzerTestPresses(0);
      setOrderedItems([]);
      setBuzzerPressedOrder(null);
      setIsMyBuzzerTurn(false);
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

  const rawOptions: string[] = scene?.config?.options || ['A', 'B', 'C', 'D'];
  const requiredCount = scene?.config?.requiredCount ?? (scene?.config?.correctAnswers?.length || 1);
  const isMultiSelectMode = scene?.config?.selectionMode === 'ALL' && requiredCount > 1;
  const maxRequiredChoices = requiredCount > 0 ? requiredCount : 1;
  const submitMode = scene?.config?.submitMode || 'INSTANT';

  // ⚡ Vienas atbildes apstrāde
  const handleSingleVoteClick = (option: string, letter: string) => {
    if (myChoice || !socket || subState === 'PAUSED' || isDisabledAfk) return;

    if (submitMode === 'CONFIRM') {
      try { if ('vibrate' in navigator) navigator.vibrate(40); } catch {}
      setStagedChoice(option || letter);
    } else {
      try { if ('vibrate' in navigator) navigator.vibrate(80); } catch {}
      setMyChoice(option || letter);
      socket.emit('participant:submit-answer', { pin, answer: option || letter, answers: [option || letter], playerId });
    }
  };

  const handleConfirmSingleVote = () => {
    if (!stagedChoice || myChoice || !socket || subState === 'PAUSED' || isDisabledAfk) return;
    try { if ('vibrate' in navigator) navigator.vibrate(80); } catch {}
    setMyChoice(stagedChoice);
    socket.emit('participant:submit-answer', { pin, answer: stagedChoice, answers: [stagedChoice], playerId });
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

  // ⚡ ĀTRĀS PULTS (BUZZER RACE) POGA AR IESILDĪŠANOS UN REĀLO KLIKŠĶI
  const handleBuzzerPress = () => {
    if (subState === 'READY') {
      // Iesildīšanās pirms laika starta
      try { if ('vibrate' in navigator) navigator.vibrate(40); } catch {}
      return;
    }
    if (subState === 'ACTIVE' && !buzzerPressedOrder) {
      try { if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]); } catch {}
      setBuzzerPressedOrder(1);
      socket?.emit('participant:submit-answer', {
        pin,
        answer: 'BUZZ',
        answers: ['BUZZ'],
        playerId
      });
    }
  };

  // 🔢 Secības kārtošana
  const moveOrderingItem = (index: number, direction: 'UP' | 'DOWN') => {
    if (myChoice || subState !== 'ACTIVE' || isDisabledAfk) return;
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= orderedItems.length) return;

    try { if ('vibrate' in navigator) navigator.vibrate(40); } catch {}
    const updated = [...orderedItems];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setOrderedItems(updated);
  };

  const handleOrderingSubmit = () => {
    if (myChoice || !socket || subState !== 'ACTIVE' || isDisabledAfk) return;
    try { if ('vibrate' in navigator) navigator.vibrate(100); } catch {}

    const orderStr = orderedItems.join(' ➔ ');
    setMyChoice(orderStr);
    socket.emit('participant:submit-answer', {
      pin,
      answer: orderStr,
      answers: orderedItems,
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
    setStagedChoice(null);
    setSelectedMultipleOptions([]);
    setDeviceNumber(null);
    setBuzzerTestPresses(0);
    setOrderedItems([]);
    setBuzzerPressedOrder(null);
    setIsMyBuzzerTurn(false);
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

  const isExactChoicesSelected = selectedMultipleOptions.length === maxRequiredChoices;
  const isFinalLeaderboard = scene?.type === 'LEADERBOARD' && (scene?.config?.lbType === 'FINAL' || leaderboardType === 'FINAL');
  const isBuzzerRace = scene?.type === 'BUZZER_RACE';
  const isOrdering = scene?.type === 'ORDERING';

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

  return (
    <div style={appBgStyle}>
      <div style={mobileHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={keypadBadge}>📟 #{deviceNumber || 1}</div>
          <span style={{ fontWeight: 'bold', fontSize: '0.9rem', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
          {isTeamMode && teamName && <span style={{ fontSize: '0.75rem', color: '#00e5ff' }}>[{teamName}]</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isTeamMode && isCaptain && (
            <button
              onClick={() => setShowCaptainQrModal(true)}
              style={btnCaptainBadge}
              title="Parādīt komandas QR kodu jaunam biedram"
            >
              👑 + Biedrs (QR)
            </button>
          )}

          <div style={{ background: '#000', border: '1px solid #00ff00', borderRadius: '6px', padding: '3px 6px', color: '#00ff00', fontWeight: 'bold', fontSize: '0.8rem' }}>
            PIN: {pin}
          </div>
          <button onClick={handleLeaveOrNewGame} style={btnExitSmall}>Iziet</button>
        </div>
      </div>

      {showCaptainQrModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100dvh',
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(12px)',
            zIndex: 999999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            boxSizing: 'border-box'
          }}
          onClick={() => setShowCaptainQrModal(false)}
        >
          <div
            style={{
              background: '#1c1705',
              border: '2px solid #ffc107',
              borderRadius: '16px',
              padding: '20px',
              maxWidth: '340px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 10px 40px rgba(0,0,0,0.95)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '1rem', color: '#ffc107', fontWeight: 'bold', marginBottom: '4px' }}>
              👑 TAVA KOMANDA: {teamName}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#ccc', marginBottom: '10px' }}>
              Parādi šo QR kodu, lai pievienotu spēlētāju savam galdiņam!
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
              <img
                src={captainQrUrl}
                alt="Captain QR"
                style={{ width: '160px', height: '160px', borderRadius: '12px', background: '#fff', padding: '6px', border: '3px solid #ffc107' }}
              />
            </div>

            <div style={{ fontSize: '0.9rem', color: '#00ff00', fontWeight: 'bold', marginBottom: '8px' }}>
              👥 Pieslēgušies biedri: {myTeammates.length}
            </div>

            <button
              onClick={() => setShowCaptainQrModal(false)}
              style={{
                width: '100%',
                padding: '10px',
                background: '#ffc107',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '0.95rem',
                cursor: 'pointer'
              }}
            >
              Turpināt spēli [✕]
            </button>
          </div>
        </div>
      )}

      <div style={mobileBody}>
        {/* PAUZE */}
        {subState === 'PAUSED' && (
          <div style={{ ...infoCard, borderColor: '#ff9800', marginBottom: '15px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '8px' }}>⏸️</div>
            <h2 style={{ color: '#ff9800', margin: '0 0 8px 0', fontSize: '1.4rem' }}>SPĒLE IR IEPAUZĒTA</h2>
            <p style={{ color: '#ccc', margin: 0, fontSize: '0.95rem' }}>
              Vadītājs ir iepauzējis laika atskaiti. Pultis īslaicīgi nobloķētas!
            </p>
          </div>
        )}

        {/* 🌟 BILLBOARD SLAIDS (SAGLABĀTS!) */}
        {scene?.type === 'BILLBOARD' && subState !== 'PAUSED' && (
          <div style={infoCard}>
            <div style={{ fontSize: '3.5rem', marginBottom: '10px' }}>👀</div>
            <h2 style={{ color: '#ffc107', margin: '0 0 10px 0', fontSize: '1.4rem' }}>SEKOJIET EKRĀNAM!</h2>
            <p style={{ color: '#fff', fontSize: '1.05rem', lineHeight: 1.5, margin: 0, fontWeight: 'bold' }}>
              Aicinām sekot līdzi informācijai galvenajā ekrānā!
            </p>
          </div>
        )}

        {/* 🌟 LĪDERU TABULAS & REZULTĀTI (SAGLABĀTS!) */}
        {scene?.type === 'LEADERBOARD' && subState !== 'PAUSED' && (
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
                  {leaderboardType === 'FINAL' ? '👑' : leaderboardType === 'ROUND' ? '🏆' : '⭐'}
                </div>
                <h2 style={{ color: '#ffc107', margin: '0 0 8px 0', fontSize: '1.3rem' }}>
                  {leaderboardType === 'FINAL'
                    ? 'FINĀLA REZULTĀTI'
                    : leaderboardType === 'ROUND'
                    ? 'KĀRTAS REZULTĀTI'
                    : 'KOPVĒRTĒJUMS'}
                </h2>

                {/* Komandas rādītājs */}
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

                {/* Individuālais rādītājs */}
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

        {/* ⚡ 2. FĀZE: ĀTRĀ PULTS (BUZZER RACE) AR IESILDĪŠANOS & ATBILDĒM */}
        {isBuzzerRace && subState !== 'PAUSED' && (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {/* Ja spēlētājs ir #1 un vadītājs iestatījis variantus -> atveras varianti! */}
            {isMyBuzzerTurn && scene?.config?.buzzerRaceType === 'WITH_OPTIONS' ? (
              <div style={{ width: '100%', textAlign: 'center' }}>
                <div style={textHeaderBadge}>🎉 TAVA KĀRTA! IZVĒLIES ATBILDI:</div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rawOptions.length}, 1fr)`, gap: '6px', width: '100%', margin: '20px 0' }}>
                  {rawOptions.map((opt, i) => (
                    <button
                      key={i}
                      disabled={!!myChoice}
                      onClick={() => handleSingleVoteClick(opt, String.fromCharCode(65 + i))}
                      style={{
                        ...buzzerBtnHorizontal,
                        background: myChoice === opt ? '#28a745' : BUTTON_COLORS[i % BUTTON_COLORS.length]
                      }}
                    >
                      <span style={{ fontSize: '1.8rem', fontWeight: '900' }}>{String.fromCharCode(65 + i)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Milzīgā Ātrās Pults poga ar iesildīšanos pie READY */
              <div style={{ textAlign: 'center', width: '100%' }}>
                <div style={textHeaderBadge}>
                  {subState === 'READY'
                    ? '🔥 IESILDĪŠANĀS (GATAVOJIES!)'
                    : buzzerPressedOrder
                    ? `🎉 NOPIKSTINĀTS #${buzzerPressedOrder}!`
                    : '🚨 SPIED POGU ĀTRĀK PAR CITIEM!'}
                </div>

                <button
                  onClick={handleBuzzerPress}
                  style={{
                    width: '250px',
                    height: '250px',
                    borderRadius: '50%',
                    background: buzzerPressedOrder
                      ? '#28a745'
                      : subState === 'READY'
                      ? 'radial-gradient(circle at 35% 35%, #ff7700, #cc5500, #882200)'
                      : 'radial-gradient(circle at 35% 35%, #ff4d4d, #cc0000, #800000)',
                    border: '8px solid #ffffff',
                    boxShadow: buzzerPressedOrder ? '0 0 50px #28a745' : '0 0 60px rgba(255, 0, 0, 0.8), inset 0 0 30px rgba(255,255,255,0.4)',
                    color: '#fff',
                    fontSize: '2.2rem',
                    fontWeight: '900',
                    cursor: 'pointer',
                    margin: '25px auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.1s ease',
                    transform: 'scale(1)'
                  }}
                  onMouseDown={(e) => ((e.currentTarget as HTMLElement).style.transform = 'scale(0.92)')}
                  onMouseUp={(e) => ((e.currentTarget as HTMLElement).style.transform = 'scale(1)')}
                  onTouchStart={(e) => ((e.currentTarget as HTMLElement).style.transform = 'scale(0.92)')}
                  onTouchEnd={(e) => ((e.currentTarget as HTMLElement).style.transform = 'scale(1)')}
                >
                  {buzzerPressedOrder ? '✅ GATAVS!' : subState === 'READY' ? '🔥 TESTĒ' : '⚡ SPIED!'}
                </button>

                <div style={{ color: subState === 'READY' ? '#ffc107' : '#00ff00', fontWeight: 'bold', fontSize: '1rem' }}>
                  {subState === 'READY' ? 'Pārbaudi klikšķi! Gaidi, kad vadītājs startēs laiku...' : buzzerPressedOrder ? 'Atbilde pieņemta! Skaties lielo ekrānu!' : 'Tiklīdz rit laiks, spied pirmais!'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 🔢 2. FĀZE: SECĪBAS KĀRTOŠANA (ORDERING) */}
        {isOrdering && subState !== 'PAUSED' && (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '10px 0' }}>
            {subState === 'READY' && (
              <div style={infoCard}>
                <div style={{ fontSize: '3.5rem', marginBottom: '10px' }}>🔢</div>
                <h2 style={{ color: '#ffc107', margin: '0 0 10px 0' }}>SECĪBAS KĀRTOŠANA</h2>
                <p style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 'bold' }}>Tūlīt parādīsies varianti, ko vajadzēs sakārtot pareizā secībā!</p>
              </div>
            )}

            {subState === 'ACTIVE' && (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                <div style={textHeaderBadge}>
                  {myChoice ? '✅ SECĪBA IESNIEGTA' : '🔢 SAKĀRTO NO AUGŠAS UZ LEJU:'}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '10px 0', flex: 1, overflowY: 'auto' }}>
                  {orderedItems.map((item, idx) => (
                    <div key={`order-${idx}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1c2833', border: '2px solid #00e5ff', borderRadius: '10px', padding: '12px 14px', color: '#fff', fontWeight: 'bold' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: '#00e5ff', fontSize: '1.2rem', fontWeight: '900' }}>#{idx + 1}</span>
                        <span>{item}</span>
                      </div>
                      {!myChoice && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => moveOrderingItem(idx, 'UP')} disabled={idx === 0} style={{ ...btnMoveOrder, opacity: idx === 0 ? 0.3 : 1 }}>🔼</button>
                          <button onClick={() => moveOrderingItem(idx, 'DOWN')} disabled={idx === orderedItems.length - 1} style={{ ...btnMoveOrder, opacity: idx === orderedItems.length - 1 ? 0.3 : 1 }}>🔽</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {!myChoice && (
                  <button onClick={handleOrderingSubmit} style={{ ...btnJoin, width: '100%', padding: '14px', fontSize: '1.1rem' }}>
                    🚀 IESNIEGT SECĪBU
                  </button>
                )}

                {myChoice && (
                  <div style={voteConfirmedBadge}>
                    ✅ Mana secība: {myChoice}
                  </div>
                )}
              </div>
            )}

            {(subState === 'STATS' || subState === 'SUMMARY' || subState === 'REVEAL') && (
              <div style={infoCard}>
                <div style={{ fontSize: '3rem', marginBottom: '10px' }}>{subState === 'REVEAL' ? '🎉' : '⏳'}</div>
                <h2 style={{ color: subState === 'REVEAL' ? '#28a745' : '#ffc107', margin: 0 }}>
                  {subState === 'REVEAL' ? 'PAREIZĀ SECĪBA ATKLĀTA!' : 'BALSOŠANA NOSLĒGUSIES!'}
                </h2>
                <p style={{ color: '#ccc', marginTop: '8px' }}>Skaties pareizo atrisinājumu lielajā ekrānā!</p>
              </div>
            )}
          </div>
        )}

        {/* 🅰️ PARASTIE JAUTĀJUMI: 1 RINDAS HORIZONTĀLĀS POGAS (2 līdz 6 varianti) */}
        {!isBuzzerRace && !isOrdering && scene?.type !== 'LEADERBOARD' && scene?.type !== 'BILLBOARD' && subState !== 'PAUSED' && (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
            {subState === 'READY' && (
              <div style={infoCard}>
                <div style={{ fontSize: '3.5rem', marginBottom: '10px' }}>⏳</div>
                <h2 style={{ color: '#ffc107', margin: '0 0 12px 0', fontSize: '1.5rem' }}>UZMANĪBU!</h2>
                <p style={{ color: '#fff', fontSize: '1.1rem', lineHeight: 1.5, margin: 0, fontWeight: 'bold' }}>
                  Uzgaidi, tūlīt startēs laiks un parādīsies atbilžu varianti!
                </p>
              </div>
            )}

            {subState === 'ACTIVE' && (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={textHeaderBadge}>
                  {myChoice ? '✅ ATBILDE NOSŪTĪTA' : isMultiSelectMode ? `☑️ ATZĪMĒ ${maxRequiredChoices} VARIANTUS:` : submitMode === 'CONFIRM' ? 'IZVĒLIES UN APSTIPRINI:' : 'SPIED ATBILDI:'}
                </div>

                {/* 🌟 1 RINDAS HORIZONTĀLAIS REŽĢIS */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${rawOptions.length}, 1fr)`,
                    gap: '8px',
                    width: '100%',
                    flex: 1,
                    alignContent: 'center',
                    maxHeight: '45vh'
                  }}
                >
                  {rawOptions.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const itemKey = opt || letter;
                    const isSelectedMulti = selectedMultipleOptions.includes(itemKey) || selectedMultipleOptions.includes(opt) || selectedMultipleOptions.includes(letter);
                    const isChosenSingle = myChoice === opt || myChoice === letter;
                    const isStaged = stagedChoice === opt || stagedChoice === letter;
                    const isChosen = isMultiSelectMode ? isSelectedMulti : (myChoice ? isChosenSingle : isStaged);

                    return (
                      <button
                        key={i}
                        disabled={!!myChoice}
                        onClick={() => {
                          if (isMultiSelectMode) toggleMultiSelectOption(itemKey);
                          else handleSingleVoteClick(opt, letter);
                        }}
                        style={{
                          ...buzzerBtnHorizontal,
                          background: isChosen ? '#28a745' : BUTTON_COLORS[i % BUTTON_COLORS.length],
                          border: isChosen ? '4px solid #fff' : 'none',
                          opacity: myChoice && !isChosen ? 0.35 : 1,
                          boxShadow: isChosen ? '0 0 25px #28a745' : '0 4px 12px rgba(0,0,0,0.6)'
                        }}
                      >
                        <span style={{ fontSize: rawOptions.length > 4 ? '1.8rem' : '2.4rem', fontWeight: '900' }}>
                          {letter}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* CONFIRM POGA */}
                {!isMultiSelectMode && !myChoice && submitMode === 'CONFIRM' && (
                  <button onClick={handleConfirmSingleVote} disabled={!stagedChoice} style={{ ...btnSubmitMulti, opacity: stagedChoice ? 1 : 0.4, background: stagedChoice ? 'linear-gradient(135deg, #28a745, #20c997)' : '#333' }}>
                    {stagedChoice ? `🚀 APSTIPRINĀT ATBILDI (${stagedChoice})` : 'Izvēlies burtu...'}
                  </button>
                )}

                {/* MULTI SUBMIT POGA */}
                {isMultiSelectMode && !myChoice && (
                  <button onClick={handleMultiVoteSubmit} disabled={!isExactChoicesSelected} style={{ ...btnSubmitMulti, opacity: isExactChoicesSelected ? 1 : 0.4, background: isExactChoicesSelected ? 'linear-gradient(135deg, #28a745, #20c997)' : '#333' }}>
                    {isExactChoicesSelected ? `🚀 IESNIEGT (${selectedMultipleOptions.length}/${maxRequiredChoices})` : `Izvēlies ${maxRequiredChoices - selectedMultipleOptions.length} vēl`}
                  </button>
                )}

                {myChoice && (
                  <div style={voteConfirmedBadge}>✅ Atbilde ({myChoice}) pieņemta!</div>
                )}
              </div>
            )}

            {(subState === 'STATS' || subState === 'SUMMARY' || subState === 'REVEAL') && (
              <div style={infoCard}>
                <div style={{ fontSize: '3rem', marginBottom: '10px' }}>
                  {subState === 'SUMMARY' ? '⏳' : subState === 'REVEAL' ? '🎉' : '📊'}
                </div>
                <h2 style={{ color: subState === 'SUMMARY' ? '#ffc107' : '#28a745', margin: '0 0 10px 0' }}>
                  {subState === 'SUMMARY'
                    ? 'APKOPO REZULTĀTUS...'
                    : subState === 'REVEAL'
                    ? 'PAREIZĀ ATBILDE ATKLĀTA!'
                    : 'BALSOŠANA NOSLĒGUSIES!'}
                </h2>
                <p style={{ color: '#ccc', fontSize: '1rem', margin: 0 }}>
                  {subState === 'REVEAL'
                    ? 'Skaties rezultātus un punktus lielajā ekrānā!'
                    : subState === 'SUMMARY'
                    ? 'Skaties atbilžu kopsavilkumu lielajā ekrānā!'
                    : 'Gaidiet rezultātu atklāšanu...'}
                </p>
              </div>
            )}
          </div>
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
  color: '#fff',
  fontFamily: 'Segoe UI, Arial, sans-serif',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 999999,
  overflow: 'hidden',
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

const btnCaptainBadge: React.CSSProperties = {
  background: 'linear-gradient(135deg, #ffc107, #ff9800)',
  color: '#000',
  border: '1px solid #fff',
  padding: '3px 8px',
  borderRadius: '6px',
  fontSize: '0.75rem',
  fontWeight: 'bold',
  cursor: 'pointer'
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
  boxShadow: '0 10px 35px rgba(0,0,0,0.9)'
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
  boxShadow: '0 10px 30px rgba(0,0,0,0.9)'
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

const btnMoveOrder: React.CSSProperties = {
  background: '#333',
  border: '1px solid #666',
  color: '#fff',
  padding: '6px 12px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '1rem'
};

const buzzerBtnHorizontal: React.CSSProperties = {
  width: '100%',
  height: '110px',
  borderRadius: '14px',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxSizing: 'border-box',
  userSelect: 'none'
};