import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const BUTTON_COLORS = ['#007bff', '#fd7e14', '#28a745', '#ffc107', '#6f42c1', '#17a2b8'];

export default function Player() {
  const [pin, setPin] = useState(localStorage.getItem('player_pin') || '');
  const [name, setName] = useState(localStorage.getItem('player_name') || '');
  const [playerId] = useState(() => {
    let saved = localStorage.getItem('player_id');
    if (!saved) {
      saved = 'p_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('player_id', saved);
    }
    return saved;
  });

  const [socket, setSocket] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentScene, setCurrentScene] = useState<any>(null);
  const [subState, setSubState] = useState<string>('IDLE');
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [leaderboardType, setLeaderboardType] = useState<string>('TOTAL');

  // Savienojums ar serveri izmantojot pareizo datora IP adresi
  useEffect(() => {
    const s = io(`http://${window.location.hostname}:3000`);
    setSocket(s);

    s.on('join-success', (data: any) => {
      setIsConnected(true);
      setCurrentScene(data.currentScene);
      setSubState((data.subState || data.currentScene?.subState || 'IDLE').toUpperCase());
    });

    s.on('state-update', (newScene: any) => {
      setCurrentScene(newScene);
      setSubState((newScene.subState || 'READY').toUpperCase());
      setSelectedAnswer(null); // Jauns jautājums -> atiestata atbildi
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

    s.on('error-message', (msg: string) => alert(msg));

    return () => {
      s.disconnect();
    };
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim() || !name.trim()) return alert('Lūdzu ievadiet PIN un Vārdu!');

    localStorage.setItem('player_pin', pin.trim());
    localStorage.setItem('player_name', name.trim());

    if (socket) {
      socket.emit('join-session', { pin: pin.trim(), name: name.trim(), playerId });
    }
  };

  const sendAnswer = (opt: string) => {
    if (subState !== 'ACTIVE' || selectedAnswer || !socket) return;
    try {
      if ('vibrate' in navigator) navigator.vibrate(80);
    } catch {}
    setSelectedAnswer(opt);
    socket.emit('participant:submit-answer', { pin, playerId, answers: [opt], answer: opt });
  };

  // Mans rangs un punkti
  const myRankIndex = leaderboard.findIndex((p) => p.id === playerId || p.name === name);
  const myRank = myRankIndex !== -1 ? myRankIndex + 1 : '-';
  const myScoreData = myRankIndex !== -1 ? leaderboard[myRankIndex] : null;

  // 1. PIESLĒGŠANĀS SKATS
  if (!isConnected) {
    return (
      <div style={fullScreenMobile}>
        <div style={loginCard}>
          <div style={{ fontSize: '3.5rem', marginBottom: '10px' }}>🎮</div>
          <h1 style={{ margin: '0 0 5px 0', fontSize: '2rem', color: '#ffc107', fontWeight: '900' }}>EVENT BUZZER</h1>
          <p style={{ color: '#aaa', fontSize: '0.95rem', marginBottom: '25px' }}>Ievadiet spēles PIN un savu vārdu</p>

          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
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
              PIEVIENOTIES 🚀
            </button>
          </form>
        </div>
      </div>
    );
  }

  const slideType = (currentScene?.type || '').toUpperCase();
  const rawOptions: string[] = currentScene?.config?.options || currentScene?.options || [];
  const options = rawOptions.length > 0 ? rawOptions : ['A', 'B', 'C', 'D'];

  return (
    <div style={fullScreenMobile}>
      {/* Galvene ar vārdu un PIN */}
      <div style={mobileHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.2rem' }}>👤</span>
          <span style={{ fontWeight: 'bold', fontSize: '1.1rem', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
        </div>
        <div style={{ background: '#000', border: '1px solid #00ff00', borderRadius: '6px', padding: '4px 10px', color: '#00ff00', fontWeight: 'bold' }}>
          PIN: {pin}
        </div>
      </div>

      <div style={mobileBody}>
        {/* BILLBOARD SKATS */}
        {slideType === 'BILLBOARD' && (
          <div style={infoCard}>
            <div style={{ fontSize: '4rem', marginBottom: '15px' }}>👀</div>
            <h2 style={{ color: '#ffc107', margin: '0 0 10px 0', fontSize: '1.6rem' }}>SEKOJIET EKRĀNAM!</h2>
            <p style={{ color: '#ccc', fontSize: '1.05rem', lineHeight: 1.5, margin: 0 }}>
              Sekojiet tekstam un video lielajā ekrānā. Drīz sāksies nākamais jautājums!
            </p>
          </div>
        )}

        {/* LĪDERU TABULAS SKATS AR MANIEM REZULTĀTIEM */}
        {slideType === 'LEADERBOARD' && (
          <div style={infoCard}>
            <div style={{ fontSize: '3.5rem', marginBottom: '10px' }}>🏆</div>
            <h2 style={{ color: '#ffc107', margin: '0 0 15px 0', fontSize: '1.6rem' }}>
              {leaderboardType === 'ROUND' ? 'KĀRTAS REZULTĀTI' : 'KOPVĒRTĒJUMS'}
            </h2>

            <div style={rankBadge}>
              <div style={{ fontSize: '0.9rem', color: '#aaa' }}>Tava vieta šovā:</div>
              <div style={{ fontSize: '3.5rem', fontWeight: 'bold', color: '#00ff00', margin: '5px 0' }}>
                #{myRank}
              </div>
              <div style={{ fontSize: '1.2rem', color: '#fff' }}>
                Punkti:{' '}
                <strong style={{ color: 'gold', fontSize: '1.5rem' }}>
                  {leaderboardType === 'ROUND' ? (myScoreData?.roundScore ?? 0) : (myScoreData?.score ?? 0)} pt
                </strong>
              </div>
            </div>
            <p style={{ color: '#888', fontSize: '0.85rem', margin: 0 }}>Skatieties lielo ekrānu, lai redzētu visus uzvarētājus!</p>
          </div>
        )}

        {/* JAUTĀJUMA UN BALSOŠANAS POGAS */}
        {(slideType === 'QUESTION' || slideType === 'MAJORITY' || slideType === '') && (
          <>
            {subState === 'READY' && (
              <div style={infoCard}>
                <div style={{ fontSize: '3.5rem', marginBottom: '10px' }}>⏳</div>
                <h2 style={{ color: '#ffc107', margin: '0 0 10px 0' }}>UZMANĪBU!</h2>
                <p style={{ color: '#ccc', fontSize: '1.1rem', margin: 0 }}>Gatavojieties! Tūlīt parādīsies atbilžu varianti...</p>
              </div>
            )}

            {subState === 'ACTIVE' && (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ textAlign: 'center', color: '#aaa', fontWeight: 'bold', fontSize: '1rem' }}>
                  {selectedAnswer ? 'ATBILDE NOSŪTĪTA' : 'SPIED ATBILDI:'}
                </div>

                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: options.length > 4 ? '1fr 1fr' : '1fr', gap: '12px' }}>
                  {options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const isChosen = selectedAnswer === opt;

                    return (
                      <button
                        key={i}
                        disabled={!!selectedAnswer}
                        onClick={() => sendAnswer(opt)}
                        style={{
                          ...buzzerBtn,
                          background: isChosen ? '#28a745' : BUTTON_COLORS[i % BUTTON_COLORS.length],
                          border: isChosen ? '4px solid #fff' : 'none',
                          opacity: selectedAnswer && !isChosen ? 0.35 : 1,
                          boxShadow: isChosen ? '0 0 20px #28a745' : '0 6px 15px rgba(0,0,0,0.6)'
                        }}
                      >
                        <span style={{ fontSize: '2.5rem', fontWeight: '900', marginRight: opt && opt.trim() !== '' ? '12px' : '0' }}>
                          {letter}
                        </span>
                        {opt && opt.trim() !== '' && (
                          <span style={{ fontSize: '1.2rem', fontWeight: 'bold', flex: 1, textAlign: 'left', wordBreak: 'break-word' }}>
                            {opt}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedAnswer && (
                  <div style={{ textAlign: 'center', color: '#00ff00', fontWeight: 'bold', fontSize: '1.1rem', padding: '8px' }}>
                    ✅ Atbilde {selectedAnswer} pieņemta! Gaidām rezultātus...
                  </div>
                )}
              </div>
            )}

            {(subState === 'STATS' || subState === 'REVEAL') && (
              <div style={infoCard}>
                <div style={{ fontSize: '3.5rem', marginBottom: '10px' }}>📊</div>
                <h2 style={{ color: '#28a745', margin: '0 0 10px 0' }}>BALSOŠANA NOSLĒGUSIES!</h2>
                <p style={{ color: '#ccc', fontSize: '1.1rem', margin: 0 }}>
                  {subState === 'REVEAL' ? 'Pareizā atbilde atklāta lielajā ekrānā!' : 'Skaties rezultātus lielajā ekrānā!'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// --- PILNEKRĀNA MOBILIE STILI (IZOLĒTI NO CITU FAILU CSS) ---
const fullScreenMobile: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100vw',
  height: '100vh',
  background: '#121212',
  color: '#fff',
  fontFamily: 'Segoe UI, Arial, sans-serif',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 999999,
  overflow: 'hidden',
  boxSizing: 'border-box'
};

const mobileHeader: React.CSSProperties = {
  height: '55px',
  background: '#1a1a1a',
  borderBottom: '2px solid #333',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 15px',
  flexShrink: 0
};

const mobileBody: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '15px',
  overflowY: 'auto',
  boxSizing: 'border-box'
};

const loginCard: React.CSSProperties = {
  margin: 'auto',
  background: '#1c1c1c',
  border: '1px solid #333',
  borderRadius: '16px',
  padding: '30px 20px',
  width: '85%',
  maxWidth: '380px',
  textAlign: 'center',
  boxShadow: '0 10px 30px rgba(0,0,0,0.9)'
};

const mobileInput: React.CSSProperties = {
  padding: '14px',
  borderRadius: '8px',
  background: '#000',
  border: '1px solid #555',
  color: '#fff',
  fontSize: '1.2rem',
  textAlign: 'center',
  outline: 'none'
};

const btnJoin: React.CSSProperties = {
  padding: '15px',
  borderRadius: '8px',
  background: '#28a745',
  color: '#fff',
  border: 'none',
  fontSize: '1.1rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  marginTop: '5px'
};

const infoCard: React.CSSProperties = {
  textAlign: 'center',
  background: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: '16px',
  padding: '30px 20px',
  width: '90%',
  maxWidth: '380px',
  boxShadow: '0 8px 25px rgba(0,0,0,0.8)'
};

const rankBadge: React.CSSProperties = {
  background: '#111',
  border: '2px solid #ffc107',
  borderRadius: '12px',
  padding: '15px',
  margin: '15px 0'
};

const buzzerBtn: React.CSSProperties = {
  width: '100%',
  height: '100%',
  minHeight: '80px',
  borderRadius: '14px',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 20px',
  cursor: 'pointer',
  transition: 'transform 0.1s ease',
  boxSizing: 'border-box',
  userSelect: 'none',
  WebkitTapHighlightColor: 'transparent'
};