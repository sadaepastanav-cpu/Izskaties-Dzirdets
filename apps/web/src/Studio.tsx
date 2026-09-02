import { useState } from 'react';
import { socket } from './socket';

export default function Studio() {
  const [scenes, setScenes] = useState<any[]>([]);
  const [title, setTitle] = useState('Jauns Šovs');
  const [folder, setFolder] = useState('C:/ManiFaili');

  const addQuiz = () => {
    setScenes([...scenes, {
      id: 'sc-' + Date.now(),
      type: 'QUIZ', title: 'Jautājums',
      config: { question: 'Ieraksti jautājumu?', options: ['A','B','C','D','E','F'], correctAnswers: [], duration: 30, backgroundUrl: '' }
    }]);
  };

  const save = async () => {
    await fetch('http://localhost:3000/api/shows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, scenes })
    });
    alert("✅ Saglabāts!");
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#1a1a1a', color: '#fff', fontFamily: 'Arial' }}>
      <div style={{ width: '350px', background: '#252525', padding: '20px', borderRight: '1px solid #444', overflowY: 'auto' }}>
        <h2 style={{color: '#007bff'}}>STUDIO</h2>
        <label>Projekta mape:</label>
        <input value={folder} onChange={e => setFolder(e.target.value)} style={{width: '100%', background: '#000', color: '#fff'}} />
        <button onClick={() => socket.emit('host:set-project-path', folder)} style={{width: '100%', margin: '10px 0', background: '#007bff'}}>🔗 SAISTĪT MAPI</button>
        <button onClick={addQuiz} style={{width: '100%', marginBottom: '10px'}}>+ JAUTĀJUMS</button>
        <button onClick={save} style={{width: '100%', background: '#28a745', fontWeight: 'bold'}}>💾 SAGLABĀT DB</button>
        <hr/>
        {scenes.map((s, i) => <div key={i} style={{padding: '10px', background: '#333', margin: '5px 0'}}>{i+1}. {s.title}</div>)}
      </div>
      <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        <h1>Projekta nosaukums: <input value={title} onChange={e => setTitle(e.target.value)} style={{background: 'none', color: '#fff', border: 'none', borderBottom: '2px solid #007bff'}} /></h1>
        {scenes.map((s, i) => (
          <div key={s.id} style={{ background: '#222', padding: '20px', margin: '20px 0', borderRadius: '15px', border: '1px solid #444' }}>
            <h3>Slaids #{i+1}</h3>
            Jautājums: <input style={{width: '100%'}} value={s.config.question} onChange={e => {const up=[...scenes]; up[i].config.question=e.target.value; setScenes(up);}} />
            <p>Pareizie varianti (atzīmē):</p>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr'}}>
              {s.config.options.map((opt:string, oi:number) => (
                <div key={oi} style={{margin: '5px'}}>
                  <input type="checkbox" onChange={() => {
                    const up=[...scenes];
                    const cur = up[i].config.correctAnswers;
                    up[i].config.correctAnswers = cur.includes(opt) ? cur.filter((c:any)=>c!==opt) : [...cur, opt];
                    setScenes(up);
                  }} />
                  <input value={opt} onChange={e => {const up=[...scenes]; up[i].config.options[oi]=e.target.value; setScenes(up);}} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}