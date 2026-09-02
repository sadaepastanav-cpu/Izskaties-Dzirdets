import { useState, useEffect, useRef } from 'react';
import { socket } from './socket';
import { useParams } from 'react-router-dom';
import Timer from './Timer';

export default function Presentation() {
  const { pin } = useParams();
  const [scene, setScene] = useState<any>(null);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
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
        videoRef.current.play().catch(e => {
          console.error("Video atskaņošanas kļūda:", e);
          alert("Lūdzu, noklikšķiniet uz šī ekrāna vienreiz!");
        });
      }
    });

    socket.on('votes-updated', (summary) => setVoteCounts(summary || {}));
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
    if (!s?.config?.mediaUrl) return null;

    const url = isRevealed && s.config.revealMediaUrl ? s.config.revealMediaUrl : s.config.mediaUrl;
    const type = isRevealed && s.config.revealMediaType ? s.config.revealMediaType : s.config.mediaType;

    if (type === 'image') {
      return (
        <div style={mediaContainer}>
          <img src={url} style={mediaStyle} alt="Ainas medijs" onError={(e) => console.error("Bilde nelādējas:", url)} />
        </div>
      );
    }

    if (type === 'video') {
      return (
        <div style={mediaContainer}>
          <video 
            ref={videoRef} 
            key={s.id} // Multi-render aizsardzība: pārlādējas tikai pie jaunas ainas
            src={url} 
            style={mediaStyle} 
            playsInline
            onCanPlay={() => console.log("Video gatavs atskaņošanai")}
            onError={(e) => console.error("Video kļūda:", url)}
          />
        </div>
      );
    }
    
    if (type === 'audio') {
      return <audio src={url} ref={(el) => { if (el && isRevealed) el.play(); }} />;
    }

    return null;
  };

  // Mediju atskaņošanas atļaujas logs (Browser autoplay restrictions)
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

  // Iegūstam pareizās atbildes (atbalsts vairāku atbilžu masīvam)
  const correctAnswers: string[] = scene.config?.correctAnswers || (scene.config?.correctAnswer ? [scene.config.correctAnswer] : []);

  // Aprēķinām maksimālo balsu skaitu, lai scalerot stabiņu augstumu
  const maxVotes = Math.max(...Object.values(voteCounts), 1);

  return (
    <div style={fullScreen}>
      <div style={topBar}>
        <span>PIN: {pin}</span>
        <Timer endTime={scene.endTime} />
        <span>👥 {participantCount}</span>
      </div>

      {renderMedia(scene)}
      <h1 style={{ fontSize: '3.5vw', margin: '10px 0', textAlign: 'center' }}>{scene.title}</h1>
      <p style={{ fontSize: '1.8vw', opacity: 0.8, marginBottom: '20px', textAlign: 'center' }}>
        {scene.config?.question || scene.config?.text}
      </p>

      {(scene.type === 'VOTE' || scene.type === 'QUIZ') && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <div style={chartContainer}>
            {scene.config?.options?.map((opt: string) => {
              const count = voteCounts[opt] || 0;
              const isCorrect = scene.type === 'QUIZ' && correctAnswers.includes(opt);
              
              // Dinamisks stabiņa augstums procentos no maksimālā augstuma (max 320px)
              const heightPercent = (count / maxVotes) * 100;
              const computedHeight = count > 0 ? Math.max((heightPercent / 100) * 280, 20) : 10;

              return (
                <div key={opt} style={barWrapper}>
                  <div style={{ 
                    ...bar, 
                    height: `${computedHeight}px`,
                    backgroundColor: isRevealed ? (isCorrect ? '#28a745' : '#dc3545') : '#007bff'
                  }}>
                    {isRevealed && <span style={voteNum}>{count}</span>}
                  </div>
                  <p style={{ 
                    ...barLabel, 
                    fontWeight: isRevealed && isCorrect ? 'bold' : 'normal',
                    color: isRevealed && isCorrect ? '#28a745' : 'white'
                  }}>
                    {isRevealed && isCorrect ? `✓ ${opt}` : opt}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {scene.type === 'LEADERBOARD' && (
        <div style={{ width: '80%', maxWidth: '800px' }}>
          <h1 style={{ color: 'gold', fontSize: '4vw', textAlign: 'center' }}>🏆 TOP REZULTĀTI</h1>
          {leaderboard.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '2.5vw', padding: '12px 20px', background: 'rgba(255,255,255,0.1)', margin: '8px 0', borderRadius: '10px' }}>
              <span>{i + 1}. {p.name}</span>
              <span style={{ fontWeight: 'bold', color: 'gold' }}>{p.score} pt</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Stili
const fullScreen: React.CSSProperties = { height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', color: 'white', fontFamily: 'Arial, sans-serif', overflow: 'hidden', padding: '20px', boxSizing: 'border-box' };
const topBar: React.CSSProperties = { position: 'absolute', top: 0, width: '100%', padding: '20px 50px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.5vw', background: 'rgba(255,255,255,0.05)', boxSizing: 'border-box' };
const mediaContainer: React.CSSProperties = { display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', marginBottom: '15px' };
const mediaStyle: React.CSSProperties = { maxWidth: '85%', maxHeight: '42vh', borderRadius: '15px', boxShadow: '0 15px 35px rgba(0,0,0,0.8)', border: '3px solid #333', backgroundColor: '#111', objectFit: 'contain' };
const chartContainer: React.CSSProperties = { display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '3vw', height: '35vh', width: '80%', maxWidth: '900px' };
const barWrapper: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' };
const bar: React.CSSProperties = { width: '100%', maxWidth: '90px', borderRadius: '10px 10px 0 0', position: 'relative', transition: 'height 0.6s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.4s ease', display: 'flex', justifyContent: 'center' };
const voteNum: React.CSSProperties = { position: 'absolute', top: '-40px', fontSize: '2vw', fontWeight: 'bold' };
const barLabel: React.CSSProperties = { marginTop: '12px', fontSize: '1.4vw', textAlign: 'center', wordBreak: 'break-word' };