import { useState, useEffect } from 'react';
import { socket } from './socket';

export default function Host() {
  const [pin, setPin] = useState<string | null>(localStorage.getItem('active_pin'));
  const [scenes, setScenes] = useState<any[]>([]);
  const [currentScene, setCurrentScene] = useState<any>(null);
  const [folder, setFolder] = useState('C:/ManiSovi');
  const [localProjects, setLocalProjects] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Skenēt mapi un atgriezt pieejamos .json projektus
  const loadProjects = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`http://${window.location.hostname}:3000/api/set-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folder })
      });
      const data = await res.json();
      if (Array.isArray(data.projects)) {
        setLocalProjects(data.projects);
      }
    } catch (err) {
      console.error("Neizdevās ielādēt projektus no mapes:", err);
      alert("❌ Kļūda piekļūstot mapei!");
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Ielādēt izvēlēto projektu un sākt sesiju (Atjaunotā un uzlabotā versija)
  const startProject = async (fileName: string) => {
    try {
      setIsLoading(true);
      const res = await fetch(`http://${window.location.hostname}:3000/api/projects/${fileName}`);
      if (!res.ok) throw new Error("Neizdevās ielādēt projekta failu");

      const projectData = await res.json();
      console.log("Ielādēts projekts:", projectData);
      socket.emit('host:create-session', { projectData });
    } catch (err) {
      console.error("Projekta palaišanas kļūda:", err);
      alert("❌ Neizdevās ielādēt projektu! Pārbaudi faila saturu.");
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Sesijas beigšana un atiestatīšana
  const handleEndSession = () => {
    setPin(null);
    setCurrentScene(null);
    setScenes([]);
    localStorage.removeItem('active_pin');
  };

  // Socket un klaviatūras klausītāji
  useEffect(() => {
    const handleSessionInfo = (data: any) => {
      setPin(data.pin);
      setScenes(data.state?.scenes || []);
      setCurrentScene(data.state?.currentScene);
      localStorage.setItem('active_pin', data.pin);
    };

    const handleStateUpdate = (s: any) => {
      setCurrentScene(s);
    };

    socket.on('session-info', handleSessionInfo);
    socket.on('state-update', handleStateUpdate);

    // Space taustiņa vadība slaidu virzīšanai uz priekšu
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && pin) {
        if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
        e.preventDefault();
        socket.emit('host:advance', pin);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      socket.off('session-info', handleSessionInfo);
      socket.off('state-update', handleStateUpdate);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pin]);

  // --- SKATS 1: JA SESIJA NAV SĀKTA (Projektu izvēle) ---
  if (!pin) {
    return (
      <div style={{ padding: '50px', background: '#111', color: '#fff', minHeight: '100vh', fontFamily: 'Arial, sans-serif', textAlign: 'center', boxSizing: 'border-box' }}>
        <h1 style={{ color: '#007bff', marginBottom: '30px' }}>VADĪTĀJA KONTROLES PANELIS</h1>
        
        <div style={{ maxWidth: '500px', margin: '0 auto', background: '#222', padding: '30px', borderRadius: '12px', border: '1px solid #444' }}>
          <h3>📂 ATVĒRT PROJEKTU NO MAPES</h3>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <input 
              value={folder} 
              onChange={e => setFolder(e.target.value)} 
              placeholder="C:/ManiSovi"
              style={{ flex: 1, padding: '10px', background: '#000', color: '#fff', border: '1px solid #555', borderRadius: '6px' }}
            />
            <button 
              onClick={loadProjects} 
              disabled={isLoading}
              style={{ padding: '10px 20px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {isLoading ? 'IELĀDĒ...' : 'SKENĒT'}
            </button>
          </div>

          <div style={{ marginTop: '20px', textAlign: 'left' }}>
            <h4 style={{ color: '#aaa', borderBottom: '1px solid #444', paddingBottom: '8px' }}>Pieejamie projekti:</h4>
            {localProjects.length === 0 && (
              <p style={{ color: '#666', fontStyle: 'italic' }}>Nav atrasts neviens .json projekta fails. Ievadiet ceļu un uzspiediet "SKENĒT".</p>
            )}
            
            {localProjects.map(p => (
              <button 
                key={p} 
                onClick={() => startProject(p)} 
                disabled={isLoading}
                style={{ 
                  display: 'block', 
                  width: '100%', 
                  padding: '12px', 
                  margin: '8px 0', 
                  background: '#333', 
                  color: '#fff', 
                  border: '1px solid #555', 
                  borderRadius: '6px', 
                  textAlign: 'left', 
                  cursor: isLoading ? 'not-allowed' : 'pointer', 
                  fontWeight: 'bold',
                  opacity: isLoading ? 0.6 : 1
                }}
              >
                📄 {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- SKATS 2: AKTĪVĀ SESIJA UN VADĪBA ---
  return (
    <div style={{ padding: '30px', background: '#111', color: '#fff', minHeight: '100vh', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box' }}>
      {/* Augšējā josla */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#222', padding: '15px 25px', borderRadius: '10px', border: '1px solid #444', marginBottom: '20px' }}>
        <div>
          <span style={{ fontSize: '1.2rem', color: '#aaa' }}>Aktīvā sesija: </span>
          <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#28a745', marginLeft: '10px' }}>PIN: {pin}</span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => window.open(`/present/${pin}`, '_blank')} 
            style={{ padding: '10px 20px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            🖥️ ATVĒRT PROJEKTORU
          </button>
          
          <button 
            onClick={handleEndSession} 
            style={{ padding: '10px 15px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ❌ BEIGT SESIJU
          </button>
        </div>
      </div>

      {/* Instrukcija un pašreizējā stāvokļa rādītājs */}
      <div style={{ background: '#004085', color: '#b8daff', padding: '15px', borderRadius: '8px', textAlign: 'center', marginBottom: '20px', border: '1px solid #b8daff' }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '5px' }}>
          ⌨️ SPIED [ SPACE ] TAUSTIŅU, LAI VADĪTU ŠOVA NORISI
        </div>
        <div style={{ fontSize: '0.95rem', opacity: 0.9 }}>
          Aktuālā aina: <strong>{currentScene?.title || "Nav sākts"}</strong> | Stāvoklis: <strong>{currentScene?.subState || "IDLE"}</strong>
        </div>
      </div>

      {/* Slaidu saraksts */}
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h3 style={{ borderBottom: '1px solid #444', paddingBottom: '10px' }}>Slaidu secība:</h3>
        {scenes.map((s, i) => {
          const isActive = currentScene?.id === s.id;
          return (
            <button 
              key={s.id || i} 
              onClick={() => socket.emit('host:next-scene', { pin, scene: s })} 
              style={{ 
                display: 'block', 
                width: '100%', 
                padding: '15px', 
                margin: '10px 0', 
                background: isActive ? '#28a745' : '#222', 
                color: '#fff', 
                border: isActive ? '2px solid #fff' : '1px solid #444', 
                borderRadius: '8px', 
                textAlign: 'left', 
                cursor: 'pointer',
                fontSize: '1.1rem',
                fontWeight: isActive ? 'bold' : 'normal',
                transition: 'all 0.2s'
              }}
            >
              {i + 1}. {s.config?.question || s.title || `Slaids #${i + 1}`} 
              {isActive && (
                <span style={{ float: 'right', background: '#fff', color: '#28a745', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                  AKTĪVS ({currentScene?.subState || 'IDLE'})
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}