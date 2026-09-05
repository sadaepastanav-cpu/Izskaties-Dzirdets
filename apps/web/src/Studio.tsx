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
  const [activeIdx, setActiveIdx] = useState<number>(0);

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

  const handleConnectFolder = async () => {
    try {
      socket.emit('host:set-project-path', folder);
      await fetch(`${apiBaseUrl}/api/set-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folder })
      });
      refreshMediaList();
    } catch (err) {
      console.error("Kļūda savienojot mapi:", err);
    }
  };

  const addQuizScene = () => {
    const newScene: Scene = {
      id: 'sc-' + Date.now(),
      type: 'QUIZ',
      title: `Slaids ${scenes.length + 1}`,
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
    const newScenes = [...scenes, newScene];
    setScenes(newScenes);
    setActiveIdx(newScenes.length - 1);
  };

  const removeScene = (index: number) => {
    const updated = scenes.filter((_, idx) => idx !== index);
    setScenes(updated);
    if (activeIdx >= updated.length) {
      setActiveIdx(Math.max(0, updated.length - 1));
    }
  };

  const addLayoutElement = (type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'TEXT') => {
    if (scenes.length === 0) return;

    const newElement: LayoutElement = {
      id: Date.now(),
      type,
      content: type === 'TEXT' ? 'Jauns Teksts' : (availableMedia[0] || ''),
      x: 10,
      y: 10,
      w: 40,
      trimStart: 0,
      trimEnd: 30
    };

    const updated = [...scenes];
    if (!updated[activeIdx].config.layout) {
      updated[activeIdx].config.layout = [];
    }
    updated[activeIdx].config.layout.push(newElement);
    setScenes(updated);
  };

  const updateLayoutElement = (elementId: number, key: keyof LayoutElement, value: any) => {
    const updated = [...scenes];
    const layout = updated[activeIdx].config.layout || [];
    const elIndex = layout.findIndex(e => e.id === elementId);
    if (elIndex !== -1) {
      layout[elIndex] = { ...layout[elIndex], [key]: value };
      setScenes(updated);
    }
  };

  const removeLayoutElement = (elementId: number) => {
    const updated = [...scenes];
    updated[activeIdx].config.layout = updated[activeIdx].config.layout.filter(e => e.id !== elementId);
    setScenes(updated);
  };

  const updateSceneConfig = (key: string, value: any) => {
    if (scenes.length === 0) return;
    const updated = [...scenes];
    updated[activeIdx].config = {
      ...updated[activeIdx].config,
      [key]: value
    };
    setScenes(updated);
  };

  const updateSceneMedia = (key: 'url' | 'type', value: string) => {
    if (scenes.length === 0) return;
    const updated = [...scenes];
    const currentMedia = updated[activeIdx].config.media || { url: '', type: 'image' };
    updated[activeIdx].config.media = {
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

  const activeScene = scenes[activeIdx];

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
        
        <h4 style={{ margin: '0 0 5px 0', color: '#aaa' }}>Slaidu saraksts ({scenes.length}):</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {scenes.map((s, i) => (
            <div 
              key={s.id} 
              onClick={() => setActiveIdx(i)}
              style={{ 
                padding: '10px 12px', 
                background: activeIdx === i ? '#007bff' : '#2a2a2a', 
                color: '#fff',
                borderRadius: '4px', 
                fontSize: '0.85rem', 
                cursor: 'pointer',
                display: 'flex', 
                justify: 'space-between', 
                alignItems: 'center' 
              }}
            >
              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <strong>#{i + 1}</strong> {s.config?.question || 'Bez nosaukuma'}
              </span>
              <button 
                onClick={(e) => { e.stopPropagation(); removeScene(i); }} 
                style={{ background: 'transparent', color: '#ff4d4d', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ✖
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* GALVENAIS REDAKTORS UN WYSIWYG LAUKUMS */}
      <div style={{ flex: 1, padding: '30px 40px', overflowY: 'auto' }}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '0.9rem', color: '#aaa' }}>Projekta Nosaukums:</label>
          <input 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
            style={{ display: 'block', width: '100%', background: 'none', color: '#fff', border: 'none', borderBottom: '2px solid #007bff', fontSize: '2rem', padding: '4px 0', outline: 'none' }} 
          />
        </div>

        {activeScene ? (
          <div style={{ background: '#1e1e1e', padding: '24px', borderRadius: '12px', border: '1px solid #333' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: '#007bff' }}>Slaids #{activeIdx + 1} rediģēšana</h3>
            </div>

            {/* SLAIDA PARAMETRI */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', color: '#aaa', fontSize: '0.9rem' }}>Jautājums / Virsraksts:</label>
              <input 
                style={{ width: '100%', padding: '10px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '6px', boxSizing: 'border-box' }} 
                value={activeScene.config.question} 
                onChange={e => updateSceneConfig('question', e.target.value)} 
                placeholder="Ieraksti jautājumu..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '15px', background: '#141414', padding: '12px', borderRadius: '6px' }}>
              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '0.8rem' }}>Fona Bilde:</label>
                <input 
                  style={{ width: '100%', padding: '6px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} 
                  value={activeScene.config.backgroundUrl || ''} 
                  onChange={e => updateSceneConfig('backgroundUrl', e.target.value)}
                  placeholder="fons.jpg" 
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '0.8rem' }}>Taimeris (sek):</label>
                <input 
                  type="number"
                  style={{ width: '100%', padding: '6px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} 
                  value={activeScene.config.duration ?? 30} 
                  onChange={e => updateSceneConfig('duration', parseInt(e.target.value) || 0)} 
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '0.8rem' }}>Trim Sākums (sek):</label>
                <input 
                  type="number"
                  style={{ width: '100%', padding: '6px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} 
                  value={activeScene.config.trimStart ?? 0} 
                  onChange={e => updateSceneConfig('trimStart', parseInt(e.target.value) || 0)} 
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '0.8rem' }}>Trim Beigas (sek):</label>
                <input 
                  type="number"
                  style={{ width: '100%', padding: '6px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '4px', boxSizing: 'border-box' }} 
                  value={activeScene.config.trimEnd ?? 30} 
                  onChange={e => updateSceneConfig('trimEnd', parseInt(e.target.value) || 0)} 
                />
              </div>
            </div>

            {/* POGAS IZKĀRTOJUMA ELEMENTU PIEVIENOŠANAI */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <button onClick={() => addLayoutElement('IMAGE')} style={{ background: '#333', color: '#fff', border: '1px solid #555', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}>+ BILDE</button>
              <button onClick={() => addLayoutElement('VIDEO')} style={{ background: '#333', color: '#fff', border: '1px solid #555', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}>+ VIDEO</button>
              <button onClick={() => addLayoutElement('AUDIO')} style={{ background: '#333', color: '#fff', border: '1px solid #555', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}>+ AUDIO</button>
              <button onClick={() => addLayoutElement('TEXT')} style={{ background: '#333', color: '#fff', border: '1px solid #555', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}>+ TEKSTS</button>
            </div>

            {/* VIZUĀLAIS 16:9 PREZENTĀCIJAS AUDEKLIS (WYSIWYG) */}
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <div style={{ 
                width: '800px', 
                height: '450px', 
                background: activeScene.config.backgroundUrl ? `url(${apiBaseUrl}/project-media/${activeScene.config.backgroundUrl}) center/cover` : '#000', 
                position: 'relative', 
                border: '2px solid #555',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', top: '10px', width: '100%', textAlign: 'center', color: '#fff', textShadow: '0 0 5px black', fontSize: '1.2rem' }}>
                  {activeScene.config.question || 'Jautājuma vieta'}
                </div>

                {activeScene.config.layout?.map((el) => (
                  <div 
                    key={el.id} 
                    style={{ 
                      position: 'absolute', 
                      left: `${el.x}%`, 
                      top: `${el.y}%`, 
                      width: `${el.w}%`, 
                      border: '1px dashed #007bff', 
                      background: 'rgba(0,0,0,0.6)',
                      padding: '4px',
                      borderRadius: '4px',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{ fontSize: '10px', color: '#007bff', fontWeight: 'bold' }}>{el.type}</div>
                    
                    {el.type === 'TEXT' ? (
                      <input 
                        value={el.content} 
                        onChange={e => updateLayoutElement(el.id, 'content', e.target.value)} 
                        style={{ width: '100%', background: '#000', color: '#fff', border: '1px solid #444', fontSize: '12px' }} 
                      />
                    ) : (
                      <select 
                        value={el.content} 
                        onChange={e => updateLayoutElement(el.id, 'content', e.target.value)} 
                        style={{ width: '100%', background: '#000', color: '#fff', border: '1px solid #444', fontSize: '12px' }}
                      >
                        <option value="">-- Fails --</option>
                        {availableMedia.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    )}

                    <div style={{ fontSize: '10px', marginTop: '4px', display: 'flex', gap: '5px' }}>
                      X%: <input type="number" value={el.x} onChange={e => updateLayoutElement(el.id, 'x', parseInt(e.target.value) || 0)} style={{ width: '35px', background: '#000', color: '#fff', border: '1px solid #444' }} />
                      Y%: <input type="number" value={el.y} onChange={e => updateLayoutElement(el.id, 'y', parseInt(e.target.value) || 0)} style={{ width: '35px', background: '#000', color: '#fff', border: '1px solid #444' }} />
                      W%: <input type="number" value={el.w} onChange={e => updateLayoutElement(el.id, 'w', parseInt(e.target.value) || 0)} style={{ width: '35px', background: '#000', color: '#fff', border: '1px solid #444' }} />
                      <button onClick={() => removeLayoutElement(el.id)} style={{ background: '#dc3545', color: '#fff', border: 'none', cursor: 'pointer', padding: '0 4px', borderRadius: '2px' }}>✖</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ATBILŽU VARIANTI */}
            <div>
              <p style={{ fontWeight: 'bold', margin: '10px 0 8px 0', fontSize: '0.9rem' }}>Atbilžu varianti (atzīmē pareizos):</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {activeScene.config.options.map((opt: string, oi: number) => {
                  const isChecked = (activeScene.config.correctAnswers || []).includes(opt);
                  return (
                    <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#141414', padding: '8px', borderRadius: '6px' }}>
                      <input 
                        type="checkbox" 
                        checked={isChecked && opt !== ''}
                        onChange={() => {
                          if (!opt) return;
                          const cur = activeScene.config.correctAnswers || [];
                          const next = cur.includes(opt) ? cur.filter((c: string) => c !== opt) : [...cur, opt];
                          updateSceneConfig('correctAnswers', next);
                        }} 
                      />
                      <input 
                        value={opt} 
                        onChange={e => {
                          const newOpts = [...activeScene.config.options];
                          const oldVal = newOpts[oi];
                          const newVal = e.target.value;
                          newOpts[oi] = newVal;

                          let newCorrect = activeScene.config.correctAnswers || [];
                          if (newCorrect.includes(oldVal)) {
                            newCorrect = newCorrect.map((c: string) => c === oldVal ? newVal : c);
                          }

                          updateSceneConfig('options', newOpts);
                          updateSceneConfig('correctAnswers', newCorrect);
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
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: '#777' }}>
            <h3>Izvēlies slaidu no kreisās puses saraksta vai izveido jaunu!</h3>
          </div>
        )}
      </div>
    </div>
  );
}