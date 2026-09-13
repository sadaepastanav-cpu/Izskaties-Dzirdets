import React, { useState, useEffect, useRef } from 'react';
import { socket } from './socket';
import { useParams } from 'react-router-dom';
import Timer from './Timer';
import { BACKEND_URL } from './config';

const MEDIA_BASE_URL = `${BACKEND_URL}/project-media`;

const hexToRgba = (hex: string = '#000000', opacityPercent: number = 80) => {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacityPercent / 100})`;
};

const getLobbyColor = (count: number) => {
  if (count < 10) return '#00ff00';
  if (count < 50) return '#007bff';
  return '#ff00ff';
};

interface TopBarProps {
  pin: string | undefined;
  scene: any;
  participantCount: number;
  voteData: {
    summary: Record<string, number>;
    votedCount: number;
  };
  isRevealed: boolean;
}

const TopBar: React.FC<TopBarProps> = ({ pin, scene, participantCount, voteData, isRevealed }) => {
  const votedCount = voteData.votedCount || 0;
  const missingCount = Math.max(0, participantCount - votedCount);

  const duration = scene?.config?.duration ?? scene?.config?.timeLimit ?? 0;
  const hasTimer = duration > 0;

  const maxPoints = scene?.config?.pointsMax ?? scene?.config?.points ?? 15;
  const minPoints = scene?.config?.pointsMin ?? 1;
  const [currentPoints, setCurrentPoints] = useState(maxPoints);

  useEffect(() => {
    if (!scene?.endTime || scene?.subState !== 'ACTIVE' || !hasTimer) {
      setCurrentPoints(maxPoints);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const totalTime = duration * 1000;
      const timeLeft = Math.max(0, scene.endTime - now);

      if (timeLeft <= 0) {
        setCurrentPoints(minPoints);
      } else {
        const calculated = Math.ceil((timeLeft / totalTime) * (maxPoints - minPoints)) + minPoints;
        setCurrentPoints(Math.max(minPoints, calculated));
      }
    }, 100);

    return () => clearInterval(interval);
  }, [scene?.endTime, scene?.subState, duration, maxPoints, minPoints, hasTimer]);

  const getDotStyle = (count: number): React.CSSProperties => {
    let size = 18;
    if (count > 60) size = 7;
    else if (count > 30) size = 10;
    else if (count > 15) size = 13;
    else if (count <= 5) size = 22;

    return {
      width: `${size}px`,
      height: `${size}px`,
      backgroundColor: '#00ff00',
      borderRadius: '50%',
      boxShadow: '0 0 8px #00ff00',
      transition: 'all 0.3s ease'
    };
  };

  return (
    <div style={topBarStyle}>
      <div style={pinBadge}>
        PIN: <span style={{ color: '#0f0' }}>{pin}</span>
      </div>

      <div style={votersBox}>
        {missingCount > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '420px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
              {[...Array(missingCount)].map((_, i) => (
                <div key={i} style={getDotStyle(missingCount)} title="Gaidām atbildi..." />
              ))}
            </div>
            {missingCount <= 5 && (
              <span style={{ color: '#ffc107', fontWeight: 'bold', fontSize: '1vw', marginLeft: '6px', textShadow: '0 0 10px #ffc107' }}>
                GAIDĀM PĒDĒJOS! ({missingCount})
              </span>
            )}
          </div>
        ) : (
          <span style={{ color: '#28a745', fontSize: '1.2vw', fontWeight: 'bold', textShadow: '0 0 15px rgba(40,167,69,0.8)' }}>
            ✅ Visas atbildes saņemtas!
          </span>
        )}
      </div>

      {hasTimer && scene?.endTime && (
        <div style={timerBadge}>
          <Timer endTime={scene.endTime} />
        </div>
      )}

      <div style={statsBadge}>
        👥 {votedCount} / {participantCount}
      </div>

      <div style={pointsBadge}>
        ⭐ {isRevealed ? 'REZULTĀTS' : `${currentPoints} / ${maxPoints} PTS`}
      </div>
    </div>
  );
};

export default function Presentation() {
  const { pin } = useParams<{ pin: string }>();
  const [scene, setScene] = useState<any>(null);
  const [voteData, setVoteData] = useState<{ summary: Record<string, number>; votedCount: number }>({
    summary: {},
    votedCount: 0
  });
  const [participantCount, setParticipantCount] = useState(0);
  const [players, setPlayers] = useState<any[]>([]);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isStatsVisible, setIsStatsVisible] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [leaderboardType, setLeaderboardType] = useState<'ROUND' | 'TOTAL' | 'FINAL'>('TOTAL');
  const [leaderboardPage, setLeaderboardPage] = useState(0);
  const [podiumStage, setPodiumStage] = useState(0);
  const [isMediaReady, setIsMediaReady] = useState(false);

  // Īstā saite telefonam (LAN vai Tunelis)
  const [connectionUrl, setConnectionUrl] = useState<string>('');
  const [testedBuzzerCounts, setTestedBuzzerCounts] = useState<Record<string, number>>({});

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (pin) socket.emit('join-session', { pin, name: 'EKRĀNS', playerId: 'scr_' + pin });

    // Iegūstam sesijas datus un saiti
    const handleSessionInfo = (data: any) => {
      if (data?.state?.connectionUrl) setConnectionUrl(data.state.connectionUrl);
    };
    socket.on('session-info', handleSessionInfo);

    socket.on('connection-url-changed', (newUrl: string) => {
      setConnectionUrl(newUrl);
    });

    const handleStateUpdate = (newScene: any) => {
      setScene((prevScene: any) => {
        if (!prevScene || prevScene.id !== newScene.id || newScene.subState === 'READY') {
          setVoteData({ summary: {}, votedCount: 0 });
          setIsRevealed(false);
          setIsStatsVisible(false);
        }
        return newScene;
      });
      setPodiumStage(0);
    };

    socket.on('state-update', handleStateUpdate);
    socket.on('votes-updated', (data: any) => {
      setVoteData({ summary: data?.summary || {}, votedCount: data?.votedCount || 0 });
    });

    socket.on('presence-update', (data) => {
      setParticipantCount(data?.count || 0);
      if (Array.isArray(data?.players)) setPlayers(data.players);
    });

    socket.on('results-revealed', () => setIsRevealed(true));

    socket.on('toggle-audience-chart', () => {
      setIsStatsVisible((prev) => !prev);
    });

    socket.on('player-buzzer-test', (data: { playerId: string }) => {
      setTestedBuzzerCounts((prev) => ({
        ...prev,
        [data.playerId]: (prev[data.playerId] || 0) + 1
      }));
    });

    socket.on('leaderboard-update', (payload: any) => {
      if (Array.isArray(payload)) {
        setLeaderboard(payload);
        setLeaderboardType('TOTAL');
      } else {
        setLeaderboard(payload?.data || []);
        setLeaderboardType(payload?.lbType || 'TOTAL');
      }
      setLeaderboardPage(0);
      setPodiumStage(0);
    });

    socket.on('podium-stage-change', (stage: number) => setPodiumStage(stage));
    socket.on('leaderboard-page-change', (page: number) => setLeaderboardPage(page));

    socket.on('video-command', (cmd: string) => {
      if (cmd === 'play') {
        videoRef.current?.play().catch(() => {});
        audioRef.current?.play().catch(() => {});
      } else if (cmd === 'pause') {
        videoRef.current?.pause();
        audioRef.current?.pause();
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'c' || e.key === 'C') && (scene?.subState === 'STATS' || isRevealed)) {
        e.preventDefault();
        setIsStatsVisible((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      socket.off('session-info', handleSessionInfo);
      socket.off('connection-url-changed');
      socket.off('state-update', handleStateUpdate);
      socket.off('votes-updated');
      socket.off('presence-update');
      socket.off('results-revealed');
      socket.off('toggle-audience-chart');
      socket.off('player-buzzer-test');
      socket.off('leaderboard-update');
      socket.off('podium-stage-change');
      socket.off('leaderboard-page-change');
      socket.off('video-command');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pin, scene?.subState, isRevealed]);

  const renderLayoutElements = (s: any) => {
    if (!s?.config?.layout) return null;

    return s.config.layout.map((el: any, idx: number) => {
      const src = `${MEDIA_BASE_URL}/${el.content}`;
      const itemKey = el.id || `el-${idx}`;
      const vis = el.visibility || 'ALWAYS';

      if (vis === 'DURING_QUESTION' && s.subState !== 'ACTIVE') return null;
      if (vis === 'AFTER_REVEAL' && (!isRevealed || s.subState !== 'REVEAL')) return null;

      const bgRgba = hexToRgba(el.bgColor || '#000000', el.bgOpacity ?? (el.type === 'QUESTION' ? 80 : 50));

      const style: React.CSSProperties = {
        position: 'absolute',
        left: `${el.x}%`,
        top: `${el.y}%`,
        width: `${el.w}%`,
        minHeight: `${el.h}%`,
        height: 'auto',
        zIndex: el.z || el.zIndex || 2,
        color: el.color || '#ffffff',
        fontFamily: el.fontFamily || 'Segoe UI',
        fontSize: typeof el.fontSize === 'number' ? `${el.fontSize}vw` : el.fontSize || '2.2vw',
        fontWeight: el.fontWeight || (el.bold ? 'bold' : 'normal'),
        whiteSpace: 'pre-wrap',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        wordBreak: 'break-word',
        boxSizing: 'border-box'
      };

      if (el.type === 'QUESTION' || el.type === 'TEXT') {
        return (
          <div
            key={itemKey}
            style={{
              ...style,
              background: bgRgba,
              padding: el.type === 'QUESTION' ? '15px 25px' : '10px',
              borderRadius: el.type === 'QUESTION' ? '20px' : '6px',
              backdropFilter: 'blur(8px)',
              border: el.type === 'QUESTION' ? '2px solid #ffc107' : 'none',
              textShadow: '2px 2px 10px #000'
            }}
          >
            {el.content}
          </div>
        );
      }

      if (el.type === 'IMAGE' && el.content) {
        return (
          <img
            key={itemKey}
            src={src}
            style={{ ...style, objectFit: 'contain', borderRadius: '15px', display: 'block' }}
            alt="Medijs"
          />
        );
      }

      if (el.type === 'VIDEO' && el.content) {
        return (
          <video
            key={itemKey}
            src={src}
            style={{ ...style, objectFit: 'contain', borderRadius: '15px', display: 'block' }}
            loop={!!el.loop}
            playsInline
            ref={(v) => {
              if (!v) return;
              videoRef.current = v;
              v.volume = (el.volume !== undefined ? el.volume : 100) / 100;
              if (s.subState === 'ACTIVE') {
                if (v.paused) {
                  v.currentTime = el.trimStart || 0;
                  v.play().catch(() => {});
                }
                v.ontimeupdate = () => {
                  if (el.trimEnd && v.currentTime >= el.trimEnd) {
                    v.pause();
                    v.ontimeupdate = null;
                  }
                };
              } else {
                v.pause();
              }
            }}
          />
        );
      }

      if (el.type === 'AUDIO' && el.content) {
        return (
          <audio
            key={itemKey}
            src={src}
            loop={!!el.loop}
            ref={(a) => {
              if (!a) return;
              audioRef.current = a;
              a.volume = (el.volume !== undefined ? el.volume : 100) / 100;
              if (s.subState === 'ACTIVE' && a.paused) {
                a.currentTime = el.trimStart || 0;
                a.play().catch(() => {});
              } else if (s.subState !== 'ACTIVE') {
                a.pause();
              }
            }}
          />
        );
      }

      return null;
    });
  };

  if (!isMediaReady) {
    return (
      <div style={fullScreenCenter}>
        <button onClick={() => setIsMediaReady(true)} style={bigBtn}>
          🚀 SĀKT PREZENTĀCIJU
        </button>
      </div>
    );
  }

  // PILNĪGI DROŠA UN DERĪGA SAITE TELEFONAM (NEKAD NAV TIKAI 'LOCALHOST')
  const baseHost = connectionUrl && connectionUrl.trim() !== '' ? connectionUrl.trim() : window.location.origin;
  const joinUrl = `${baseHost.replace(/\/$/, '')}/?pin=${pin}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(joinUrl)}`;

  // LOBBY SKATS
  if (!scene) {
    const lobbyMode = scene?.branding?.lobbyMode || 'CIRCLE';

    // INTERAKTĪVO BUMBIŅU REŽĪMS
    if (lobbyMode === 'INTERACTIVE_DOTS') {
      return (
        <div style={{ ...fullScreen, backgroundColor: '#0a0a0a', padding: '30px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '1.8vw', color: '#888' }}>PIEVIENOJIES SPĒLEI: </span>
              <span style={{ fontSize: '3vw', color: '#00ff00', fontWeight: 'bold' }}>PIN: {pin}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: '#fff', padding: '10px 15px', borderRadius: '12px' }}>
              <img src={qrCodeUrl} alt="QR" style={{ width: '90px', height: '90px' }} />
              <div style={{ textAlign: 'left', color: '#000' }}>
                <div style={{ fontWeight: 'bold', fontSize: '1vw' }}>Skenē kamerā!</div>
                <div style={{ fontSize: '0.8vw', color: '#555', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {baseHost}
                </div>
              </div>
            </div>
          </div>

          <div style={{ margin: '15px 0', textAlign: 'center' }}>
            <h2 style={{ fontSize: '2vw', color: '#ffc107', margin: 0 }}>
              🎮 PIESLĒGUŠIES DALĪBNIEKI ({participantCount}):
            </h2>
            <span style={{ fontSize: '1vw', color: '#888' }}>Spiediet telefonā "Pārbaudīt pulti", lai bumbiņa pulsētu un uzsprāgtu!</span>
          </div>

          <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center', alignItems: 'center', overflowY: 'auto' }}>
            {players.map((p) => {
              const pressCount = testedBuzzerCounts[p.id] || 0;
              const hasExploded = pressCount >= 3;
              const currentScale = hasExploded ? 1 : 1 + (pressCount % 3) * 0.35;
              const orbColor = hasExploded ? '#ffd700' : pressCount > 0 ? '#00e5ff' : '#00ff00';

              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    transform: `scale(${currentScale})`,
                    transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                  }}
                >
                  <div
                    style={{
                      width: '65px',
                      height: '65px',
                      borderRadius: '50%',
                      background: orbColor,
                      boxShadow: `0 0 ${hasExploded ? '35px #ffd700' : '20px ' + orbColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#000',
                      fontWeight: 'bold',
                      fontSize: '1.3rem'
                    }}
                  >
                    #{p.deviceNumber || 1}
                  </div>
                  <span style={{ fontSize: '1vw', fontWeight: 'bold', color: '#fff', marginTop: '6px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // KLASISKAIS REŽĪMS
    const circleColor = getLobbyColor(participantCount);
    const circleSize = `${Math.min(14 + participantCount * 0.2, 32)}vw`;

    return (
      <div style={{ ...fullScreenCenter, backgroundColor: '#000', gap: '1.5vw' }}>
        <h1 style={{ fontSize: '2.5vw', color: '#888', margin: 0 }}>PIEVIENOJIES SPĒLEI:</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '35px' }}>
          <div style={{ border: '6px solid #0f0', padding: '1.5vw 3.5vw', borderRadius: '30px', boxShadow: '0 0 60px rgba(0,255,0,0.3)' }}>
            <h1 style={{ fontSize: '8vw', margin: 0, letterSpacing: '0.8vw', lineHeight: 1, color: '#fff' }}>{pin}</h1>
          </div>

          <div style={{ background: '#fff', padding: '12px 16px', borderRadius: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 0 30px rgba(255,255,255,0.2)' }}>
            <img src={qrCodeUrl} alt="QR" style={{ width: '135px', height: '135px' }} />
            <span style={{ color: '#000', fontSize: '0.9vw', fontWeight: 'bold', marginTop: '6px' }}>Skenē kamerā!</span>
            <span style={{ color: '#555', fontSize: '0.75vw', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {baseHost}
            </span>
          </div>
        </div>

        <div
          style={{
            width: circleSize,
            height: circleSize,
            border: `0.8vw solid ${circleColor}`,
            borderRadius: '50%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.5s ease',
            boxShadow: `0 0 50px ${circleColor}`,
            marginTop: '0.5vw'
          }}
        >
          <span style={{ fontSize: '5vw', fontWeight: 'bold', color: '#fff', lineHeight: 1 }}>{participantCount}</span>
          <span style={{ fontSize: '1.1vw', color: '#aaa', marginTop: '0.4vw', textTransform: 'uppercase' }}>
            {participantCount === 1 ? 'Dalībnieks' : 'Dalībnieki'}
          </span>
        </div>
      </div>
    );
  }

  const isFullContent = scene.type === 'BILLBOARD' || scene.type === 'LEADERBOARD';
  const containerStyle: React.CSSProperties = {
    ...fullScreen,
    backgroundImage: scene?.config?.backgroundUrl ? `url(${MEDIA_BASE_URL}/${scene.config.backgroundUrl})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    transition: 'background 1s ease-in-out'
  };

  const optionsList: string[] = (scene.config?.options || []).filter((opt: string) => opt && opt.trim() !== '');
  const optLayout = scene.config?.optionsLayout || 'GRID';
  const optPositions = scene.config?.optionsPositions || {};

  const isRoundLb = (scene.config?.lbType || leaderboardType) === 'ROUND';
  const isFinalLb = (scene.config?.lbType || leaderboardType) === 'FINAL';

  const totalCount = leaderboard.length;
  const firstPlace = leaderboard[0];
  const secondPlace = leaderboard[1];
  const thirdPlace = totalCount >= 3 ? leaderboard[2] : null;

  const remainingPlayers = totalCount > 3 ? leaderboard.slice(3) : [];
  const totalRemainingPages = Math.ceil(remainingPlayers.length / 10);
  const currentRemainingPageList = remainingPlayers.slice(leaderboardPage * 10, (leaderboardPage + 1) * 10);

  return (
    <div style={containerStyle}>
      {!isFullContent && (
        <TopBar
          pin={pin}
          scene={scene}
          participantCount={participantCount}
          voteData={voteData}
          isRevealed={isRevealed}
        />
      )}

      <div
        style={{
          flex: 1,
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: isFullContent ? 'center' : 'flex-start',
          paddingTop: !isFullContent ? '90px' : '0px',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}
      >
        {renderLayoutElements(scene)}

        {/* ATBILŽU POGAS */}
        {optionsList.length > 0 && (
          optLayout === 'INDIVIDUAL' ? (
            optionsList.map((opt: string, i: number) => {
              const pos = optPositions[i] || optPositions[opt] || {
                x: 10 + (i % 2) * 45,
                y: 55 + Math.floor(i / 2) * 14,
                w: 40,
                h: 10
              };
              const isCorrect = isRevealed && (scene.config?.correctAnswers || []).includes(opt);
              const letter = String.fromCharCode(65 + i);
              const count = voteData.summary[opt] ?? voteData.summary[letter] ?? 0;
              const pct = scene.config?.answerCorrectness?.[opt];
              const isOnlyLetter = !opt || opt.trim() === '';

              return (
                <div
                  key={`ind-opt-${i}`}
                  style={{
                    position: 'absolute',
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    width: isOnlyLetter ? 'auto' : `${pos.w}%`,
                    minHeight: `${pos.h}%`,
                    height: 'auto',
                    ...optionCard,
                    background: isOnlyLetter ? 'transparent' : isCorrect ? '#28a745' : 'rgba(0, 0, 0, 0.8)',
                    borderColor: isOnlyLetter ? 'transparent' : isCorrect ? '#00ff00' : '#555',
                    boxShadow: isOnlyLetter ? 'none' : '0 4px 15px rgba(0,0,0,0.6)',
                    padding: isOnlyLetter ? '0' : '12px 20px',
                    zIndex: 10
                  }}
                >
                  <div
                    style={{
                      width: '55px',
                      height: '55px',
                      borderRadius: '50%',
                      background: isCorrect ? '#28a745' : '#111',
                      border: '3px solid #ffc107',
                      boxShadow: '0 0 20px rgba(0,0,0,0.9), 0 0 10px rgba(255,193,7,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '900',
                      fontSize: '2vw',
                      color: '#ffc107'
                    }}
                  >
                    {letter}
                  </div>

                  {!isOnlyLetter && (
                    <span style={{ fontSize: '1.8vw', fontWeight: 'bold', flex: 1, marginLeft: '15px' }}>
                      {opt} {isCorrect && pct !== undefined && pct < 100 && `(+${pct}%)`}
                    </span>
                  )}

                  {isStatsVisible && (scene.subState === 'STATS' || isRevealed) && (
                    <span style={voteBadge}>{count}</span>
                  )}
                </div>
              );
            })
          ) : (
            <div
              style={{
                position: 'absolute',
                bottom: '30px',
                width: '85%',
                display: 'grid',
                gridTemplateColumns: optLayout === 'COLUMN' ? '1fr' : '1fr 1fr',
                gap: '15px',
                zIndex: 10
              }}
            >
              {optionsList.map((opt: string, i: number) => {
                const isCorrect = isRevealed && (scene.config?.correctAnswers || []).includes(opt);
                const letter = String.fromCharCode(65 + i);
                const count = voteData.summary[opt] ?? voteData.summary[letter] ?? 0;
                const pct = scene.config?.answerCorrectness?.[opt];
                const isOnlyLetter = !opt || opt.trim() === '';

                return (
                  <div
                    key={`grp-opt-${i}`}
                    style={{
                      ...optionCard,
                      background: isOnlyLetter ? 'transparent' : isCorrect ? '#28a745' : 'rgba(0, 0, 0, 0.8)',
                      borderColor: isOnlyLetter ? 'transparent' : isCorrect ? '#00ff00' : '#555',
                      boxShadow: isOnlyLetter ? 'none' : '0 4px 15px rgba(0,0,0,0.6)'
                    }}
                  >
                    <div
                      style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '50%',
                        background: isCorrect ? '#28a745' : '#111',
                        border: '2px solid #ffc107',
                        boxShadow: '0 0 15px rgba(0,0,0,0.8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '1.6vw',
                        color: '#ffc107',
                        marginRight: '12px'
                      }}
                    >
                      {letter}
                    </div>

                    {!isOnlyLetter && (
                      <span style={{ fontSize: '1.8vw', fontWeight: 'bold', flex: 1 }}>
                        {opt} {isCorrect && pct !== undefined && pct < 100 && `(+${pct}%)`}
                      </span>
                    )}

                    {isStatsVisible && (scene.subState === 'STATS' || isRevealed) && (
                      <span style={voteBadge}>{count}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* LĪDERU TABULA */}
        {scene.type === 'LEADERBOARD' && !isFinalLb && (
          <div style={leaderboardOverlay}>
            <h1 style={{ fontSize: '2.6vw', color: '#ffc107', textAlign: 'center', margin: '0 0 20px 0' }}>
              {isRoundLb ? '🏆 KĀRTAS REZULTĀTI' : '⭐ KOPVĒRTĒJUMS'}
            </h1>
            <div>
              {leaderboard.slice(leaderboardPage * 10, (leaderboardPage + 1) * 10).map((p, i) => {
                const globalIndex = leaderboardPage * 10 + i + 1;
                const scoreToDisplay = isRoundLb ? (p.roundScore ?? 0) : p.score;
                const timeToDisplay = isRoundLb ? (p.roundTimeMs || 0) : (p.totalTimeMs || 0);

                return (
                  <div key={p.id || globalIndex} style={leaderRow}>
                    <span>{globalIndex}. {p.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <span style={timeTagStyle}>
                        ⏱️ {(timeToDisplay / 1000).toFixed(2)}s
                      </span>
                      <span style={{ fontWeight: 'bold', color: 'gold', minWidth: '70px', textAlign: 'right' }}>
                        {scoreToDisplay} pt
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* FINĀLA APBALVOŠANA */}
        {scene.type === 'LEADERBOARD' && isFinalLb && (
          <div style={{ width: '85vw', height: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {podiumStage < 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                <h1 style={{ fontSize: '3.5vw', color: '#ffc107', margin: '0 0 30px 0', textShadow: '0 0 25px rgba(255,215,0,0.6)' }}>
                  🥇 FINĀLA APBALVOŠANA
                </h1>

                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '30px', height: '380px', width: '100%' }}>
                  {secondPlace && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        opacity: podiumStage >= 2 ? 1 : 0,
                        transform: podiumStage >= 2 ? 'translateY(0)' : 'translateY(50px)',
                        transition: 'all 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                      }}
                    >
                      <span style={{ fontSize: '2vw', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>
                        {secondPlace.name}
                      </span>
                      <span style={{ fontSize: '1.3vw', color: '#ffc107' }}>
                        {secondPlace.score} pt
                      </span>
                      <span style={{ fontSize: '1vw', color: '#00e5ff', marginBottom: '8px' }}>
                        ⏱️ {((secondPlace.totalTimeMs || 0) / 1000).toFixed(2)}s
                      </span>
                      <div style={{ width: '180px', height: '180px', background: 'linear-gradient(to top, #7f8c8d, #bdc3c7)', borderRadius: '15px 15px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #fff' }}>
                        <span style={{ fontSize: '4.5vw', fontWeight: 'bold', color: '#000' }}>🥈 2</span>
                      </div>
                    </div>
                  )}

                  {firstPlace && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        opacity: podiumStage >= 3 ? 1 : 0,
                        transform: podiumStage >= 3 ? 'scale(1)' : 'scale(0.5)',
                        transition: 'all 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                      }}
                    >
                      <div style={{ fontSize: '2.5vw', marginBottom: '4px' }}>👑</div>
                      <span style={{ fontSize: '2.5vw', fontWeight: 'bold', color: '#ffd700', marginBottom: '4px', textShadow: '0 0 15px #ffd700' }}>
                        {firstPlace.name}
                      </span>
                      <span style={{ fontSize: '1.5vw', color: '#fff', fontWeight: 'bold' }}>
                        {firstPlace.score} pt
                      </span>
                      <span style={{ fontSize: '1.1vw', color: '#00e5ff', marginBottom: '8px' }}>
                        ⏱️ {((firstPlace.totalTimeMs || 0) / 1000).toFixed(2)}s
                      </span>
                      <div style={{ width: '220px', height: '260px', background: 'linear-gradient(to top, #f39c12, #f1c40f)', borderRadius: '20px 20px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid #fff', boxShadow: '0 0 40px rgba(241,196,15,0.7)' }}>
                        <span style={{ fontSize: '6vw', fontWeight: 'bold', color: '#000' }}>🥇 1</span>
                      </div>
                    </div>
                  )}

                  {thirdPlace && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        opacity: podiumStage >= 1 ? 1 : 0,
                        transform: podiumStage >= 1 ? 'translateY(0)' : 'translateY(50px)',
                        transition: 'all 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                      }}
                    >
                      <span style={{ fontSize: '2vw', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>
                        {thirdPlace.name}
                      </span>
                      <span style={{ fontSize: '1.3vw', color: '#ffc107' }}>
                        {thirdPlace.score} pt
                      </span>
                      <span style={{ fontSize: '1vw', color: '#00e5ff', marginBottom: '8px' }}>
                        ⏱️ {((thirdPlace.totalTimeMs || 0) / 1000).toFixed(2)}s
                      </span>
                      <div style={{ width: '180px', height: '130px', background: 'linear-gradient(to top, #8e44ad, #cd7f32)', borderRadius: '15px 15px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #fff' }}>
                        <span style={{ fontSize: '4vw', fontWeight: 'bold', color: '#000' }}>🥉 3</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {podiumStage >= 4 && remainingPlayers.length > 0 && (
              <div style={leaderboardOverlay}>
                <h1 style={{ fontSize: '2.5vw', color: '#ffc107', textAlign: 'center', margin: '0 0 15px 0' }}>
                  KOPVĒRTĒJUMS (NO 4. VIETAS) {totalRemainingPages > 1 ? `(${leaderboardPage + 1}/${totalRemainingPages})` : ''}
                </h1>
                <div>
                  {currentRemainingPageList.map((p, i) => {
                    const globalRank = 4 + leaderboardPage * 10 + i;
                    return (
                      <div key={p.id || globalRank} style={leaderRow}>
                        <span>{globalRank}. {p.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <span style={timeTagStyle}>
                            ⏱️ {((p.totalTimeMs || 0) / 1000).toFixed(2)}s
                          </span>
                          <span style={{ fontWeight: 'bold', color: 'gold', minWidth: '70px', textAlign: 'right' }}>
                            {p.score} pt
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- STILI ---
const fullScreen: React.CSSProperties = {
  height: '100vh',
  width: '100vw',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  backgroundColor: '#000',
  color: '#fff',
  fontFamily: 'Segoe UI, Arial, sans-serif',
  overflow: 'hidden',
  position: 'relative'
};

const fullScreenCenter: React.CSSProperties = { ...fullScreen, justifyContent: 'center' };

const topBarStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '75px',
  background: '#1a1a1a',
  display: 'flex',
  alignItems: 'center',
  padding: '0 30px',
  gap: '20px',
  borderBottom: '2px solid #333',
  zIndex: 30,
  boxSizing: 'border-box'
};

const pinBadge: React.CSSProperties = {
  background: '#000',
  padding: '8px 18px',
  borderRadius: '8px',
  fontSize: '1.4rem',
  fontWeight: 'bold',
  border: '2px solid #0f0'
};

const timerBadge: React.CSSProperties = {
  minWidth: '55px',
  height: '55px',
  padding: '0 12px',
  borderRadius: '28px',
  border: '3px solid orange',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 'bold',
  fontSize: '1.2rem',
  background: 'rgba(0,0,0,0.6)'
};

const votersBox: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const statsBadge: React.CSSProperties = { fontSize: '1.3rem', fontWeight: 'bold' };

const pointsBadge: React.CSSProperties = {
  background: '#fff',
  color: '#000',
  padding: '8px 18px',
  borderRadius: '25px',
  fontWeight: 'bold',
  fontSize: '1.1rem'
};

const bigBtn: React.CSSProperties = {
  padding: '30px 60px',
  fontSize: '2.5rem',
  cursor: 'pointer',
  background: '#28a745',
  color: '#fff',
  border: 'none',
  borderRadius: '20px',
  fontWeight: 'bold',
  boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
};

const optionCard: React.CSSProperties = {
  padding: '12px 20px',
  borderRadius: '12px',
  border: '2px solid #444',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  boxShadow: '0 4px 15px rgba(0,0,0,0.6)',
  boxSizing: 'border-box'
};

const voteBadge: React.CSSProperties = {
  background: '#007bff',
  color: '#fff',
  padding: '4px 14px',
  borderRadius: '20px',
  fontSize: '1.3vw',
  fontWeight: 'bold'
};

const leaderboardOverlay: React.CSSProperties = {
  background: 'rgba(10, 10, 10, 0.95)',
  padding: '35px',
  borderRadius: '20px',
  width: '65vw',
  maxHeight: '75vh',
  zIndex: 40,
  border: '2px solid #444',
  boxShadow: '0 0 50px rgba(0,0,0,0.9)',
  display: 'flex',
  flexDirection: 'column'
};

const leaderRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '1.8vw',
  borderBottom: '1px solid #333',
  padding: '8px 0'
};

const timeTagStyle: React.CSSProperties = {
  fontSize: '1.2vw',
  color: '#00e5ff',
  background: 'rgba(0, 229, 255, 0.12)',
  padding: '2px 8px',
  borderRadius: '6px',
  border: '1px solid rgba(0, 229, 255, 0.4)'
};