import { useState } from 'react';

export default function Studio() {
  const [scenes, setScenes] = useState<any[]>([]);
  const [title, setTitle] = useState('Mans Jaunais Projekts');

  // Globāls taimera iestatījums visiem slaidiem
  const setGlobalDuration = (seconds: number) => {
    const updated = scenes.map(s => ({
      ...s,
      config: { ...s.config, duration: seconds }
    }));
    setScenes(updated);
  };

  // Globāls fona attēla iestatījums visiem slaidiem
  const setGlobalBackground = (url: string) => {
    const updated = scenes.map(s => ({
      ...s,
      config: { ...s.config, backgroundUrl: url }
    }));
    setScenes(updated);
  };

  // Funkcija jauna jautājuma pievienošanai ar pilnu mediju struktūru
  const addQuiz = () => {
    const newScene = {
      id: 'sc-' + Math.random().toString(36).substring(2, 7),
      type: 'QUIZ',
      title: 'Mūzikas / Video Jautājums',
      config: {
        question: 'Kas izpilda šo darbu?',
        options: ['', '', '', '', '', ''],
        correctAnswers: [],
        duration: 30,
        points: 10,
        backgroundUrl: '/uploads/default_bg.jpg',
        media: {
          url: '',
          type: 'audio', // audio, video, image
          trimStart: 0,
          trimEnd: 0,
          trigger: 'ON_TIMER_START'
        },
        revealMedia: {
          url: '',
          type: 'video',
          trigger: 'ON_REVEAL'
        }
      }
    };
    setScenes([...scenes, newScene]);
  };

  // Funkcija informatīva slaida pievienošanai
  const addText = () => {
    const newScene = {
      id: 'sc-' + Math.random().toString(36).substring(2, 7),
      type: 'TEXT',
      title: 'Informācija',
      config: {
        text: 'Ieraksti tekstu šeit',
        duration: 0,
        backgroundUrl: '',
        media: { url: '', type: 'image' }
      }
    };
    setScenes([...scenes, newScene]);
  };

  const updateOption = (sIdx: number, oIdx: number, val: string) => {
    const updated = [...scenes];
    updated[sIdx].config.options[oIdx] = val;
    setScenes(updated);
  };

  const toggleCorrect = (sIdx: number, opt: string) => {
    const updated = [...scenes];
    const current = updated[sIdx].config.correctAnswers || [];
    if (current.includes(opt)) {
      updated[sIdx].config.correctAnswers = current.filter((c: string) => c !== opt);
    } else {
      updated[sIdx].config.correctAnswers = [...current, opt];
    }
    setScenes(updated);
  };

  const saveProject = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/shows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title, 
          ownerEmail: 'janis@zacs.lv', 
          scenes 
        })
      });
      if (res.ok) alert("✅ Projekts saglabāts! Tagad dodies uz /host");
      else alert("❌ Kļūda saglabājot!");
    } catch (err) {
      alert("❌ Nevarēja pieslēgties serverim!");
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#111', color: '#fff', fontFamily: 'Arial' }}>
      
      {/* KREISĀ PUSE */}
      <div style={{ width: '320px', background: '#222', padding: '20px', borderRight: '1px solid #444', overflowY: 'auto' }}>
        <h2 style={{ color: '#007bff' }}>STUDIO REDAKTORS</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={addQuiz} style={sidebarBtn}>+ JAUTĀJUMS AR MEDIJIEM</button>
          <button onClick={addText} style={sidebarBtn}>+ INFORMĀCIJAS SLAIDS</button>
          <button onClick={saveProject} style={{ ...sidebarBtn, background: '#28a745' }}>💾 SAGLABĀT PROJEKTU</button>
        </div>

        {/* GLOBĀLIE IESTATĪJUMI */}
        <div style={{ marginTop: '25px', padding: '15px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#ffc107' }}>⚙️ Globālie iestatījumi</h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Globālais taimeris */}
            <div style={formGroup}>
              <label style={{ fontSize: '12px', opacity: 0.8 }}>Mainīt taimeri visiem slaidiem (s):</label>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button onClick={() => setGlobalDuration(15)} style={smallBtn}>15s</button>
                <button onClick={() => setGlobalDuration(30)} style={smallBtn}>30s</button>
                <button onClick={() => setGlobalDuration(45)} style={smallBtn}>45s</button>
                <button onClick={() => setGlobalDuration(60)} style={smallBtn}>60s</button>
              </div>
            </div>

            {/* Globālais fons */}
            <div style={formGroup}>
              <label style={{ fontSize: '12px', opacity: 0.8 }}>Kopīgais fona attēla URL:</label>
              <input 
                placeholder="Ielīmē attēla URL..."
                onChange={e => setGlobalBackground(e.target.value)}
                style={{ padding: '6px', background: '#333', border: '1px solid #555', color: '#fff', borderRadius: '4px', fontSize: '12px' }}
              />
            </div>
          </div>
        </div>
        
        <div style={{ marginTop: '25px' }}>
          <h4>Slaidu secība ({scenes.length}):</h4>
          {scenes.map((s, i) => (
            <div key={s.id} style={{ padding: '8px', background: '#333', margin: '5px 0', borderRadius: '4px', fontSize: '14px' }}>
              {i + 1}. {s.title} ({s.type})
            </div>
          ))}
        </div>
      </div>

      {/* LABĀ PUSE */}
      <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        <div style={{ marginBottom: '30px' }}>
          <label>Projekta nosaukums: </label>
          <input 
            style={titleInput} 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
          />
        </div>

        {scenes.length === 0 && <p style={{ opacity: 0.5 }}>Tukšs projekts. Pievieno slaidus no kreisās malas!</p>}

        {scenes.map((s, i) => (
          <div key={s.id} style={sceneCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
               <h3>Slaids #{i + 1} ({s.type})</h3>
               <button onClick={() => setScenes(scenes.filter(sc => sc.id !== s.id))} style={{ background: 'none', color: 'red', border: 'none', cursor: 'pointer' }}>Dzēst</button>
            </div>
            
            {/* Pamata lauki */}
            <div style={formGrid}>
              <div style={formGroup}>
                <label>Slaida virsraksts:</label>
                <input 
                  value={s.title} 
                  onChange={e => {
                    const up = [...scenes]; up[i].title = e.target.value; setScenes(up);
                  }} 
                />
              </div>

              <div style={formGroup}>
                <label>Fona attēla URL:</label>
                <input 
                  value={s.config.backgroundUrl || ''} 
                  onChange={e => {
                    const up = [...scenes]; up[i].config.backgroundUrl = e.target.value; setScenes(up);
                  }} 
                />
              </div>

              <div style={formGroup}>
                <label>Taimeris (s):</label>
                <input 
                  type="number" 
                  value={s.config.duration || 0} 
                  onChange={e => {
                    const up = [...scenes]; up[i].config.duration = parseInt(e.target.value) || 0; setScenes(up);
                  }} 
                />
              </div>

              {s.type === 'QUIZ' && (
                <div style={formGroup}>
                  <label>Punkti par atbildi:</label>
                  <input 
                    type="number" 
                    value={s.config.points || 10} 
                    onChange={e => {
                      const up = [...scenes]; up[i].config.points = parseInt(e.target.value) || 0; setScenes(up);
                    }} 
                  />
                </div>
              )}
            </div>

            {/* Mediju paplašinājuma sekcija */}
            {s.type === 'QUIZ' && (
              <>
                <div style={mediaSection}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#17a2b8' }}>🎵 Pamata Medijs (atskaņošanai jautājuma laikā)</h4>
                  <div style={formGrid}>
                    <div style={formGroup}>
                      <label>Medija URL (.mp3 / .mp4 / attēls):</label>
                      <input 
                        value={s.config.media?.url || ''} 
                        onChange={e => {
                          const up = [...scenes]; 
                          up[i].config.media = { ...up[i].config.media, url: e.target.value }; 
                          setScenes(up);
                        }} 
                      />
                    </div>
                    <div style={formGroup}>
                      <label>Medija tips:</label>
                      <select 
                        value={s.config.media?.type || 'audio'} 
                        onChange={e => {
                          const up = [...scenes]; 
                          up[i].config.media = { ...up[i].config.media, type: e.target.value }; 
                          setScenes(up);
                        }}
                        style={selectStyle}
                      >
                        <option value="audio">Audio</option>
                        <option value="video">Video</option>
                        <option value="image">Attēls</option>
                      </select>
                    </div>
                    <div style={formGroup}>
                      <label>Trigeris:</label>
                      <select 
                        value={s.config.media?.trigger || 'ON_TIMER_START'} 
                        onChange={e => {
                          const up = [...scenes]; 
                          up[i].config.media = { ...up[i].config.media, trigger: e.target.value }; 
                          setScenes(up);
                        }}
                        style={selectStyle}
                      >
                        <option value="ON_TIMER_START">ON_TIMER_START</option>
                        <option value="ON_LOAD">ON_LOAD</option>
                        <option value="MANUAL">MANUAL</option>
                      </select>
                    </div>
                    <div style={formGroup}>
                      <label>Sākt no sekundošanas (trimStart):</label>
                      <input 
                        type="number" 
                        value={s.config.media?.trimStart || 0} 
                        onChange={e => {
                          const up = [...scenes]; 
                          up[i].config.media = { ...up[i].config.media, trimStart: parseInt(e.target.value) || 0 }; 
                          setScenes(up);
                        }} 
                      />
                    </div>
                    <div style={formGroup}>
                      <label>Beigt sekundē (trimEnd):</label>
                      <input 
                        type="number" 
                        value={s.config.media?.trimEnd || 0} 
                        onChange={e => {
                          const up = [...scenes]; 
                          up[i].config.media = { ...up[i].config.media, trimEnd: parseInt(e.target.value) || 0 }; 
                          setScenes(up);
                        }} 
                      />
                    </div>
                  </div>
                </div>

                {/* Reveal Media sekcija */}
                <div style={{ ...mediaSection, borderColor: 'gold' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: 'gold' }}>🌟 Atbildes Atklāšanas Medijs (revealMedia)</h4>
                  <div style={formGrid}>
                    <div style={formGroup}>
                      <label>Atklāšanas Medija URL:</label>
                      <input 
                        value={s.config.revealMedia?.url || ''} 
                        onChange={e => {
                          const up = [...scenes]; 
                          up[i].config.revealMedia = { ...up[i].config.revealMedia, url: e.target.value }; 
                          setScenes(up);
                        }} 
                      />
                    </div>
                    <div style={formGroup}>
                      <label>Atklāšanas Medija tips:</label>
                      <select 
                        value={s.config.revealMedia?.type || 'video'} 
                        onChange={e => {
                          const up = [...scenes]; 
                          up[i].config.revealMedia = { ...up[i].config.revealMedia, type: e.target.value }; 
                          setScenes(up);
                        }}
                        style={selectStyle}
                      >
                        <option value="video">Video</option>
                        <option value="audio">Audio</option>
                        <option value="image">Attēls</option>
                      </select>
                    </div>
                    <div style={formGroup}>
                      <label>Trigeris:</label>
                      <input 
                        disabled 
                        value={s.config.revealMedia?.trigger || 'ON_REVEAL'} 
                        style={{ opacity: 0.6 }}
                      />
                    </div>
                  </div>
                </div>

                {/* Jautājumu & Atbilžu opcijas */}
                <div style={{ marginTop: '20px', borderTop: '1px solid #444', paddingTop: '20px' }}>
                  <label>Jautājums dalībniekiem:</label>
                  <textarea 
                    style={{ width: '100%', minHeight: '60px', margin: '10px 0', background: '#333', color: '#fff', border: '1px solid #555' }}
                    value={s.config.question}
                    onChange={e => {
                      const up = [...scenes]; up[i].config.question = e.target.value; setScenes(up);
                    }}
                  />

                  <p><strong>Atbilžu varianti (atzīmē pareizos):</strong></p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    {s.config.options.map((opt: string, oi: number) => (
                      <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#333', padding: '10px', borderRadius: '8px' }}>
                        <input 
                          type="checkbox" 
                          checked={s.config.correctAnswers?.includes(opt) && opt !== ''} 
                          onChange={() => toggleCorrect(i, opt)}
                        />
                        <input 
                          placeholder={`Variants ${oi + 1}`}
                          value={opt}
                          onChange={e => updateOption(i, oi, e.target.value)}
                          style={{ flex: 1, background: '#444', border: '1px solid #555', color: '#fff', padding: '5px' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {s.type === 'TEXT' && (
              <div style={{ ...formGroup, marginTop: '15px' }}>
                <label>Informācijas teksts:</label>
                <textarea 
                  style={{ width: '100%', minHeight: '100px', background: '#333', color: '#fff', border: '1px solid #555' }}
                  value={s.config.text}
                  onChange={e => {
                    const up = [...scenes]; up[i].config.text = e.target.value; setScenes(up);
                  }}
                />
              </div>
            )}
          </div>
        ))}
        <div style={{ height: '100px' }}></div>
      </div>
    </div>
  );
}

// STILI
const sidebarBtn = { padding: '12px', cursor: 'pointer', border: 'none', borderRadius: '6px', fontWeight: 'bold' as any, fontSize: '14px' };
const smallBtn = { flex: 1, padding: '6px', background: '#444', color: '#fff', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' };
const titleInput = { background: 'none', border: 'none', borderBottom: '2px solid #007bff', color: '#fff', fontSize: '2rem', width: '100%', outline: 'none' };
const sceneCard = { background: '#222', padding: '25px', borderRadius: '15px', border: '1px solid #444', marginBottom: '30px', boxShadow: '0 10px 20px rgba(0,0,0,0.3)' };
const formGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginTop: '10px' };
const formGroup: any = { display: 'flex', flexDirection: 'column', gap: '5px' };
const mediaSection = { marginTop: '20px', padding: '15px', background: '#1a1a1a', borderRadius: '10px', border: '1px solid #333' };
const selectStyle = { padding: '8px', background: '#444', border: '1px solid #555', color: '#fff', borderRadius: '4px' };