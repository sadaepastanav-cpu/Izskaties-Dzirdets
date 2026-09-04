import { useState, useEffect, useRef } from 'react';
import { socket } from './socket';
import { useParams } from 'react-router-dom';
import Timer from './Timer';

export default function Presentation() {
  const { pin } = useParams();
  const [scene, setScene] = useState<any>(null);
  const [voteCounts, setVoteCounts] = useState<any>({});
  const [participantCount, setParticipantCount] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isStatsVisible, setIsStatsVisible] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isMediaReady, setIsMediaReady] = useState(false);

  // Ref priekš video un audio elementiem
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (pin) {
      socket.emit('join-session', { pin, name: 'EKRĀNS', playerId: 'screen_' + pin });
    }

    const handleStateUpdate = (s: any) => {
      setScene(s);
      setIsRevealed(false);
      setIsStatsVisible(false);
      setVoteCounts({});
    };

    socket.on('state-update', handleStateUpdate);
    socket.on('votes-updated', (v) => setVoteCounts(v));
    socket.on('presence-update', (d) => setParticipantCount(d.count));
    socket.on('results-revealed', () => setIsRevealed(true));
    socket.on('stats-revealed', () => setIsStatsVisible(true));
    socket.on('leaderboard-update', (l) => setLeaderboard(l));

    return () => {
      socket.off('state-update', handleStateUpdate);
      socket.off('votes-updated');
      socket.off('presence-update');
      socket.off('results-revealed');
      socket.off('stats-revealed');
      socket.off('leaderboard-update');
    };
  }, [pin]);

  // Mediju atskaņošanas kontrole, kad slaids kļūst ACTIVE
  useEffect(() => {
    if (scene?.subState === 'ACTIVE') {
      if (videoRef.current) {
        videoRef.current.play().catch((err) => console.error("Video auto-play kļūda:", err));
      }
      if (audioRef.current) {
        audioRef.current.play().catch((err) => console.error("Audio auto-play kļūda:", err));
      }
    }
  }, [scene?.subState, scene?.id]);

  // 1. SĀKUMA ATĻAUJAS EKRĀNS (Pārlūka media un skaņas ierobežojumu dēļ)
  if (!isMediaReady) {
    return (
      <div style={fullScreenCenter}>
        <button onClick={() => setIsMediaReady(true)} style={bigBtn}>
          🚀 SĀKT PREZENTĀCIJU
        </button>
      </div>
    );
  }

  // 2. LOBBY / UZGAIDĀMAIS EKRĀNS (Pirms sesija ir palaista)
  if (!scene) {
    return (
      <div style={{ ...fullScreenCenter, backgroundColor: '#000' }}>
        <h1 style={{ fontSize: '4vw', color: '#888', margin: '0 0 20px 0' }}>PIEVIENOJIES SPĒLEI:</h1>
        <div style={{ border: '8px solid #0f0', padding: '3vw 8vw', borderRadius: '50px', boxShadow: '0 0 80px rgba(0,255,0,0.3)' }}>
          <h1 style={{ fontSize: '15vw', margin: 0, letterSpacing: '1vw', lineHeight: 1 }}>{pin}</h1>
        </div>
        <h2 style={{ fontSize: '4vw', marginTop: '3vw' }}>
          👥 Dalībnieki: <span style={{ color: '#0f0' }}>{participantCount}</span>
        </h2>
      </div>
    );
  }

  const bgUrl = scene.config?.backgroundUrl 
    ? `http://${window.location.hostname}:3000/project-media/${scene.config.backgroundUrl}` 
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

      {/* DINAMISKIE IZKĀRTOJUMA ELEMENTI (Attēli, Video, Audio, Teksti) */}
      {scene.config?.layout?.map((el: any) => {
        const src = `http://${window.location.hostname}:3000/project-media/${el.content}`;
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
              key={el.id} 
              ref={audioRef} 
              src={src} 
              autoPlay={scene.subState === 'ACTIVE'} 
            />
          );
        }

        return (
          <div key={el.id} style={style}>
            {el.type === 'IMAGE' && (
              <img src={src} style={{ width: '100%', borderRadius: '15px', display: 'block' }} alt="Medijs" />
            )}
            {el.type === 'VIDEO' && (
              <video 
                ref={videoRef}
                src={src} 
                style={{ width: '100%', borderRadius: '15px', display: 'block' }} 
                autoPlay={scene.subState === 'ACTIVE'}
                playsInline
              />
            )}
            {el.type === 'TEXT' && (
              <div style={{ fontSize: '2vw', background: 'rgba(0,0,0,0.7)', padding: '10px 20px', borderRadius: '10px' }}>
                {el.content}
              </div>
            )}
          </div>
        );
      })}

      {/* JAUTĀJUMS UN VIRSRAKSTS */}
      <div style={{ zIndex: 5, background: 'rgba(0,0,0,0.6)', padding: '20px 40px', borderRadius: '20px', textAlign: 'center', maxWidth: '80%', marginTop: '5vw' }}>
        <h1 style={{ fontSize: '4vw', margin: '0 0 10px 0', textShadow: '0 0 20px black' }}>{scene.title}</h1>
        {scene.config?.question && (
          <h2 style={{ fontSize: '2.5vw', fontWeight: 'normal', margin: 0 }}>{scene.config.question}</h2>
        )}
      </div>

      {/* REZULTĀTU DIAGRAMMA / BALSOJUMS */}
      {(isStatsVisible || isRevealed) && (
        <div style={chartContainer}>
          {scene.config?.options?.map((opt: string) => {
            const isCorrect = scene.config?.correctAnswers?.includes(opt) && isRevealed;
            const count = voteCounts[opt] || 0;
            return (
              <div key={opt} style={barWrapper}>
                <div style={{ ...bar, height: `${count * 30 + 20}px`, background: isCorrect ? '#28a745' : '#007bff' }}>
                  {isRevealed && <span style={voteNum}>{count}</span>}
                </div>
                <p style={barLabel}>{opt}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* LĪDERU TABULA (LEADERBOARD) */}
      {scene.type === 'LEADERBOARD' && (
        <div style={leaderboardBox}>
          <h1 style={{ fontSize: '3vw', marginBottom: '20px', color: '#ffc107' }}>🏆 TOP REZULTĀTI</h1>
          {leaderboard.map((p, i) => (
            <div key={p.id || i} style={leaderRow}>
              <span>{i + 1}. {p.name}</span>
              <span style={{ fontWeight: 'bold', color: '#28a745' }}>{p.score} pt</span>
            </div>
          ))}
        </div>
      )}
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
  marginBottom: '5vh',
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
  background: 'rgba(0,0,0,0.7)', 
  padding: '6px 12px', 
  borderRadius: '6px', 
  marginTop: '10px',
  textAlign: 'center'
};

const leaderboardBox: React.CSSProperties = { 
  position: 'absolute', 
  top: '55%', 
  left: '50%', 
  transform: 'translate(-50%, -50%)', 
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