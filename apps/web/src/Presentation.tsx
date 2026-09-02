import { useState, useEffect, useRef } from 'react';
import { socket } from './socket';
import { useParams } from 'react-router-dom';
import Timer from './Timer';

export default function Presentation() {
  const { pin } = useParams();
  const [scene, setScene] = useState<any>(null);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [participantCount, setParticipantCount] = useState(0);
  const [isStatsVisible, setIsStatsVisible] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isMediaReady, setIsMediaReady] = useState(false);

  // HTML Media (video/audio) atsauce
  const mediaRef = useRef<HTMLHTMLMediaElement | null>(null);

  useEffect(() => {
    if (pin) socket.emit('join-session', { pin, name: 'EKRĀNS', playerId: 'screen_' + pin });

    socket.on('state-update', (newScene: any) => {
      setScene(newScene);
      setIsRevealed(!!newScene?.isRevealed);
      setIsStatsVisible(!!newScene?.isStatsVisible);
      setVoteCounts({});
    });

    socket.on('video-command', (cmd) => {
      console.log("Saņemta video komanda:", cmd);
      if (cmd === 'play' && mediaRef.current) {
        mediaRef.current.play().catch(e => {
          console.error("Media atskaņošanas kļūda:", e);
          alert("Lūdzu, noklikšķiniet uz šī ekrāna vienreiz, lai atļautu audio/video atskaņošanu!");
        });
      } else if (cmd === 'pause' && mediaRef.current) {
        mediaRef.current.pause();
      }
    });

    socket.on('votes-updated', (summary) => setVoteCounts(summary || {}));
    socket.on('presence-update', (data) => setParticipantCount(data?.count || 0));
    socket.on('stats-revealed', () => setIsStatsVisible(true));
    socket.on('results-revealed', () => setIsRevealed(true));
    socket.on('leaderboard-update', (data) => setLeaderboard(data || []));

    return () => {
      socket.off('state-update');
      socket.off('video-command');
      socket.off('votes-updated');
      socket.off('presence-update');
      socket.off('stats-revealed');
      socket.off('results-revealed');
      socket.off('leaderboard-update');
    };
  }, [pin]);

  // Trim un Trigger atskaņošanas loģika
  useEffect(() => {
    if (!scene) return;

    // Ja ir atklāšanas fāze un ir definēts revealMedia
    if (isRevealed && scene.config?.revealMedia?.url) {
      const player = mediaRef.current;
      if (player) {
        player.currentTime = scene.config.revealMedia.trimStart || 0;
        player.play().catch(console.error);
      }
      return;
    }

    // Pamata medija loģika (jautājuma aktīvajā fāzē)
    const mediaConfig = scene.config?.media;
    if (mediaConfig && mediaConfig.url) {
      const trigger = mediaConfig.trigger || 'ON_TIMER_START';

      if (trigger === 'ON_TIMER_START' || trigger === 'ON_LOAD') {
        const player = mediaRef.current;
        if (player) {
          const startTime = mediaConfig.trimStart || 0;
          const stopTime = mediaConfig.trimEnd;

          player.currentTime = startTime;
          player.play().catch(console.error);

          // Pārtraukt atskaņošanu, sasniedzot trimEnd
          if (stopTime && stopTime > startTime) {
            const durationMs = (stopTime - startTime) * 1000;
            const timerId = setTimeout(() => {
              if (player) player.pause();
            }, durationMs);

            return () => clearTimeout(timerId);
          }
        }
      }
    }
  }, [scene, isRevealed]);

  const renderMedia = (s: any) => {
    // Pārbauda jauno sazaroto struktūru (config.media / config.revealMedia), kadrējot saderību ar vecajām atslēgām
    const activeMedia = isRevealed && s.config?.revealMedia?.url
      ? s.config.revealMedia
      : s.config?.media?.url
        ? s.config.media
        : {
            url: isRevealed && s.config?.revealMediaUrl ? s.config.revealMediaUrl : s.config?.mediaUrl,
            type: isRevealed && s.config?.revealMediaType ? s.config.revealMediaType : s.config?.mediaType
          };

    if (!activeMedia || !activeMedia.url) return null;

    if (activeMedia.type === 'image') {
      return (
        <div style={mediaContainer}>
          <img src={activeMedia.url} style={mediaStyle} alt="Ainas medijs" onError={(e) => console.error("Bilde nelādējas:", activeMedia.url)} />
        </div>
      );
    }

    if (activeMedia.type === 'video') {
      return (
        <div style={mediaContainer}>
          <video 
            ref={(el) => { mediaRef.current = el; }} 
            key={activeMedia.url} 
            src={activeMedia.url} 
            style={mediaStyle} 
            playsInline
            onCanPlay={() => console.log("Video gatavs atskaņošanai")}
            onError={(e) => console.error("Video kļūda:", activeMedia.url)}
          />
        </div>
      );
    }
    
    if (activeMedia.type === 'audio') {
      return (
        <audio 
          ref={(el) => { mediaRef.current = el; }} 
          key={activeMedia.url} 
          src={activeMedia.url} 
          onError={(e) => console.error("Audio kļūda:", activeMedia.url)}
        />
      );
    }

    return null;
  };

  // Sākotnējais ekrāns audio/video atskaņošanas atļaušanai pārlūkā
  if (!isMediaReady) {
    return (
      <div style={fullScreen}>
        <button 
          onClick={() => setIsMediaReady(true)} 
          style={{ 
            padding: '30px 60px', 
            fontSize: '2rem', 
            background: '#28a745', 
            color: 'white', 
            border: 'none', 
            borderRadius: '20px', 
            cursor: 'pointer', 
            fontWeight: 'bold',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}
        >
          🚀 SĀKT PREZENTĀCIJU (Aktivizēt audio/video)
        </button>
      </div>
    );
  }

  // Ja session nav aktīvas ainas — rāda PIN iestatījumu un pievienojušos spēlētājus
  if (!scene) {
    return (
      <div style={fullScreen}>
        <h1 style={{ fontSize: '4vw', color: '#888' }}>PIEVIENOJIES:</h1>
        <div style={{ border: '5px solid #0f0', padding: '2vw 5vw', borderRadius: '30px', margin: '20px 0' }}>
          <h1 style={{ fontSize: '12vw', margin: 0 }}>{pin}</h1>
        </div>
        <h2 style={{ fontSize: '3vw', marginTop: '2vw' }}>👥 Dalībnieki: {participantCount}</h2>
      </div>
    );
  }

  // Droša pareizo atbilžu atdalīšana
  const correctAnswers: string[] = scene.config?.correctAnswers 
    ? scene.config.correctAnswers 
    : (scene.config?.correctAnswer ? [scene.config.correctAnswer] : []);

  const maxVotes = Math.max(...Object.values(voteCounts), 1);

  const containerStyle: React.CSSProperties = {
    ...fullScreen,
    backgroundImage: scene?.config?.backgroundUrl ? `url(${scene.config.backgroundUrl})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    transition: 'background 1s ease-in-out'
  };

  return (
    <div style={containerStyle}>
      {/* Augšējā josla */}
      <div style={topBar}>
        <span>PIN: {pin}</span>
        <Timer endTime={scene.endTime} />
        <span>👥 {participantCount}</span>
      </div>

      {/* Mediju saturs (Attēls/Video/Audio) */}
      {renderMedia(scene)}

      {/* Virsraksts un jautājums */}
      <h1 style={{ fontSize: '3.5vw', margin: '10px 0', textAlign: 'center', zIndex: 2, textShadow: '2px 2px 10px black' }}>
        {scene.title}
      </h1>
      <h2 style={{ fontSize: '2vw', opacity: 0.9, marginBottom: '20px', textAlign: 'center', zIndex: 2, textShadow: '2px 2px 10px black' }}>
        {scene.config?.question || scene.config?.text}
      </h2>

      {/* Stabiņu diagramma VOTE/QUIZ ainu tipiem */}
      {(scene.type === 'VOTE' || scene.type === 'QUIZ') && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', zIndex: 2 }}>
          <div style={chartContainer}>
            {scene.config?.options?.map((opt: string) => {
              const count = voteCounts[opt] || 0;
              const isCorrect = scene.type === 'QUIZ' && correctAnswers.includes(opt);
              
              const heightPercent = (isStatsVisible || isRevealed) ? (count / maxVotes) * 100 : 0;
              const computedHeight = (isStatsVisible || isRevealed) 
                ? (count > 0 ? Math.max((heightPercent / 100) * 280, 20) : 10) 
                : 0;

              return (
                <div key={opt} style={barWrapper}>
                  <div style={{ 
                    ...bar, 
                    height: `${computedHeight}px`,
                    opacity: (isStatsVisible || isRevealed) ? 1 : 0,
                    backgroundColor: isRevealed ? (isCorrect ? '#28a745' : '#dc3545') : '#007bff'
                  }}>
                    {(isStatsVisible || isRevealed) && <span style={voteNum}>{count}</span>}
                  </div>
                  <p style={{ 
                    ...barLabel, 
                    fontWeight: isRevealed && isCorrect ? 'bold' : 'normal',
                    color: isRevealed && isCorrect ? '#28a745' : 'white',
                    background: 'rgba(0,0,0,0.6)',
                    padding: '4px 8px',
                    borderRadius: '4px'
                  }}>
                    {isRevealed && isCorrect ? `✓ ${opt}` : opt}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Līderu saraksts */}
      {scene.type === 'LEADERBOARD' && (
        <div style={{ width: '80%', maxWidth: '800px', zIndex: 2 }}>
          <h1 style={{ color: 'gold', fontSize: '4vw', textAlign: 'center', textShadow: '2px 2px 10px black' }}>
            🏆 TOP REZULTĀTI
          </h1>
          {leaderboard.map((p, i) => (
            <div key={i} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              fontSize: '2.5vw', 
              padding: '12px 20px', 
              background: 'rgba(0,0,0,0.7)', 
              margin: '8px 0', 
              borderRadius: '10px', 
              backdropFilter: 'blur(5px)' 
            }}>
              <span>{i + 1}. {p.name}</span>
              <span style={{ fontWeight: 'bold', color: 'gold' }}>{p.score} pt</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Stilu definīcijas
const fullScreen: React.CSSProperties = { height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', color: 'white', fontFamily: 'Arial, sans-serif', overflow: 'hidden', padding: '20px', boxSizing: 'border-box', position: 'relative' };
const topBar: React.CSSProperties = { position: 'absolute', top: 0, width: '100%', padding: '20px 50px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.5vw', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', boxSizing: 'border-box', zIndex: 10 };
const mediaContainer: React.CSSProperties = { display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', marginBottom: '15px', zIndex: 2 };
const mediaStyle: React.CSSProperties = { maxWidth: '85%', maxHeight: '40vh', borderRadius: '15px', boxShadow: '0 15px 35px rgba(0,0,0,0.8)', border: '3px solid #333', backgroundColor: '#111', objectFit: 'contain' };
const chartContainer: React.CSSProperties = { display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '3vw', height: '35vh', width: '80%', maxWidth: '900px' };
const barWrapper: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' };
const bar: React.CSSProperties = { width: '100%', maxWidth: '90px', borderRadius: '10px 10px 0 0', position: 'relative', transition: 'height 0.6s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.4s ease, opacity 0.4s ease', display: 'flex', justifyContent: 'center' };
const voteNum: React.CSSProperties = { position: 'absolute', top: '-40px', fontSize: '2vw', fontWeight: 'bold', textShadow: '2px 2px 4px black' };
const barLabel: React.CSSProperties = { marginTop: '12px', fontSize: '1.4vw', textAlign: 'center', wordBreak: 'break-word' };