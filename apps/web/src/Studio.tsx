import { useState, useEffect } from 'react';

export default function Studio() {
  const [title, setTitle] = useState('Mans Jaunais Šovs');
  const [scenes, setScenes] = useState<any[]>([]);

  const addScene = (type: 'TEXT' | 'QUIZ' | 'VOTE') => {
    const newScene = {
      id: 'sc_' + Math.random().toString(36).substr(2, 5),
      type,
      title: type === 'QUIZ' ? 'Jautājums' : 'Informācija',
      config: {
        text: 'Ieraksti tekstu šeit',
        question: 'Ieraksti jautājumu?',
        options: ['Variants A', 'Variants B'],
        correctAnswer: 'Variants A',
        duration: 20
      }
    };
    setScenes([...scenes, newScene]);
  };

  const saveShow = async () => {
    const email = 'janis@zacs.lv'; // Tavs admin epasts
    await fetch('http://localhost:3000/api/shows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, ownerEmail: email, scenes })
    });
    alert('Spēle saglabāta datubāzē!');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', color: 'white', fontFamily: 'Arial' }}>
      {/* Kreisā puse: Slaidu saraksts */}
      <div style={{ width: '250px', background: '#222', padding: '20px', borderRight: '1px solid #444' }}>
        <h3>Ainas (Slaidi)</h3>
        {scenes.map((s, i) => (
          <div key={s.id} style={{ padding: '10px', background: '#333', margin: '5px 0', borderRadius: '5px', cursor: 'pointer' }}>
            {i + 1}. {s.title}
          </div>
        ))}
        <hr />
        <button onClick={() => addScene('TEXT')}>+ Teksts</button>
        <button onClick={() => addScene('QUIZ')}>+ Jautājums</button>
        <button onClick={saveShow} style={{ background: 'green', marginTop: '20px', width: '100%' }}>SAGLABĀT ŠOVU</button>
      </div>

      {/* Labā puse: Rediģēšana */}
      <div style={{ flex: 1, padding: '40px', background: '#1a1a1a' }}>
        <h1>Šova nosaukums: <input value={title} onChange={e => setTitle(e.target.value)} /></h1>
        {scenes.length === 0 && <p>Pievieno pirmo ainu no saraksta kreisajā pusē!</p>}
        {scenes.map((s, idx) => (
          <div key={s.id} style={{ background: '#282828', padding: '20px', marginBottom: '20px', borderRadius: '10px' }}>
             <h3>Rediģēt {idx + 1}. ainu: {s.type}</h3>
             Virsraksts: <input value={s.title} onChange={e => {
                const newScenes = [...scenes];
                newScenes[idx].title = e.target.value;
                setScenes(newScenes);
             }} />
             {/* Šeit Tu vari pievienot vēl laukus Taimerim, Variantiem utt. */}
          </div>
        ))}
      </div>
    </div>
  );
}