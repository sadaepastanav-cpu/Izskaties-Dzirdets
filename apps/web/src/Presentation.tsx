import { useState, useEffect } from 'react';
import { socket } from './socket';
import { useParams } from 'react-router-dom';
import Timer from './Timer';

export default function Presentation() {
  const { pin } = useParams();
  const [scene, setScene] = useState<any>(null);
  const [voteCounts, setVoteCounts] = useState<any>({});
  const [isRevealed, setIsRevealed] = useState(false);
  const [isStatsVisible, setIsStatsVisible] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isMediaReady, setIsMediaReady] = useState(false);

  useEffect(() => {
    if (pin) socket.emit('join-session', { pin, name: 'EKRĀNS', playerId: 'scr_' + pin });
    socket.on('state-update', (s) => { setScene(s); setIsRevealed(false); setIsStatsVisible(false); setVoteCounts({}); });
    socket.on('votes-updated', (v) => setVoteCounts(v));
    socket.on('results-revealed', () => setIsRevealed(true));
    socket.on('stats-revealed', () => setIsStatsVisible(true));
    socket.on('leaderboard-update', (l) => setLeaderboard(l));
    return () => { socket.off('state-update'); socket.off('votes-updated'); socket.off('results-revealed'); socket.off('stats-revealed'); socket.off('leaderboard-update'); };
  }, [pin]);

  if (!isMediaReady) return <div style={center}><button onClick={() => setIsMediaReady(true)} style={bigBtn}>🚀 SĀKT ŠOVU</button></div>;
  if (!scene) return <div style={center}><h1 style={{fontSize: '10vw'}}>{pin}</h1></div>;

  return (
    <div style={{ 
      height: '100vh', width: '100vw', background: '#000', color: '#fff', textAlign: 'center', overflow: 'hidden',
      backgroundImage: scene.config.backgroundUrl ? `url(http://localhost:3000/project-media/${scene.config.backgroundUrl})` : 'none',
      backgroundSize: 'cover'
    }}>
      <div style={{display: 'flex', justifyContent: 'space-between', padding: '20px', background: 'rgba(0,0,0,0.5)', fontSize: '2vw'}}>
        <span>PIN: {pin}</span> <Timer endTime={scene.endTime} />
      </div>

      <h1 style={{fontSize: '5vw', textShadow: '0 0 20px #000'}}>{scene.title}</h1>
      <h2 style={{fontSize: '3vw', textShadow: '0 0 10px #000'}}>{scene.config.question}</h2>

      {(isStatsVisible || isRevealed) && (
        <div style={{display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '20px', height: '30vh', marginTop: '5vh'}}>
          {scene.config.options?.map((opt: string) => {
            const isCorrect = scene.config.correctAnswers.includes(opt) && isRevealed;
            return (
              <div key={opt}>
                <div style={{ width: '80px', background: isCorrect ? '#28a745' : '#007bff', height: `${(voteCounts[opt]||0)*50 + 20}px`, transition: 'all 1s' }}></div>
                <p style={{background: 'rgba(0,0,0,0.8)', padding: '5px'}}>{opt}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const center: any = { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff' };
const bigBtn = { padding: '30px 60px', fontSize: '2rem', cursor: 'pointer', background: '#28a745', color: '#fff', border: 'none', borderRadius: '15px' };