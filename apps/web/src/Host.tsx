import { useState, useEffect } from 'react';
import { socket } from './socket';
import Timer from './Timer';

export default function Host() {
  const [pin, setPin] = useState<string | null>(localStorage.getItem('active_pin'));
  const [shows, setShows] = useState<any[]>([]);
  const [scenes, setScenes] = useState<any[]>([]);
  const [currentScene, setCurrentScene] = useState<any>(null);

  useEffect(() => {
    fetch('http://localhost:3000/api/shows').then(res => res.json()).then(setShows);
    
    socket.on('session-info', (data) => {
      setPin(data.pin);
      setScenes(data.state.scenes);
      setCurrentScene(data.state.currentScene);
      localStorage.setItem('active_pin', data.pin);
    });

    socket.on('state-update', (s) => setCurrentScene(s));

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        socket.emit('host:advance', pin);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => { socket.off('session-info'); socket.off('state-update'); window.removeEventListener('keydown', handleKeyDown); };
  }, [pin]);

  if (!pin) return (
    <div style={{padding: '50px', background: '#111', color: '#fff', height: '100vh', textAlign: 'center'}}>
      <h1>VADĪTĀJA IEEJA</h1>
      {shows.map(s => <button key={s.id} onClick={() => socket.emit('host:create-session', { showId: s.id })} style={{padding: '20px', margin: '10px', display: 'block', width: '100%'}}>{s.title}</button>)}
    </div>
  );

  return (
    <div style={{ padding: '20px', background: '#111', color: '#fff', textAlign: 'center', height: '100vh' }}>
      <h1>SESIJA: {pin}</h1>
      <h2 style={{color: '#007bff'}}>SPIED [ SPACE ] LAI VADĪTU ŠOVU</h2>
      <button onClick={() => window.open(`/present/${pin}`, '_blank')} style={{padding: '10px', background: 'blue', color: 'white'}}>ATVĒRT PROJEKTORU</button>
      <div style={{marginTop: '20px', textAlign: 'left'}}>
        {scenes.map((s, i) => (
          <button key={i} onClick={() => socket.emit('host:next-scene', { pin, scene: s })} style={{display: 'block', width: '100%', padding: '10px', margin: '5px 0', background: currentScene?.id === s.id ? 'green' : '#333', color: 'white'}}>
            {i+1}. {s.title}
          </button>
        ))}
      </div>
    </div>
  );
}