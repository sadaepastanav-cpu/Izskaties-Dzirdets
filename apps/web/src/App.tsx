import { BrowserRouter, Routes, Route } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { socket } from './socket';
import Host from './Host';
import Presentation from './Presentation';
import Timer from './Timer';
import Studio from './Studio';

const MEDIA_BASE_URL = `http://${window.location.hostname}:3000/project-media`;
const BUTTON_COLORS = ['#007bff', '#fd7e14', '#28a745', '#ffc107', '#6f42c1', '#17a2b8'];

function Player() {
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

  const [deviceNumber, setDeviceNumber] = useState<number | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [scene, setScene] = useState<any>(null);
  const [subState, setSubState] = useState<string>('IDLE');
  const [hasStartedFirstQuestion, setHasStartedFirstQuestion] = useState(false);
  const [myChoice, setMyChoice] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [leaderboardType, setLeaderboardType] = useState<string>('TOTAL');

  // Mobilais brendings
  const [branding, setBranding] = useState<any>(() => {
    try {
      const cached = localStorage.getItem('cached_branding');
      return cached ? JSON.parse(cached) : {
        appTitle: 'EVENT BUZZER',
        appLogo: '',
        appBgImage: '',
        welcomeImage: '',
        appBgColor: '#121212'
      };
    } catch {
      return {
        appTitle: 'EVENT BUZZER',
        appLogo: '',
        appBgImage: '',
        welcomeImage: '',
        appBgColor: '#121212'
      };
    }
  });

  // 1. PUNKTS: Tiklīdz ievada PIN (vai ja tas jau ir saglabāts), nolasām šova dizainu
  useEffect(() => {
    if (pin && pin.trim().length >= 4) {
      socket.emit('get-branding', { pin: pin.trim() });
    }
  }, [pin]);

  useEffect(() => {
    const wasAlreadyJoined = sessionStorage.getItem('player_active_session') === 'true';
    const savedPin = localStorage.getItem('player_pin');
    const savedName = localStorage.getItem('player_name');

    if (wasAlreadyJoined && savedPin && savedName && !isJoined) {
      socket.emit('join-session', { pin: savedPin.trim(), name: savedName.trim(), playerId });
    }

    const onJoinSuccess = (data: any) => {
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
      if (currentSub === 'ACTIVE') setHasStartedFirstQuestion(true);
      localStorage.setItem('player_pin', pin.trim());
      localStorage.setItem('player_name', name.trim());
    };

    const onSessionBranding = (br: any) => {
      if (br && Object.keys(br).length > 0) {
        setBranding((prev: any) => {
          const updated = { ...prev, ...br };
          localStorage.setItem('cached_branding', JSON.stringify(updated));
          return updated;
        });
      }
    };

    const onStateUpdate = (newScene: any) => {
      setScene(newScene);
      const newSub = (newScene?.subState || 'READY').toUpperCase();
      setSubState(newSub);
      if (newSub === 'ACTIVE') setHasStartedFirstQuestion(true);
      setMyChoice(null);
    };

    const onLeaderboardUpdate = (payload: any) => {
      if (Array.isArray(payload)) {
        setLeaderboard(payload);
        setLeaderboardType('TOTAL');
      } else {
        setLeaderboard(payload?.data || []);
        setLeaderboardType((payload?.lbType || 'TOTAL').toUpperCase());
      }
    };

    const onGameOver = () => setIsGameOver(true);

    socket.on('join-success', onJoinSuccess);
    socket.on('session-branding', onSessionBranding);
    socket.on('state-update', onStateUpdate);
    socket.on('leaderboard-update', onLeaderboardUpdate);
    socket.on('game-over', onGameOver);
    socket.on('error-message', (msg: string) => alert(msg));

    return () => {
      socket.off('join-success', onJoinSuccess);
      socket.off('session-branding', onSessionBranding);
      socket.off('state-update', onStateUpdate);
      socket.off('leaderboard-update', onLeaderboardUpdate);
      socket.off('game-over', onGameOver);
      socket.off('error-message');
    };
  }, [playerId]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return alert('Lūdzu ievadi PIN kodu!');
    if (!name.trim()) return alert('Lūdzu ievadi savu vārdu!');

    localStorage.setItem('player_pin', pin.trim());
    localStorage.setItem('player_name', name.trim());
    socket.emit('join-session', { pin: pin.trim(), name: name.trim(), playerId });
  };

  const handleVoteSubmit = (option: string, letter: string) => {
    if (myChoice) return;
    try {
      if ('vibrate' in navigator) navigator.vibrate(80);
    } catch {}
    setMyChoice(option || letter);

    const answers = [option, letter].filter(Boolean);
    socket.emit('participant:submit-answer', { pin, answer: option || letter, answers, playerId });
  };

  const handleLeaveOrNewGame = () => {
    sessionStorage.removeItem('player_active_session');
    localStorage.removeItem('player_pin');
    setIsJoined(false);
    setIsGameOver(false);
    setHasStartedFirstQuestion(false);
    setMyChoice(null);
    setDeviceNumber(null);
    setPin('');
  };

  const myRankIndex = leaderboard.findIndex((p) => p.id === playerId || p.name === name);
  const myRank = myRankIndex !== -1 ? myRankIndex + 1 : '-';
  const myScoreData = myRankIndex !== -1 ? leaderboard[myRankIndex] : null;

  // Universāls fons ar fona bildi un krāsu
  const appBgStyle: React.CSSProperties = {
    ...fullScreenMobile,
    backgroundColor: branding.appBgColor || '#121212',
    backgroundImage: branding.appBgImage ? `url(${MEDIA_BASE_URL}/${branding.appBgImage})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  };

  // 1. PUNKTS: PATS PIRMAIS IELOGOŠANĀS EKRĀNS ARĪ PILNAJĀ DIZAINĀ
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

  // SĀKUMA GAIDĪŠANAS / REKLĀMAS EKRĀNS (Rādās līdz pirmajam vadītāja Space)
  const isWaitingForFirstQuestion = !hasStartedFirstQuestion && (!scene || subState === 'IDLE' || subState === 'READY');

  if (isWaitingForFirstQuestion) {
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

        {!branding.welcomeImage ? (
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
        ) : (
          <div />
        )}

        <div style={darkStatusStrip}>
          <span style={{ color: '#00ff00', fontWeight: 'bold' }}>
            ✅ Esi veiksmīgi pieslēdzies! Gaidi vadītāja startu...
          </span>
        </div>
      </div>
    );
  }

  // SPĒLES BEIGAS (GAME OVER)
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

  // SPĒLES EKRĀNS AR LIELO LOGO VIRS POGĀM
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
            <p style={{ color: '#ccc', fontSize: '1rem', lineHeight: 1.4, margin: 0 }}>
              Sekojiet tekstam un video lielajā ekrānā. Drīz sāksies nākamais jautājums!
            </p>
          </div>
        )}

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
            </div>
            <p style={{ color: '#888', fontSize: '0.8rem', margin: 0 }}>Skatieties lielo ekrānu, lai redzētu visus uzvarētājus!</p>
          </div>
        )}

        {(slideType === 'QUESTION' || slideType === 'QUIZ' || slideType === 'VOTE' || slideType === 'MAJORITY' || slideType === '') && (
          <>
            {currentSub === 'READY' && (
              <div style={infoCard}>
                <div style={{ fontSize: '3rem', marginBottom: '10px' }}>⏳</div>
                <h2 style={{ color: '#ffc107', margin: '0 0 10px 0' }}>UZMANĪBU!</h2>
                <p style={{ color: '#ccc', fontSize: '1rem', margin: 0 }}>Gatavojieties! Tūlīt parādīsies atbilžu varianti...</p>
              </div>
            )}

            {currentSub === 'ACTIVE' && (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box', padding: '5px 0' }}>
                
                {/* 2. PUNKTS: KRIETNI LIELĀKS LOGO VIRS VARIANTIEM (DROŠS IZVĒRSUMS 14VH / LĪDZ 115PX) */}
                {branding.appLogo ? (
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', maxHeight: '16vh', minHeight: '60px', marginBottom: '4px' }}>
                    <img
                      src={`${MEDIA_BASE_URL}/${branding.appLogo}`}
                      alt="Logo"
                      style={{
                        maxHeight: '14vh',
                        maxWidth: '85vw',
                        height: 'auto',
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 4px 15px rgba(0,0,0,0.9))'
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ height: '10px' }} />
                )}

                {/* Virsraksts virs variantiem */}
                <div style={textHeaderBadge}>
                  {myChoice ? '✅ ATBILDE NOSŪTĪTA' : 'SPIED ATBILDI:'}
                </div>

                {/* Atbilžu pogu režģis */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: options.length > 4 ? '1fr 1fr' : '1fr',
                    gap: '8px',
                    width: '100%',
                    flex: 1,
                    maxHeight: options.length > 4 ? '50vh' : '45vh',
                    alignContent: 'center'
                  }}
                >
                  {options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const isChosen = myChoice === opt || myChoice === letter;

                    return (
                      <button
                        key={i}
                        disabled={!!myChoice}
                        onClick={() => handleVoteSubmit(opt, letter)}
                        style={{
                          ...buzzerBtnCompact,
                          minHeight: options.length > 4 ? '44px' : '52px',
                          maxHeight: options.length > 4 ? '56px' : '65px',
                          background: isChosen ? '#28a745' : BUTTON_COLORS[i % BUTTON_COLORS.length],
                          border: isChosen ? '3px solid #fff' : 'none',
                          opacity: myChoice && !isChosen ? 0.35 : 1,
                          boxShadow: isChosen ? '0 0 20px #28a745' : '0 4px 10px rgba(0,0,0,0.6)'
                        }}
                      >
                        <span style={{ fontSize: '1.8rem', fontWeight: '900', marginRight: opt && opt.trim() !== '' ? '8px' : '0' }}>
                          {letter}
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

                {myChoice && (
                  <div style={voteConfirmedBadge}>
                    ✅ Atbilde {myChoice} pieņemta!
                  </div>
                )}
              </div>
            )}

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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Player />} />
        <Route path="/player" element={<Player />} />
        <Route path="/host" element={<Host />} />
        <Route path="/studio" element={<Studio />} />
        <Route path="/present/:pin" element={<Presentation />} />
      </Routes>
    </BrowserRouter>
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