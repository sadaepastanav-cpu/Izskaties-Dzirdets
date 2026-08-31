import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { socket } from './socket';
import Host from './Host'; // Vadītāja pults
import Presentation from './Presentation'; // Prezentācijas skats
import Timer from './Timer'; // Taimera komponents
import Studio from './Studio'; // Importē jauno failu

const btnStyle = { 
  display: 'block', 
  width: '100%', 
  padding: '15px', 
  margin: '10px 0', 
  fontSize: '18px', 
  cursor: 'pointer',
  borderRadius: '8px',
  border: '1px solid #ccc'
};

const inputStyle = { 
  display: 'block', 
  width: '100%', 
  padding: '15px', 
  fontSize: '18px', 
  borderRadius: '8px', 
  border: '1px solid #ccc', 
  textAlign: 'center' as const,
  boxSizing: 'border-box' as const
};

// --- SPĒLĒTĀJA SKATS ---
function Player() {
  const [scene, setScene] = useState<any>(null);
  const [pin, setPin] = useState(localStorage.getItem('player_pin') || '');
  const [name, setName] = useState(localStorage.getItem('player_name') || '');
  const [playerId] = useState(() => {
    let id = localStorage.getItem('player_id');
    if (!id) {
      id = Math.random().toString(36).substring(2, 9);
      localStorage.setItem('player_id', id);
    }
    return id;
  });
  const [isJoined, setIsJoined] = useState(false);
  const [myChoice, setMyChoice] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isRevealed, setIsRevealed] = useState(false);
  const [correctAnswers, setCorrectAnswers] = useState<string[]>([]);

  useEffect(() => {
    if (name && pin && !isJoined) {
      socket.emit('join-session', { pin, name, playerId });
    }

    socket.on('join-success', () => {
      setIsJoined(true);
      localStorage.setItem('player_pin', pin);
      localStorage.setItem('player_name', name);
    });

    socket.on('state-update', (newScene: any) => {
      setScene(newScene);
      setMyChoice(null);
      setSelectedOptions([]);
      setIsRevealed(false);
      setCorrectAnswers([]);
    });

    socket.on('results-revealed', (data?: { correctAnswers?: string[], correctAnswer?: string }) => {
      setIsRevealed(true);
      if (data?.correctAnswers) {
        setCorrectAnswers(data.correctAnswers);
      } else if (data?.correctAnswer) {
        setCorrectAnswers([data.correctAnswer]);
      }
    });

    return () => { 
      socket.off('join-success'); 
      socket.off('state-update'); 
      socket.off('results-revealed'); 
    };
  }, [pin, name, playerId, isJoined]);

  const handleJoin = () => {
    if (!pin || !name) return alert("Ievadi PIN un Vārdu!");
    socket.emit('join-session', { pin, name, playerId });
  };

  const handleVoteSubmit = (option: string) => {
    setMyChoice(option);
    socket.emit('participant:submit-vote', { pin, sceneId: scene?.id, optionId: option, playerId });
  };

  const toggleOption = (opt: string) => {
    // Noteicam maksimālo atļauto izvēļu skaitu (balstoties uz pareizo atbilžu skaistu vai noklusējumu 2)
    const maxAllowed = scene?.config?.correctAnswers?.length || 2;

    if (selectedOptions.includes(opt)) {
      setSelectedOptions(selectedOptions.filter(o => o !== opt));
    } else {
      if (selectedOptions.length < maxAllowed) {
        setSelectedOptions([...selectedOptions, opt]);
      }
    }
  };

  const submitMultiAnswer = () => {
    if (selectedOptions.length === 0) return;
    socket.emit('participant:submit-answer', { pin, answers: selectedOptions, playerId });
    setMyChoice('submitted');
  };

  const handleLeave = () => {
    localStorage.removeItem('player_pin');
    localStorage.removeItem('player_name');
    setIsJoined(false);
    window.location.reload();
  };

  const renderPlayerMedia = (scene: any) => {
    if (!scene?.config?.mediaUrl) return null;
    const { mediaUrl, mediaType } = scene.config;

    const style: React.CSSProperties = {
      width: '100%',
      maxHeight: '25vh',
      borderRadius: '10px',
      marginBottom: '15px',
      objectFit: 'cover'
    };

    if (mediaType === 'image') return <img src={mediaUrl} style={style} alt="Ainas medijs" />;
    if (mediaType === 'video') return <video src={mediaUrl} style={style} controls />;
    return null;
  };

  // Pareizo atbilžu saraksts (no ainas konfigurācijas vai servera notikuma)
  const activeCorrectAnswers: string[] = correctAnswers.length > 0 
    ? correctAnswers 
    : (scene?.config?.correctAnswers || (scene?.config?.correctAnswer ? [scene.config.correctAnswer] : []));

  // Pārbaudām, cik daudz no spēlētāja izvēlētajām atbildēm ir pareizas
  const guessedCorrectCount = selectedOptions.filter(opt => activeCorrectAnswers.includes(opt)).length;
  const isFullyCorrect = guessedCorrectCount === activeCorrectAnswers.length && selectedOptions.length === activeCorrectAnswers.length;
  const isPartiallyCorrect = guessedCorrectCount > 0 && !isFullyCorrect;

  // 1. PIN un Vārda ievades ekrāns
  if (!isJoined) {
    return (
      <div style={{ padding: '50px 20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h1 style={{ color: '#007bff' }}>IZSKATIES DZIRDĒTS</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '320px', margin: '30px auto 0' }}>
          <input 
            placeholder="Tavs Vārds" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            style={inputStyle}
          />
          <input 
            placeholder="PIN Kods" 
            value={pin} 
            onChange={e => setPin(e.target.value)} 
            style={inputStyle}
          />
          <button 
            onClick={handleJoin} 
            style={{ padding: '15px', fontSize: '18px', background: '#007bff', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            SĀKT SPĒLI
          </button>
        </div>
      </div>
    );
  }

  // 2. Galvenais spēles interfeiss pēc pievienošanās
  return (
    <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif', maxWidth: '500px', margin: '0 auto' }}>
      
      {/* Dalībnieka informācijas josla */}
      <div style={{ background: '#f8f9fa', padding: '10px 15px', borderRadius: '10px', marginBottom: '15px', border: '1px solid #e9ecef', fontSize: '0.95rem' }}>
        Sveiks, <strong>{name}</strong>! | PIN: <strong>{pin}</strong>
      </div>

      {scene ? (
        <div style={{ border: '2px solid #007bff', padding: '20px', borderRadius: '15px', backgroundColor: '#fff' }}>
          
          <div style={{ marginBottom: '20px' }}>
            <Timer endTime={scene?.endTime} />
          </div>

          {/* Mediju attēlošanas bloks mobilajā skatā */}
          {renderPlayerMedia(scene)}

          <h2 style={{ marginTop: 0 }}>{scene.title}</h2>
          
          {/* TEKSTA AINA */}
          {scene.type === 'TEXT' && (
            <p style={{ fontSize: '1.2rem', color: '#495057' }}>{scene.config?.text}</p>
          )}

          {/* LĪDERU TABULAS AINA */}
          {scene.type === 'LEADERBOARD' && (
            <div style={{ padding: '20px 0' }}>
              <h1 style={{ fontSize: '3rem', margin: '10px 0' }}>🏆</h1>
              <h3>Skaties rezultātus lielajā ekrānā!</h3>
            </div>
          )}
          
          {/* APTAUJA (VOTE) */}
          {scene.type === 'VOTE' && (
            <div>
              <p style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>{scene.config?.question}</p>
              {!myChoice ? (
                scene.config?.options?.map((opt: string) => (
                  <button 
                    key={opt} 
                    onClick={() => handleVoteSubmit(opt)}
                    style={btnStyle}
                  >
                    {opt}
                  </button>
                ))
              ) : (
                <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#e9ecef', borderRadius: '10px' }}>
                  <h3 style={{ color: '#28a745', margin: 0 }}>✅ Balss pieņemta!</h3>
                  <p style={{ color: '#6c757d', marginBottom: 0, marginTop: '5px' }}>Skaties uz lielo ekrānu...</p>
                </div>
              )}
            </div>
          )}

          {/* VIKTORĪNA (QUIZ) */}
          {scene.type === 'QUIZ' && (
            <div>
              <p style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>{scene.config?.question}</p>
              
              {!myChoice ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {scene.config?.options?.map((opt: string) => {
                      const isSelected = selectedOptions.includes(opt);
                      return (
                        <button 
                          key={opt} 
                          onClick={() => toggleOption(opt)}
                          style={{ 
                            padding: '20px 10px', 
                            background: isSelected ? '#007bff' : '#fff',
                            color: isSelected ? '#fff' : '#000',
                            border: isSelected ? '2px solid #0056b3' : '1px solid #ccc',
                            borderRadius: '10px',
                            fontSize: '16px',
                            fontWeight: isSelected ? 'bold' : 'normal',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  <button 
                    onClick={submitMultiAnswer} 
                    disabled={selectedOptions.length === 0}
                    style={{ 
                      width: '100%', 
                      marginTop: '20px', 
                      padding: '18px', 
                      background: selectedOptions.length > 0 ? '#28a745' : '#6c757d', 
                      color: 'white', 
                      fontWeight: 'bold',
                      fontSize: '18px',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: selectedOptions.length > 0 ? 'pointer' : 'not-allowed',
                      opacity: selectedOptions.length > 0 ? 1 : 0.6
                    }}
                  >
                    IESNIEGT ATBILDES ({selectedOptions.length})
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: '20px' }}>
                  {!isRevealed ? (
                    <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '10px', border: '1px solid #dee2e6' }}>
                      <h3 style={{ marginTop: 0 }}>Atbildes saņemtas!</h3>
                      <p style={{ color: '#6c757d', marginBottom: 0 }}>Gaidām vadītāja signālu un rezultātus...</p>
                    </div>
                  ) : (
                    <div style={{ 
                      padding: '30px 20px', 
                      borderRadius: '10px', 
                      backgroundColor: isFullyCorrect ? '#28a745' : isPartiallyCorrect ? '#ffc107' : '#dc3545',
                      color: isPartiallyCorrect ? '#212529' : 'white'
                    }}>
                      <h1 style={{ margin: 0 }}>
                        {isFullyCorrect && '✅ PAREIZI!'}
                        {isPartiallyCorrect && '⚠️ DAĻĒJI PAREIZI!'}
                        {!isFullyCorrect && !isPartiallyCorrect && '❌ NEPAREIZI!'}
                      </h1>
                      {activeCorrectAnswers.length > 0 && (
                        <p style={{ fontSize: '1.2rem', marginTop: '15px', marginBottom: 0 }}>
                          Pareizā(s) atbilde(s): <strong>{activeCorrectAnswers.join(', ')}</strong>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      ) : (
        <div style={{ padding: '40px 0', color: '#6c757d' }}>
          <h2>Gaidām pasākuma sākumu... 🎧</h2>
          <p>Tūlīt sāksies nākamā aina.</p>
        </div>
      )}

      <button 
        onClick={handleLeave} 
        style={{ marginTop: '40px', padding: '8px 16px', background: 'transparent', border: '1px solid #ccc', borderRadius: '5px', color: '#6c757d', cursor: 'pointer', opacity: 0.6 }}
      >
        Iziet no spēles
      </button>
    </div>
  );
}

// --- GALVENĀ STRUKTŪRA ---
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Player />} />
        <Route path="/host" element={<Host />} />
        <Route path="/studio" element={<Studio />} />
        <Route path="/present/:pin" element={<Presentation />} />
      </Routes>
    </BrowserRouter>
  );
}