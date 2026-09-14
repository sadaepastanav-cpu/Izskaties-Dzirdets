import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { BACKEND_URL } from './config';

const MEDIA_BASE_URL = `${BACKEND_URL}/project-media`;
const BUTTON_COLORS = ['#007bff', '#fd7e14', '#28a745', '#ffc107', '#6f42c1', '#17a2b8'];

export default function Player() {
  const [pin, setPin] = useState(localStorage.getItem('player_pin') || '');
  const [name, setName] = useState(localStorage.getItem('player_name') || '');
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
  const [scene, setScene] = useState<any>(null);
  const [subState, setSubState] = useState<string>('IDLE');

  // Atbilžu izvēles stāvokļi
  const [myChoice, setMyChoice] = useState<string | null>(null);
  const [selectedMultipleOptions, setSelectedMultipleOptions] = useState<string[]>([]);

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [leaderboardType, setLeaderboardType] = useState<string>('TOTAL');
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
            lobbyMode: 'CIRCLE'
          };
    } catch {
      return {
        appTitle: 'EVENT BUZZER',
        appLogo: '',
        appBgImage: '',
        welcomeImage: '',
        appBgColor: '#121212',
        lobbyMode: 'CIRCLE'
      };
    }
  });

  // Screen Wake Lock API — novērš telefona ekrāna iemigšanu
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

  // Automātiski nolasa PIN no URL parametriem
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlPin = params.get('pin');
    if (urlPin) {
      setPin(urlPin.trim());
      localStorage.setItem('player_pin', urlPin.trim());
    }
  }, []);

  // SOCKET.IO SAVIENOJUMS AR RECONNECT NOTURĪBU
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
      const savedPin = localStorage.getItem('player_pin');
      const savedName = localStorage.getItem('player_name');
      const wasJoined = sessionStorage.getItem('player_active_session') === 'true';

      if (wasJoined && savedPin && savedName) {
        s.emit('join-session', { pin: savedPin.trim(), name: savedName.trim(), playerId });
      }
    };

    s.on('connect', () => {
      tryAutoJoin();
    });

    s.on('join-success', (data: any) => {
      setIsJoined(true);
      setIsGameOver(false);
      sessionStorage.setItem('player_active_session', 'true');
      if (data?.deviceNumber) setDeviceNumber(data.deviceNumber);
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

    s.on('state-update', (newScene: any) => {
      setScene(newScene);
      const newSub = (newScene?.subState || 'READY').toUpperCase();
      setSubState(newSub);
      setMyChoice(null);
      setSelectedMultipleOptions([]);
    });

    s.on('leaderboard-update', (payload: any) => {
      if (Array.isArray(payload)) {
        setLeaderboard(payload);
        setLeaderboardType('TOTAL');
      } else {
        setLeaderboard(payload?.data || []);
        setLeaderboardType((payload?.lbType || 'TOTAL').toUpperCase());
      }
    });

    s.on('game-over', () => setIsGameOver(true));
    s.on('error-message', (msg: string) => alert(msg));

    return () => {
      s.disconnect();
    };
  }, [playerId]);

  useEffect(() => {
    if (socket && pin && pin.trim().length >= 4) {
      socket.emit('get-branding', { pin: pin.trim() });
    }
  }, [pin, socket]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return alert('Lūdzu ievadiet PIN kodu!');
    if (!name.trim()) return alert('Lūdzu ievadiet savu vārdu!');

    localStorage.setItem('player_pin', pin.trim());
    localStorage.setItem('player_name', name.trim());
    if (socket) {
      socket.emit('join-session', { pin: pin.trim(), name: name.trim(), playerId });
    }
  };

  const isMultiSelectMode =
    scene?.config?.selectionMode === 'ALL' && (scene?.config?.correctAnswers?.length || 0) > 1;

  const handleSingleVoteSubmit = (option: string, letter: string) => {
    if (myChoice || !socket) return;
    try {
      if ('vibrate' in navigator) navigator.vibrate(80);
    } catch {}
    setMyChoice(option || letter);

    const answers = [option, letter].filter(Boolean);
    socket.emit('participant:submit-answer', { pin, answer: option || letter, answers, playerId });
  };

  const toggleMultiSelectOption = (item: string) => {
    if (myChoice) return;
    try {
      if ('vibrate' in navigator) navigator.vibrate(40);
    } catch {}

    setSelectedMultipleOptions((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  const handleMultiVoteSubmit = () => {
    if (myChoice || !socket || selectedMultipleOptions.length === 0) return;
    try {
      if ('vibrate' in navigator) navigator.vibrate(100);
    } catch {}

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
    try {
      if ('vibrate' in navigator) navigator.vibrate(60);
    } catch {}
    setBuzzerTestPresses((prev) => prev + 1);
    socket.emit('participant:test-buzzer', { pin, playerId });
  };

  const handleLeaveOrNewGame = () => {
    sessionStorage.removeItem('player_active_session');
    localStorage.removeItem('player_pin');
    setIsJoined(false);
    setIsGameOver(false);
    setScene(null);
    setMyChoice(null);
    setSelectedMultipleOptions([]);
    setDeviceNumber(null);
    setBuzzerTestPresses(0);
    setPin('');
  };

  const myRankIndex = leaderboard.findIndex((p) => p.id === playerId || p.name === name);
  const myRank = myRankIndex !== -1 ? myRankIndex + 1 : '-';
  const myScoreData = myRankIndex !== -1 ? leaderboard[myRankIndex] : null;

  const appBgStyle: React.CSSProperties = {
    ...fullScreenMobile,
    backgroundColor: branding.appBgColor || '#121212',
    backgroundImage: branding.appBgImage ? `url(${MEDIA_BASE_URL}/${branding.appBgImage})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  };

  // 1. IELOGOŠANĀS SKATS
  if (!isJoined) {
    return (
      <div style={appBgStyle}>
        <div style={loginCard}>
          {branding.appLogo ? (
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <img
                src={`${MEDIA_BASE_URL}/${branding.appLogo}`}
                alt="Logo"
                style={{ maxHeight: '120px', maxWidth: '90%', objectFit: 'contain', filter: 'drop-shadow(0 4px 15px rgba(0,0,0,0.8))' }}
              />
            </div>
          ) : (
            <div style={{ fontSize: '3.5rem', marginBottom: '10px' }}>🎮</div>
          )}

          <h1 style={{ margin: '0 0 5px 0', fontSize: '1.8rem', color: '#ffc107', fontWeight: '900' }}>
            {branding.appTitle || 'EVENT BUZZER'}
          </h1>
          <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '20px' }}>
            Ievadiet spēles PIN un savu vārdu
          </p>

          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
            />
            <button type="submit" style={btnJoin}>
              SĀKT 🚀
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. SĀKUMA REĢISTRĀCIJAS LOBIJS (RĀDA TIKAI TAD, KAD ŠOVS VĒL NAV SĀKTS — scene === null)
  if (!scene) {
    const isInteractiveLobby = branding.lobbyMode === 'INTERACTIVE_DOTS';

    return (
      <div
        style={{
          ...fullScreenMobile,
          backgroundColor: '#000',
          backgroundImage: branding.welcomeImage ? `url(${MEDIA_BASE_URL}/${branding.welcomeImage})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}
      >
        <div style={mobileHeader}>
          <div style={keypadBadge}>📟 Pults #{deviceNumber || 1}</div>
          <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#ffc107' }}>{name}</span>
          <button onClick={handleLeaveOrNewGame} style={btnExitSmall}>Iziet</button>
        </div>

        <div style={{ margin: 'auto', textAlign: 'center', padding: '20px', width: '90%', maxWidth: '360px' }}>
          {isInteractiveLobby ? (
            <div style={infoCard}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎯</div>
              <h2 style={{ color: '#00e5ff', margin: '0 0 10px 0', fontSize: '1.4rem' }}>PĀRBAUDI PULTI!</h2>
              <p style={{ color: '#ccc', fontSize: '0.95rem', lineHeight: 1.4, marginBottom: '20px' }}>
                Nospiediet pogu, lai pārbaudītu pults darbību. Tava bumbiņa lielajā ekrānā pulsēs un mainīs krāsas!
              </p>

              <button onClick={handleTestBuzzer} style={testBuzzerBtn}>
                🔴 PĀRBAUDĪT PULTI ({buzzerTestPresses > 0 ? `Spiediens #${buzzerTestPresses} 💥` : 'SPIED ŠEIT 🎯'})
              </button>
            </div>
          ) : (
            !branding.welcomeImage && (
              <div style={infoCard}>
                {branding.appLogo && (
                  <img
                    src={`${MEDIA_BASE_URL}/${branding.appLogo}`}
                    alt="Logo"
                    style={{ maxHeight: '110px', maxWidth: '85%', marginBottom: '15px', objectFit: 'contain' }}
                  />
                )}
                <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🎧</div>
                <h2 style={{ color: '#ffc107', margin: '0 0 10px 0' }}>GAIDĀM ŠOVA SĀKUMU!</h2>
                <p style={{ color: '#ccc', lineHeight: 1.5, margin: 0 }}>
                  Sekojiet līdzi lielajam ekrānam. Tiklīdz vadītājs palaidīs pirmo jautājumu, šeit parādīsies atbilžu pogas!
                </p>
              </div>
            )
          )}
        </div>

        <div style={darkStatusStrip}>
          <span style={{ color: '#00ff00', fontWeight: 'bold' }}>
            ✅ Esi veiksmīgi pieslēdzies! Gaidi vadītāja startu...
          </span>
        </div>
      </div>
    );
  }

  // 3. SPĒLES BEIGAS
  if (isGameOver) {
    return (
      <div style={appBgStyle}>
        <div style={infoCard}>
          {branding.appLogo && (
            <img
              src={`${MEDIA_BASE_URL}/${branding.appLogo}`}
              alt="Logo"
              style={{ maxHeight: '90px', maxWidth: '85%', marginBottom: '15px', objectFit: 'contain' }}
            />
          )}
          <div style={{ fontSize: '3.5rem', marginBottom: '10px' }}>🎉</div>
          <h2 style={{ color: '#ffc107', margin: '0 0 10px 0' }}>SPĒLE IR NOSLĒGUSIES!</h2>
          <div style={rankBadge}>
            <div style={{ fontSize: '0.9rem', color: '#aaa' }}>Tavs gala rezultāts:</div>
            <div style={{ fontSize: '3.2rem', fontWeight: 'bold', color: '#00ff00', margin: '5px 0' }}>
              #{myRank}
            </div>
            <div style={{ fontSize: '1.2rem', color: '#fff' }}>
              Punkti: <strong style={{ color: 'gold' }}>{myScoreData?.score ?? 0} pt</strong>
            </div>
            <div style={{ fontSize: '0.95rem', color: '#00e5ff', marginTop: '6px' }}>
              ⏱️ Kopējais laiks: {(myScoreData?.totalTimeMs ? (myScoreData.totalTimeMs / 1000).toFixed(2) : '0.00')}s
            </div>
          </div>
          <button onClick={handleLeaveOrNewGame} style={btnJoin}>
            🔄 SĀKT JAUNU SPĒLI / CITU PIN
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

  // 4. SPĒLES EKRĀNS
  return (
    <div style={appBgStyle}>
      <div style={mobileHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={keypadBadge}>📟 Pults #{deviceNumber || 1}</div>
          <span style={{ fontWeight: 'bold', fontSize: '0.95rem', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ background: '#000', border: '1px solid #00ff00', borderRadius: '6px', padding: '3px 8px', color: '#00ff00', fontWeight: 'bold', fontSize: '0.85rem' }}>
            PIN: {pin}
          </div>
          <button onClick={handleLeaveOrNewGame} style={btnExitSmall}>Iziet</button>
        </div>
      </div>

      <div style={mobileBody}>
        {/* A) BILLBOARD EKRĀNS */}
        {slideType === 'BILLBOARD' && (
          <div style={infoCard}>
            {branding.appLogo && (
              <img
                src={`${MEDIA_BASE_URL}/${branding.appLogo}`}
                alt="Logo"
                style={{ maxHeight: '80px', maxWidth: '80%', marginBottom: '10px', objectFit: 'contain' }}
              />
            )}
            <div style={{ fontSize: '3.5rem', marginBottom: '10px' }}>👀</div>
            <h2 style={{ color: '#ffc107', margin: '0 0 10px 0', fontSize: '1.4rem' }}>SEKOJIET EKRĀNAM!</h2>
            <p style={{ color: '#fff', fontSize: '1.05rem', lineHeight: 1.5, margin: 0, fontWeight: 'bold' }}>
              Aicinām sekot līdzi informācijai galvenajā ekrānā!
            </p>
          </div>
        )}

        {/* B) LĪDERU TABULA */}
        {slideType === 'LEADERBOARD' && (
          <div style={infoCard}>
            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🏆</div>
            <h2 style={{ color: '#ffc107', margin: '0 0 10px 0', fontSize: '1.4rem' }}>
              {leaderboardType === 'ROUND' ? 'KĀRTAS REZULTĀTI' : 'KOPVĒRTĒJUMS'}
            </h2>

            <div style={rankBadge}>
              <div style={{ fontSize: '0.85rem', color: '#aaa' }}>Tava vieta:</div>
              <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#00ff00', margin: '4px 0' }}>
                #{myRank}
              </div>
              <div style={{ fontSize: '1.1rem', color: '#fff' }}>
                Punkti:{' '}
                <strong style={{ color: 'gold', fontSize: '1.3rem' }}>
                  {leaderboardType === 'ROUND' ? (myScoreData?.roundScore ?? 0) : (myScoreData?.score ?? 0)} pt
                </strong>
              </div>
              <div style={{ fontSize: '0.9rem', color: '#00e5ff', marginTop: '4px' }}>
                ⏱️ Atbildes laiks: {(leaderboardType === 'ROUND' ? myScoreData?.roundTimeMs : myScoreData?.totalTimeMs) ? (((leaderboardType === 'ROUND' ? myScoreData?.roundTimeMs : myScoreData?.totalTimeMs) / 1000).toFixed(2)) : '0.00'}s
              </div>
            </div>
            <p style={{ color: '#888', fontSize: '0.8rem', margin: 0 }}>Skatieties lielo ekrānu, lai redzētu visus uzvarētājus!</p>
          </div>
        )}

        {/* C) JAUTĀJUMU EKRĀNS */}
        {(slideType === 'QUESTION' || slideType === 'QUIZ' || slideType === 'VOTE' || slideType === 'MAJORITY' || slideType === '') && (
          <>
            {/* 1. FĀZE: READY (Vadītājs nupat atvēris jautājumu, laiks vēl neiet) */}
            {currentSub === 'READY' && (
              <div style={infoCard}>
                <div style={{ fontSize: '3.5rem', marginBottom: '10px' }}>⏳</div>
                <h2 style={{ color: '#ffc107', margin: '0 0 12px 0', fontSize: '1.5rem' }}>UZMANĪBU!</h2>
                <p style={{ color: '#fff', fontSize: '1.1rem', lineHeight: 1.5, margin: 0, fontWeight: 'bold' }}>
                  Uzgaidi, tūlīt startēs laiks un parādīsies atbilžu varianti!
                </p>
                <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '12px' }}>
                  Seko līdzi jautājumam uz lielā ekrāna.
                </p>
              </div>
            )}

            {/* 2. FĀZE: ACTIVE (Rit laiks un spēlētājs var atbildēt) */}
            {currentSub === 'ACTIVE' && (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box', padding: '5px 0' }}>
                {branding.appLogo ? (
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', maxHeight: '14vh', minHeight: '50px', marginBottom: '4px' }}>
                    <img
                      src={`${MEDIA_BASE_URL}/${branding.appLogo}`}
                      alt="Logo"
                      style={{
                        maxHeight: '12vh',
                        maxWidth: '85vw',
                        height: 'auto',
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 4px 15px rgba(0,0,0,0.9))'
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ height: '6px' }} />
                )}

                <div style={textHeaderBadge}>
                  {myChoice
                    ? '✅ ATBILDE NOSŪTĪTA'
                    : isMultiSelectMode
                    ? '☑️ ATZĪMĒ VISAS PAREIZĀS ATBILDES:'
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
                    disabled={selectedMultipleOptions.length === 0}
                    style={{
                      ...btnSubmitMulti,
                      opacity: selectedMultipleOptions.length === 0 ? 0.4 : 1,
                      cursor: selectedMultipleOptions.length === 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    🚀 IESNIEGT ATBILDES ({selectedMultipleOptions.length})
                  </button>
                )}

                {myChoice && (
                  <div style={voteConfirmedBadge}>
                    ✅ Atbilde ({myChoice}) pieņemta!
                  </div>
                )}
              </div>
            )}

            {/* 3. FĀZE: STATS vai REVEAL (Balsošana noslēgusies) */}
            {(currentSub === 'STATS' || currentSub === 'REVEAL') && (
              <div style={infoCard}>
                <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📊</div>
                <h2 style={{ color: '#28a745', margin: '0 0 10px 0' }}>BALSOŠANA NOSLĒGUSIES!</h2>
                <p style={{ color: '#ccc', fontSize: '1rem', margin: 0 }}>
                  {currentSub === 'REVEAL' ? 'Pareizā atbilde atklāta lielajā ekrānā!' : 'Skaties rezultātus lielajā ekrānā!'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// --- STILI ---
const fullScreenMobile: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100vw',
  height: '100vh',
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
  fontSize: '0.85rem',
  boxShadow: '0 0 8px rgba(255, 193, 7, 0.5)'
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
  padding: '25px 20px',
  width: '85%',
  maxWidth: '360px',
  textAlign: 'center',
  boxShadow: '0 10px 35px rgba(0,0,0,0.9)',
  backdropFilter: 'blur(12px)'
};

const mobileInput: React.CSSProperties = {
  padding: '12px',
  borderRadius: '8px',
  background: 'rgba(0, 0, 0, 0.8)',
  border: '1px solid #555',
  color: '#fff',
  fontSize: '1.1rem',
  textAlign: 'center',
  outline: 'none'
};

const btnJoin: React.CSSProperties = {
  padding: '14px',
  borderRadius: '8px',
  background: '#28a745',
  color: '#fff',
  border: 'none',
  fontSize: '1.05rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(40,167,69,0.4)'
};

const infoCard: React.CSSProperties = {
  textAlign: 'center',
  background: 'rgba(20, 20, 20, 0.9)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: '16px',
  padding: '25px 15px',
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
  backdropFilter: 'blur(8px)',
  padding: '6px 14px',
  borderRadius: '8px',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  textAlign: 'center',
  color: '#ffc107',
  fontWeight: 'bold',
  fontSize: '0.95rem',
  margin: '0 auto 4px auto',
  display: 'inline-block'
};

const voteConfirmedBadge: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.85)',
  backdropFilter: 'blur(8px)',
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
  background: 'linear-gradient(135deg, #28a745, #20c997)',
  color: '#fff',
  border: '2px solid #fff',
  fontSize: '1.05rem',
  fontWeight: 'bold',
  boxShadow: '0 0 15px rgba(40, 167, 69, 0.6)',
  marginTop: '8px'
};

const darkStatusStrip: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.9)',
  padding: '14px',
  textAlign: 'center',
  backdropFilter: 'blur(8px)',
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
  transition: 'transform 0.1s ease',
  boxSizing: 'border-box',
  userSelect: 'none',
  WebkitTapHighlightColor: 'transparent'
};

const testBuzzerBtn: React.CSSProperties = {
  width: '100%',
  padding: '16px',
  borderRadius: '12px',
  background: 'linear-gradient(135deg, #e63946, #d90429)',
  color: '#fff',
  border: '2px solid #fff',
  fontSize: '1.1rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  boxShadow: '0 0 25px rgba(217, 4, 41, 0.6)',
  transition: 'transform 0.1s ease'
};