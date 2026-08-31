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
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isMediaReady, setIsMediaReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (pin) socket.emit('join-session', { pin, name: 'EKRĀNS', playerId: 'screen_' + pin });

    socket.on('state-update', (newScene: any) => {
      setScene(newScene);
      setIsRevealed(false);
      setVoteCounts({});
    });

    socket.on('video-command', (cmd) => {
      console.log("Saņemta video komanda:", cmd);
      if (cmd === 'play' && videoRef.current) {
        videoRef.current.play().catch(e => alert("Lūdzu, noklikšķiniet uz šī ekrāna vienreiz!"));
      }
    });

    socket.on('votes-updated', (summary) => setVoteCounts(summary));
    socket.on('presence-update', (data) => setParticipantCount(data.count));
    socket.on('results-revealed', () => setIsRevealed(true));
    socket.on('leaderboard-update', (data) => setLeaderboard(data));

    return () => {
      socket.off('state-update');
      socket.off('video-command');
      socket.off('votes-updated');
      socket.off('presence-update');
      socket.off('results-revealed');
      socket.off('leaderboard-update');
    };
  }, [pin]);

  const renderMedia = (s: any) => {
    if (!s?.config?.mediaUrl) return <div style={{ color: 'gray' }}>Nav mediju faila</div>;

    const url = isRevealed && s.config.revealMediaUrl ? s.config.revealMediaUrl : s.config.mediaUrl;
    const type = isRevealed && s.config.revealMediaType ? s.config.revealMediaType : s.config.mediaType;

    const style: React.CSSProperties = {
      maxWidth: '90%',
      maxHeight: '50vh',
      borderRadius: '20px',
      boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
      marginBottom: '20px',
      border: '4px solid #333',
      backgroundColor: '#222' // Pelēks fons, kamēr lādējas
    };

    if (type === 'image') {
      return <img src={url} style={style} alt="Pielikums" onError={(e) => console.error("Bilde nelādējas:", url)} />;
    }

    if (type === 'video') {
      return (
        <video 
          ref={videoRef} 
          src={url} 
          style={style} 
          playsInline
          onCanPlay={() => console.log("Video ir gatavs atskaņošanai")}
          onError={(e) => console.error("Video kļūda:", url)}
        />
      );
    }
    
    if (type === 'audio') {
      return <audio src={url} ref={(el) => { if (el && isRevealed) el.play(); }} />;
    }

    return null;
  };

  // Mediju atskaņošanas atļaujas logs
  if (!isMediaReady) {
    return (
      <div style={fullScreen}>
        <button 
          onClick={() => setIsMediaReady(true)} 
          style={{ padding: '30px 60px', fontSize: '2rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          SĀKT PREZENTĀCIJU (Aktivizēt audio/video)
        </button>
      </div>
    );
  }

  // Gaidīšanas telpa (Lobby), ja aina vēl nav izvēlēta
  if (!scene) {
    return (
      <div style={fullScreen}>
        <h1 style={{ fontSize: '4vw', color: '#888' }}>PIEVIENOJIES:</h1>
        <div style={{ border: '5px solid #0f0', padding: '2vw 5vw', borderRadius: '30px' }}>
          <h1 style={{ fontSize: '12vw', margin: 0 }}>{pin}</h1>
        </div>
        <h2 style={{ fontSize: '3vw', marginTop: '2vw' }}>👥 Dalībnieki: {participantCount}</h2>
      </div>
    );
  }

  return (
    <div style={fullScreen}>
      <div style={topBar}>
        <span>PIN: {pin}</span>
        <Timer endTime={scene.endTime} />
        <span>👥 {participantCount}</span>
      </div>

      {renderMedia(scene)}
      <h1 style={{ fontSize: '4vw', margin: '10px 0' }}>{scene.title}</h1>
      <p style={{ fontSize: '2vw', opacity: 0.8 }}>{scene.config?.question || scene.config?.text}</p>

      {(scene.type === 'VOTE' || scene.type === 'QUIZ') && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <div style={chartContainer}>
            {scene.config?.options?.map((opt: string) => {
              const count = voteCounts[opt] || 0;
              const isCorrect = scene.type === 'QUIZ' && opt === scene.config?.correctAnswer;
              const height = Math.min(count * 40 + 20, 350);
              return (
                <div key={opt} style={barWrapper}>
                  <div style={{ 
                    ...bar, 
                    height: `${height}px`,
                    backgroundColor: isRevealed ? (isCorrect ? '#28a745' : '#007bff') : '#007bff'
                  }}>
                    {isRevealed && <span style={voteNum}>{count}</span>}
                  </div>
                  <p style={{ ...barLabel, fontWeight: isRevealed && isCorrect ? 'bold' : 'normal' }}>{opt}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {scene.type === 'LEADERBOARD' && (
        <div style={{ width: '80%', maxWidth: '800px' }}>
          <h1 style={{ color: 'gold', fontSize: '4vw' }}>🏆 TOP REZULTĀTI</h1>
          {leaderboard.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '2.5vw', padding: '10px', background: 'rgba(255,255,255,0.1)', margin: '5px', borderRadius: '10px' }}>
              <span>{i + 1}. {p.name}</span>
              <span>{p.score} pt</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const fullScreen: React.CSSProperties = { height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', color: 'white', fontFamily: 'Arial', overflow: 'hidden' };
const topBar: React.CSSProperties = { position: 'absolute', top: 0, width: '100%', padding: '20px 50px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.5vw', background: 'rgba(255,255,255,0.05)', boxSizing: 'border-box' };
const chartContainer: React.CSSProperties = { display: 'flex', alignItems: 'flex-end', gap: '3vw', height: '40vh' };
const barWrapper: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 };
const bar: React.CSSProperties = { width: '80px', background: '#007bff', borderRadius: '10px 10px 0 0', position: 'relative', transition: 'height 1s ease', display: 'flex', justifyContent: 'center' };
const voteNum: React.CSSProperties = { position: 'absolute', top: '-40px', fontSize: '2vw', fontWeight: 'bold' };
const barLabel: React.CSSProperties = { marginTop: '10px', fontSize: '1.2vw' };