import { useState, useEffect } from 'react';
import { socket } from './socket';

interface LayoutElement {
  id: number;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'TEXT';
  content: string;
  x: number;
  y: number;
  w: number;
  trimStart: number;
  trimEnd: number;
}

interface Scene {
  id: string;
  type: string;
  title: string;
  config: {
    question: string;
    options: string[];
    correctAnswers: string[];
    duration: number;
    backgroundUrl: string;
    media?: {
      url: string;
      type: 'image' | 'video' | 'audio';
    };
    trimStart?: number;
    trimEnd?: number;
    layout: LayoutElement[];
  };
}

export default function Studio() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [title, setTitle] = useState('Mans_Slovs');
  const [folder, setFolder] = useState('C:/ManiSovi');
  const [availableMedia, setAvailableMedia] = useState<string[]>([]);

  const apiHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const apiBaseUrl = `http://${apiHost}:3000`;

  useEffect(() => {
    socket.on('media-list', (files: string[]) => {
      if (Array.isArray(files)) {
        setAvailableMedia(files);
      }
    });

    refreshMediaList();

    return () => {
      socket.off('media-list');
    };
  }, []);

  const refreshMediaList = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/media-list`);
      if (res.ok) {
        const files = await res.json();
        if (Array.isArray(files)) {
          setAvailableMedia(files);
        }
      }
      socket.emit('get-media-list');
    } catch (err) {
      console.error("Neizdevās ielādēt mediju sarakstu:", err);
    }
  };

  const handleConnectFolder = () => {
    socket.emit('host:set-project-path', folder);
    refreshMediaList();
  };

  const addQuizScene = () => {
    const newScene: Scene = {
      id: 'sc-' + Date.now(),
      type: 'QUIZ',
      title: 'Jautājums',
      config: {
        question: '',
        options: ['', '', '', '', '', ''],
        correctAnswers: [],
        duration: 30,
        backgroundUrl: '',
        trimStart: 0,
        trimEnd: 30,
        media: { url: '', type: 'image' },
        layout: []
      }
    };
    setScenes([...scenes, newScene]);
  };

  const addLayoutElementPrompt = (sceneIndex: number, type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'TEXT') => {
    const defaultVal = type === 'TEXT' ? 'Ieraksti tekstu' : (availableMedia[0] || '');
    const userInput = prompt(type === 'TEXT' ? 'Ievadi tekstu:' : 'Ievadi faila nosaukumu:', defaultVal);
    
    if (userInput === null) return;

    const newElement: LayoutElement = {
      id: Date.now(),
      type,
      content: userInput,
      x: 10,
      y: 10,
      w: 40,
      trimStart: 0,
      trimEnd: 30
    };

    const updated = [...scenes];
    if (!updated[sceneIndex].config.layout) {
      updated[sceneIndex].config.layout = [];
    }
    updated[sceneIndex].config.layout.push(newElement);
    setScenes(updated);
  };

  const updateLayoutElement = (sceneIndex: number, elementId: number, key: keyof LayoutElement, value: any) => {
    const updated = [...scenes];
    const layout = updated[sceneIndex].config.layout || [];
    const elIndex = layout.findIndex(e => e.id === elementId);
    if (elIndex !== -1) {
      layout[elIndex] = { ...layout[elIndex], [key]: value };
      setScenes(updated);
    }
  };

  const removeLayoutElement = (sceneIndex: number, elementId: number) => {
    const updated = [...scenes];
    updated[sceneIndex].config.layout = updated[sceneIndex].config.layout.filter(e => e.id !== elementId);
    setScenes(updated);
  };

  const updateSceneConfig = (sceneIndex: number, key: string, value: any) => {
    const updated = [...scenes];
    updated[sceneIndex].config = {
      ...updated[sceneIndex].config,
      [key]: value
    };
    setScenes(updated);
  };

  const updateSceneMedia = (sceneIndex: number, key: 'url' | 'type', value: string) => {
    const updated = [...scenes];
    const currentMedia = updated[sceneIndex].config.media || { url: '', type: 'image' };
    updated[sceneIndex].config.media = {
      ...currentMedia,
      [key]: value
    };
    setScenes(updated);
  };

  const saveToFile = async () => {
    try {
      socket.emit('host:set-project-path', folder);

      await fetch(`${apiBaseUrl}/api/set-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folder })
      });

      const res = await fetch(`${apiBaseUrl}/api/save-to-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: title + '.json', data: { title, scenes } })
      });

      if (res.ok) {
        alert("✅ SAGLABĀTS FAILĀ! Mape: " + folder);
      } else {
        alert("❌ Kļūda saglabājot failu!");
      }
    } catch (err) {
      console.error("Faila saglabāšanas kļūda:", err);
      alert("❌ Neizdevās savienoties ar serveri.");
    }
  };

  const saveToDb = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/shows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, scenes })
      });
      if (res.ok) alert("✅ Saglabāts DB!");
      else alert("❌ Kļūda saglabājot DB!");
    } catch (err) {
      console.error("Saglabāšanas kļūda:", err);
      alert("❌ Neizdevās savienoties ar serveri.");
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#111', color: '#fff', fontFamily: 'Arial, sans-serif' }}>
      
      {/* SĀNU PANELIS */}
      <div style={{ width: '360px', background: '#1e1e1e', padding: '20px', borderRight: '1px solid #333', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <h2 style={{ color: '#007bff', margin: 0 }}>STUDIO BUILDER</h2>
        
        <div>
          <label style={{ fontSize: '0.85rem', color: '#aaa', display: 'block', marginBottom: '4px' }}>Projekta mape uz datora:</label>
          <input 
            value={folder} 
            onChange={e => setFolder(e.target.value)} 
            style={{ width: '100%', background: '#000', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '4px', boxSizing: 'border-box' }} 
          />
        </div>
        
        <button 
          onClick={handleConnectFolder} 
          style={{ background: '#007bff', color: '#fff', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          🔗 SAISTĪT MAPI
        </button>

        <button 
          onClick={refreshMediaList} 
          style={{ background: '#444', color: '#fff', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}
        >
          🔄 Atsvaidzināt failus ({availableMedia.length})
        </button>

        <hr style={{ borderColor: '#333', width: '100%', margin: '5px 0' }} />

        <button 
          onClick={addQuizScene} 
          style={{ background: '#28a745', color: '#fff', border: 'none', padding: '12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}
        >
          + JAUNS SLAIDS
        </button>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button 
            onClick={saveToFile} 
            style={{ background: '#17a2b8', color: '#fff', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            📁 SAGLABĀT FAILĀ
          </button>
          
          <button 
            onClick={saveToDb} 
            style={{ background: '#6c757d', color: '#fff', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            💾 DB
          </button>
        </div>

        <hr style={{ borderColor: '#333', width: '100%', margin: '5px 0' }} />
        
        <h4 style={{ margin: '0 0 5px 0', color: '#aaa' }}>Slaidu pārskats ({scenes.length}):</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {scenes.map((s, i) => (
            <div key={s.id} style={{ padding: '8px 12px', background: '#2a2a2a', borderRadius: '4px', fontSize: '0.85rem', borderLeft: '4px solid #007bff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><strong>#{i + 1}</strong> {s.config?.question || 'Bez nosaukuma'}</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => addLayoutElementPrompt(i, 'IMAGE')} style={{ background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '3px', cursor: 'pointer', padding: '2px 5px' }}>+🖼️</button>
                <button onClick={() => addLayoutElementPrompt(i, 'VIDEO')} style={{ background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '3px', cursor: 'pointer', padding: '2px 5px' }}>+🎬</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* GALVENAIS SATURA REDAKTORS */}
      <div style={{ flex: 1, padding: '30px 40px', overflowY: 'auto' }}>
        <div style={{ marginBottom: '30px' }}>
          <label style={{ fontSize: '0.9rem', color: '#aaa' }}>Projekta Nosaukums:</label>
          <input 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
            style={{ display: 'block', width: '100%', background: 'none', color: '#fff', border: 'none', borderBottom: '2px solid #007bff', fontSize: '2rem', padding: '4px 0', outline: 'none' }} 
          />
        </div>

        {scenes.map((s, i) => (
          <div key={s.id} style={{ background: '#1e1e1e', padding: '24px', marginBottom: '30px', borderRadius: '12px', border: '1px solid #333' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: '#007bff' }}>Slaids #{i + 1} ({s.type})</h3>
              <button 
                onClick={() => setScenes(scenes.filter((_, idx) => idx !== i))}
                style={{ background: '#dc3545', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
              >
                Dzēst Slaidu
              </button>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', color: '#aaa', fontSize: '0.9rem' }}>Jautājums:</label>
              <input 
                style={{ width: '100%', padding: '10px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '6px', boxSizing: 'border-box' }} 
                value={s.config.question} 
                onChange={e => updateSceneConfig(i, 'question', e.target.value)} 
                placeholder="Ieraksti jautājumu..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '15px', background: '#141414', padding: '12px', borderRadius: '6px' }}>
              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '0.8rem' }}>Fona Bilde:</label>
                <input 
                  style={{ width: '100%', padding: '6px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} 
                  value={s.config.backgroundUrl || ''} 
                  onChange={e => updateSceneConfig(i, 'backgroundUrl', e.target.value)}
                  placeholder="fons.jpg" 
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '0.8rem' }}>Taimeris (sek):</label>
                <input 
                  type="number"
                  style={{ width: '100%', padding: '6px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} 
                  value={s.config.duration ?? 30} 
                  onChange={e => updateSceneConfig(i, 'duration', parseInt(e.target.value) || 0)} 
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '0.8rem' }}>Trim Sākums (sek):</label>
                <input 
                  type="number"
                  style={{ width: '100%', padding: '6px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} 
                  value={s.config.trimStart ?? 0} 
                  onChange={e => updateSceneConfig(i, 'trimStart', parseInt(e.target.value) || 0)} 
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '0.8rem' }}>Trim Beigas (sek):</label>
                <input 
                  type="number"
                  style={{ width: '100%', padding: '6px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} 
                  value={s.config.trimEnd ?? 30} 
                  onChange={e => updateSceneConfig(i, 'trimEnd', parseInt(e.target.value) || 0)} 
                />
              </div>
            </div>

            <div style={{ background: '#141414', padding: '12px', borderRadius: '6px', marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '0.85rem' }}>🖼️ Galvenais Mediju Fails:</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <select 
                  value={s.config.media?.url || ''} 
                  onChange={(e) => updateSceneMedia(i, 'url', e.target.value)}
                  style={{ flex: 2, padding: '8px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}
                >
                  <option value="">-- Izvēlies failu no mapes --</option>
                  {availableMedia.map(file => (
                    <option key={file} value={file}>{file}</option>
                  ))}
                </select>

                <select 
                  value={s.config.media?.type || 'image'} 
                  onChange={(e) => updateSceneMedia(i, 'type', e.target.value as any)}
                  style={{ flex: 1, padding: '8px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}
                >
                  <option value="image">Attēls (IMAGE)</option>
                  <option value="video">Video (VIDEO)</option>
                  <option value="audio">Audio (AUDIO)</option>
                </select>
              </div>
            </div>

            <div style={{ background: '#141414', padding: '12px', borderRadius: '6px', marginBottom: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#aaa' }}>Papildu Izkārtojuma Elementi:</span>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button onClick={() => addLayoutElementPrompt(i, 'IMAGE')} style={{ background: '#333', color: '#fff', border: '1px solid #555', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>+ Bilde</button>
                  <button onClick={() => addLayoutElementPrompt(i, 'VIDEO')} style={{ background: '#333', color: '#fff', border: '1px solid #555', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>+ Video</button>
                  <button onClick={() => addLayoutElementPrompt(i, 'AUDIO')} style={{ background: '#333', color: '#fff', border: '1px solid #555', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>+ Audio</button>
                  <button onClick={() => addLayoutElementPrompt(i, 'TEXT')} style={{ background: '#333', color: '#fff', border: '1px solid #555', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>+ Teksts</button>
                </div>
              </div>

              {s.config.layout && s.config.layout.map((el) => (
                <div key={el.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 70px 70px 60px', gap: '8px', alignItems: 'center', background: '#222', padding: '8px', borderRadius: '4px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#007bff' }}>{el.type}</span>

                  {el.type === 'TEXT' ? (
                    <input 
                      value={el.content} 
                      onChange={e => updateLayoutElement(i, el.id, 'content', e.target.value)} 
                      style={{ background: '#000', color: '#fff', border: '1px solid #444', padding: '4px', borderRadius: '3px' }} 
                    />
                  ) : (
                    <select 
                      value={el.content} 
                      onChange={e => updateLayoutElement(i, el.id, 'content', e.target.value)}
                      style={{ background: '#000', color: '#fff', border: '1px solid #444', padding: '4px', borderRadius: '3px' }}
                    >
                      <option value="">-- Fails --</option>
                      {availableMedia.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  )}

                  <input 
                    type="number" 
                    placeholder="Sākum. sek" 
                    title="Trim Sākums"
                    value={el.trimStart} 
                    onChange={e => updateLayoutElement(i, el.id, 'trimStart', parseInt(e.target.value) || 0)} 
                    style={{ background: '#000', color: '#fff', border: '1px solid #444', padding: '4px', borderRadius: '3px' }} 
                  />

                  <input 
                    type="number" 
                    placeholder="Beigu sek" 
                    title="Trim Beigas"
                    value={el.trimEnd} 
                    onChange={e => updateLayoutElement(i, el.id, 'trimEnd', parseInt(e.target.value) || 0)} 
                    style={{ background: '#000', color: '#fff', border: '1px solid #444', padding: '4px', borderRadius: '3px' }} 
                  />

                  <button 
                    onClick={() => removeLayoutElement(i, el.id)} 
                    style={{ background: '#dc3545', color: '#fff', border: 'none', padding: '4px', borderRadius: '3px', cursor: 'pointer' }}
                  >
                    ✖
                  </button>
                </div>
              ))}
            </div>

            <div>
              <p style={{ fontWeight: 'bold', margin: '10px 0 8px 0', fontSize: '0.9rem' }}>Atbilžu varianti (atzīmē pareizos):</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {s.config.options.map((opt: string, oi: number) => {
                  const isChecked = (s.config.correctAnswers || []).includes(opt);
                  return (
                    <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#141414', padding: '8px', borderRadius: '6px' }}>
                      <input 
                        type="checkbox" 
                        checked={isChecked && opt !== ''}
                        onChange={() => {
                          if (!opt) return;
                          const cur = s.config.correctAnswers || [];
                          const next = cur.includes(opt) ? cur.filter((c: string) => c !== opt) : [...cur, opt];
                          updateSceneConfig(i, 'correctAnswers', next);
                        }} 
                      />
                      <input 
                        value={opt} 
                        onChange={e => {
                          const newOpts = [...s.config.options];
                          const oldVal = newOpts[oi];
                          const newVal = e.target.value;
                          newOpts[oi] = newVal;

                          let newCorrect = s.config.correctAnswers || [];
                          if (newCorrect.includes(oldVal)) {
                            newCorrect = newCorrect.map((c: string) => c === oldVal ? newVal : c);
                          }

                          const updated = [...scenes];
                          updated[i].config = {
                            ...updated[i].config,
                            options: newOpts,
                            correctAnswers: newCorrect
                          };
                          setScenes(updated);
                        }} 
                        placeholder={`Opcija ${String.fromCharCode(65 + oi)}`}
                        style={{ flex: 1, background: '#000', color: '#fff', border: '1px solid #444', padding: '6px', borderRadius: '4px' }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}