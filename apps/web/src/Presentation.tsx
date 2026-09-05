import { useState, useEffect, useRef } from 'react';
import { socket } from './socket';
import { useParams } from 'react-router-dom';
import Timer from './Timer';

// Servera dinamiskā Bāzes URL noteikšana
const MEDIA_BASE_URL = `http://${window.location.hostname}:3000/project-media`;

export default function Presentation() {
  const { pin } = useParams<{ pin: string }>();
  const [scene, setScene] = useState<any>(null);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [participantCount, setParticipantCount] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isStatsVisible, setIsStatsVisible] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isMediaReady, setIsMediaReady] = useState(false);

  // Atsauces tiešai audio un video kontrolei
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (pin) {
      socket.emit('join-session', { pin, name: 'EKRĀNS', playerId: 'scr_' + pin });
    }

    const handleStateUpdate = (newScene: any) => {
      setScene(newScene);
      setIsRevealed(false);
      setIsStatsVisible(false);
      setVoteCounts({});
    };

    socket.on('state-update', handleStateUpdate);
    socket.on('votes-updated', (summary) => setVoteCounts(summary || {}));
    socket.on('presence-update', (data) => setParticipantCount(data?.count || 0));
    socket.on('results-revealed', () => setIsRevealed(true));
    socket.on('stats-revealed', () => setIsStatsVisible(true));
    socket.on('leaderboard-update', (data) => setLeaderboard(data || []));

    // Video un Audio tālvadības komandas no vadības pults
    socket.on('video-command', (cmd: string) => {
      if (cmd === 'play') {
        videoRef.current?.play().catch(() => {});
        audioRef.current?.play().catch(() => {});
      } else if (cmd === 'pause') {
        videoRef.current?.pause();
        audioRef.current?.pause();
      }
    });

    return () => {
      socket.off('state-update', handleStateUpdate);
      socket.off('votes-updated');
      socket.off('presence-update');
      socket.off('results-revealed');
      socket.off('stats-revealed');
      socket.off('leaderboard-update');
      socket.off('video-command');
    };
  }, [pin]);

  // Autonomā Audio/Video atskaņošana, kad slaida stāvoklis kļūst ACTIVE
  useEffect(() => {
    if (scene?.subState === 'ACTIVE') {
      videoRef.current?.play().catch(() => {});
      audioRef.current?.play().catch(() => {});
    }
  }, [scene?.subState, scene?.id]);

  // 1. SĀKUMA ATĻAUJAS EKRĀNS (Pārlūka media auto-play atbloķēšanai)
  if (!isMediaReady) {
    return (
      <div style={fullScreenCenter}>
        <button onClick={() => setIsMediaReady(true)} style={bigBtn}>
          🚀 SĀKT PREZENTĀCIJU
        </button>
      </div>
    );
  }

  // 2. LOBBY / UZGAIDĀMAIS EKRĀNS (Pirms spēles/prezentācijas sākšanas)
  if (!scene) {
    return (
      <div style={{ ...fullScreenCenter, backgroundColor: '#000' }}>
        <h1 style={{ fontSize: '4vw', color: '#888', margin: '0 0 20px 0' }}>PIEVIENOJIES SPĒLEI:</h1>
        <div style={{ border: '8px solid #0f0', padding: '3vw 8vw', borderRadius: '50px', boxShadow: '0 0 80px rgba(0,255,0,0.3)' }}>
          <h1 style={{ fontSize: '15vw', margin: 0, letterSpacing: '1vw', lineHeight: 1, color: '#fff' }}>{pin}</h1>
        </div>
        <h2 style={{ fontSize: '4vw', marginTop: '3vw', color: '#fff' }}>
          👥 Dalībnieki: <span style={{ color: '#0f0' }}>{participantCount}</span>
        </h2>
      </div>
    );
  }

  const bgUrl = scene.config?.backgroundUrl
    ? `${MEDIA_BASE_URL}/${scene.config.backgroundUrl}`
    : '';

  return (
    <div
      style={{
        ...fullScreenContainer,
        backgroundImage: bgUrl ? `url(${bgUrl})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* AUGŠĒJĀ INFORMĀCIJAS JOSTA */}
      <div style={topBar}>
        <span>PIN: <strong>{pin}</strong></span>
        <Timer endTime={scene.endTime} />
        <span>👥 {participantCount}</span>
      </div>

      {/* SLAIDA SATURS UN MEDIA ELEMENTI */}
      <div style={{ flex: 1, width: '100%', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        
        {/* Dinamiskie izkārtojuma elementi (Attēli, Video, Audio, Teksti) */}
        {scene.config?.layout?.map((el: any, idx: number) => {
          const src = el.content ? `${MEDIA_BASE_URL}/${el.content}` : '';
          const itemKey = el.id || `el-${idx}`;
          const style: React.CSSProperties = {
            position: 'absolute',
            left: `${el.x}%`,
            top: `${el.y}%`,
            width: `${el.w}%`,
            zIndex: 1
          };

          if (el.type === 'AUDIO') {
            return (
              <audio
                key={itemKey}
                ref={audioRef}
                src={src}
                autoPlay={scene.subState === 'ACTIVE'}
              />
            );
          }

          if (el.type === 'IMAGE') {
            return (
              <div key={itemKey} style={style}>
                <img src={src} style={{ width: '100%', borderRadius: '15px', display: 'block' }} alt="Medijs" />
              </div>
            );
          }

          if (el.type === 'VIDEO') {
            return (
              <div key={itemKey} style={style}>
                <video
                  key={src}
                  ref={videoRef}
                  src={src}
                  style={{ width: '100%', borderRadius: '15px', display: 'block' }}
                  autoPlay={scene.subState === 'ACTIVE'}
                  playsInline
                />
              </div>
            );
          }

          if (el.type === 'TEXT') {
            return (
              <div key={itemKey} style={{ ...style, fontSize: '2.5vw', background: 'rgba(0,0,0,0.7)', padding: '10px 20px', borderRadius: '10px', textShadow: '2px 2px 10px #000' }}>
                {el.content}
              </div>
            );
          }

          return null;
        })}

        {/* Virsraksts un Jautājums */}
        {(scene.title || scene.config?.question) && (
          <div style={{ zIndex: 5, background: 'rgba(0,0,0,0.65)', padding: '20px 40px', borderRadius: '20px', textAlign: 'center', maxWidth: '80%', marginTop: '6vw' }}>
            {scene.title && <h1 style={{ fontSize: '3.5vw', margin: '0 0 10px 0', textShadow: '0 0 20px black' }}>{scene.title}</h1>}
            {scene.config?.question && (
              <h2 style={{ fontSize: '2.2vw', fontWeight: 'normal', margin: 0 }}>{scene.config.question}</h2>
            )}
          </div>
        )}

        {/* Statistikas un Rezultātu diagramma */}
        {(isStatsVisible || isRevealed) && scene.config?.options && (
          <div style={chartContainer}>
            {scene.config.options.map((opt: string, idx: number) => {
              const isCorrect = scene.config?.correctAnswers?.includes(opt) && isRevealed;
              const count = voteCounts[opt] || 0;
              return (
                <div key={`${opt}-${idx}`} style={barWrapper}>
                  <div
                    style={{
                      ...bar,
                      height: `${count * 40 + 20}px`,
                      background: isRevealed ? (isCorrect ? '#28a745' : '#dc3545') : '#007bff'
                    }}
                  >
                    <span style={voteNum}>{count}</span>
                  </div>
                  <p style={barLabel}>{opt || `Var. ${idx + 1}`}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Līderu tabula */}
        {scene.type === 'LEADERBOARD' && (
          <div style={leaderboardBox}>
            <h1 style={{ fontSize: '3vw', marginBottom: '20px', color: '#ffc107' }}>🏆 TOP REZULTĀTI</h1>
            {leaderboard.slice(0, 5).map((p, i) => (
              <div key={p.id || i} style={leaderRow}>
                <span>{i + 1}. {p.name}</span>
                <span style={{ fontWeight: 'bold', color: '#28a745' }}>{p.score} pt</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

// STILI
const fullScreenContainer: React.CSSProperties = {
  height: '100vh',
  width: '100vw',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  backgroundColor: '#000',
  color: '#fff',
  fontFamily: 'Arial, sans-serif',
  overflow: 'hidden',
  position: 'relative'
};

const fullScreenCenter: React.CSSProperties = {
  ...fullScreenContainer,
  justifyContent: 'center'
};

const topBar: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  width: '100%',
  padding: '20px',
  display: 'flex',
  justifyContent: 'space-around',
  alignItems: 'center',
  fontSize: '2vw',
  background: 'rgba(0,0,0,0.7)',
  zIndex: 20
};

const bigBtn: React.CSSProperties = {
  padding: '30px 60px',
  fontSize: '2.5rem',
  cursor: 'pointer',
  background: '#28a745',
  color: '#fff',
  border: 'none',
  borderRadius: '20px',
  fontWeight: 'bold',
  boxShadow: '0 10px 20px rgba(0,0,0,0.5)'
};

const chartContainer: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  gap: '30px',
  height: '35vh',
  marginTop: 'auto',
  marginBottom: '4vh',
  width: '80%',
  zIndex: 10
};

const barWrapper: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  flex: 1
};

const bar: React.CSSProperties = {
  width: '70px',
  transition: 'height 0.8s ease',
  borderRadius: '10px 10px 0 0',
  position: 'relative'
};

const voteNum: React.CSSProperties = {
  position: 'absolute',
  top: '-40px',
  width: '100%',
  textAlign: 'center',
  fontWeight: 'bold',
  fontSize: '1.8vw'
};

const barLabel: React.CSSProperties = {
  fontSize: '1.4vw',
  background: 'rgba(0,0,0,0.8)',
  padding: '6px 12px',
  borderRadius: '6px',
  marginTop: '10px',
  textAlign: 'center'
};

const leaderboardBox: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -40%)',
  background: 'rgba(0,0,0,0.9)',
  padding: '40px',
  borderRadius: '20px',
  width: '600px',
  maxWidth: '90%',
  zIndex: 30,
  textAlign: 'center',
  border: '2px solid #333'
};

const leaderRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '2vw',
  borderBottom: '1px solid #333',
  padding: '12px 0'
};