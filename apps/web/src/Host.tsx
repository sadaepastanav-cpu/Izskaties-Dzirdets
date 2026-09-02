import { useState, useEffect } from 'react';
import { socket } from './socket';
import Timer from './Timer';

export default function Host() {
  const [pin, setPin] = useState<string | null>(localStorage.getItem('active_pin'));
  const [scenes, setScenes] = useState<any[]>([]);
  const [voteCounts, setVoteCounts] = useState<any>({});
  const [currentScene, setCurrentScene] = useState<any>(null);
  const [joinedPlayers, setJoinedPlayers] = useState<any[]>([]);
  const [videoBtnText, setVideoBtnText] = useState('🎬 ATSKAŅOT VIDEO / AUDIO');

  useEffect(() => {
    const savedPin = localStorage.getItem('active_pin');
    const savedShowId = localStorage.getItem('active_showId');
    if (savedPin && savedShowId) {
      socket.emit('host:create-session', { showId: savedShowId, existingPin: savedPin });
    }

    socket.on('session-info', (data) => {
      setPin(data.pin);
      setScenes(data.state.scenes || []);
      setCurrentScene(data.state.currentScene);
      localStorage.setItem('active_pin', data.pin);
    });

    socket.on('state-update', (s) => setCurrentScene(s));
    socket.on('votes-updated', (v) => setVoteCounts(v));
    socket.on('presence-update', (d) => setJoinedPlayers(d.players || []));

    return () => {
      socket.off('session-info');
      socket.off('state-update');
      socket.off('votes-updated');
      socket.off('presence-update');
    };
  }, []);

  const startShow = async () => {
    try {
      console.log("Mēģinu ielādēt šovus...");
      const res = await fetch('http://localhost:3000/api/shows');
      const shows = await res.json();
      
      if (shows && shows.length > 0) {
        console.log("Šovs atrasts, sūtu komandu serverim...");
        localStorage.setItem('active_showId', shows[0].id);
        socket.emit('host:create-session', { showId: shows[0].id });
      } else {
        alert("Datubāze ir tukša! Tev ir jāpalaiž datubāzes aizpildīšanas skripts.");
      }
    } catch (err) {
      console.error("Kļūda:", err);
      alert("Nevar pieslēgties serverim! Pārbaudi vai apps/api terminālis griežas.");
    }
  };

  const goToScene = (scene: any) => {
    setVoteCounts({});
    socket.emit('host:next-scene', { pin, scene });
  };

  const handleTriggerVideo = () => {
    if (!pin) return;
    socket.emit('host:trigger-video', pin);
    
    setVideoBtnText('✅ SIGNĀLS NOSŪTĪTS');
    setTimeout(() => setVideoBtnText('🎬 ATSKAŅOT VIDEO / AUDIO'), 2000);
  };

  if (!pin) {
    return (
      <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'Arial' }}>
        <button 
          onClick={startShow} 
          style={{ padding: '20px 40px', fontSize: '20px', cursor: 'pointer', background: '#28a745', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}
        >
          🚀 SĀKT JAUNU PASĀKUMU
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Arial', color: 'white', maxWidth: '600px', margin: 'auto' }}>
      
      {/* Augšējais informācijas panelis */}
      <div style={{ background: '#333', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
        <h2>PIN: <span style={{ color: '#0f0' }}>{pin}</span></h2>
        <p style={{ margin: '5px 0 15px 0', color: '#ccc' }}>👥 Pievienojušies spēlētāji: {joinedPlayers.length}</p>
        <div>
          <button 
            onClick={() => window.open(`/present/${pin}`, '_blank')} 
            style={{ padding: '10px 15px', marginRight: '10px', cursor: 'pointer', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}
          >
            🖥️ PROJEKTORS
          </button>
          <button 
            onClick={() => { localStorage.clear(); window.location.reload(); }} 
            style={{ padding: '10px 15px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            BEIGT PASĀKUMU
          </button>
        </div>
      </div>

      {/* Taimera sekcija */}
      <div style={{ background: '#222', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
        <h3>Taimeris: <Timer endTime={currentScene?.endTime} /></h3>
      </div>

      {/* Vadības pogas (4 pakāpju secība vadītājam) */}
      <div style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={handleTriggerVideo} 
          style={{ 
            padding: '15px', 
            background: videoBtnText.includes('✅') ? '#28a745' : '#17a2b8', 
            color: 'white', 
            fontWeight: 'bold', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: 'pointer', 
            fontSize: '16px',
            transition: 'background-color 0.3s ease'
          }}
        >
          {videoBtnText}
        </button>
        
        <button 
          onClick={() => socket.emit('host:start-timer', pin)} 
          disabled={!!currentScene?.endTime} 
          style={{ 
            padding: '15px', 
            background: currentScene?.endTime ? '#555' : '#007bff', 
            color: 'white', 
            fontWeight: 'bold', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: currentScene?.endTime ? 'not-allowed' : 'pointer', 
            fontSize: '16px' 
          }}
        >
          ▶️ PALAIST TAIMERI UN BALSOŠANU
        </button>

        <button 
          onClick={() => socket.emit('host:show-stats', pin)} 
          style={{ 
            padding: '15px', 
            background: '#6c757d', 
            color: 'white', 
            fontWeight: 'bold', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: 'pointer', 
            fontSize: '16px' 
          }}
        >
          📊 RĀDĪT STATISTIKU (STABIŅUS)
        </button>

        <button 
          onClick={() => socket.emit('host:reveal-results', pin)} 
          style={{ 
            padding: '15px', 
            background: 'gold', 
            color: 'black', 
            fontWeight: 'bold', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: 'pointer', 
            fontSize: '16px' 
          }}
        >
          🌟 ATKLĀT ATBILDI EKRĀNĀ
        </button>
      </div>

      {/* Slaidu saraksts */}
      <div style={{ background: '#222', padding: '15px', borderRadius: '10px', textAlign: 'left' }}>
        <h3 style={{ marginTop: 0 }}>Slaidi:</h3>
        {scenes.map((s, i) => (
          <button 
            key={i} 
            onClick={() => goToScene(s)} 
            style={{ 
              display: 'block', 
              width: '100%', 
              padding: '12px', 
              margin: '6px 0', 
              background: currentScene?.id === s.id ? '#28a745' : '#444', 
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              textAlign: 'left',
              cursor: 'pointer',
              fontWeight: currentScene?.id === s.id ? 'bold' : 'normal'
            }}
          >
            {i + 1}. {s.title || `Slaids ${i + 1}`}
          </button>
        ))}
      </div>

    </div>
  );
}