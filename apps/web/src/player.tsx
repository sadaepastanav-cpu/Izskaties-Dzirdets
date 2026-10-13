import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { BACKEND_URL } from './config';
import { formatThinkingTime, getOfflineQrCodeUrl } from './utils/formatting';

const MEDIA_BASE_URL = `${BACKEND_URL}/project-media`;
const BUTTON_COLORS = ['#007bff', '#fd7e14', '#28a745', '#ffc107', '#6f42c1', '#17a2b8'];

// 🌟 UNIVERSĀLA HAPTISKĀ REAKCIJA SPĒLĒTĀJAM (Android vibrācija + iPhone taktilais klikšķis)
let sharedHapticCtx: AudioContext | null = null;
const initHapticContext = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx && !sharedHapticCtx) {
      sharedHapticCtx = new AudioCtx();
    }
    if (sharedHapticCtx && sharedHapticCtx.state === 'suspended') {
      sharedHapticCtx.resume().catch(() => {});
    }
  } catch {}
};

const triggerHaptic = (type: 'success' | 'warn' | 'tap' = 'tap') => {
  if ('vibrate' in navigator) {
    try {
      if (type === 'success') navigator.vibrate([70, 40, 130]);
      else if (type === 'warn') navigator.vibrate([100, 50, 100]);
      else navigator.vibrate(50);
    } catch {}
  }

  try {
    initHapticContext();
    if (sharedHapticCtx && sharedHapticCtx.state === 'running') {
      const osc = sharedHapticCtx.createOscillator();
      const gain = sharedHapticCtx.createGain();
      osc.type = 'triangle';

      const startFreq = type === 'success' ? 440 : type === 'warn' ? 220 : 320;
      const endFreq = type === 'success' ? 160 : type === 'warn' ? 70 : 80;
      osc.frequency.setValueAtTime(startFreq, sharedHapticCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(endFreq, sharedHapticCtx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.7, sharedHapticCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, sharedHapticCtx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(sharedHapticCtx.destination);
      osc.start();
      osc.stop(sharedHapticCtx.currentTime + 0.04);
    }
  } catch {}
};

export default function Player() {
  const params = new URLSearchParams(window.location.search);
  const urlPin = params.get('pin') || '';
  const urlTeam = params.get('team') || '';

  const [pin, setPin] = useState(urlPin || localStorage.getItem('player_pin') || '');
  const [name, setName] = useState(localStorage.getItem('player_name') || '');
  const [teamName, setTeamName] = useState(urlTeam || localStorage.getItem('player_team') || '');
  const [isCaptain, setIsCaptain] = useState(urlTeam ? false : localStorage.getItem('player_is_captain') === 'true');
  const [isTeamFromQr] = useState(Boolean(urlTeam));

  const [playerId] = useState(() => {
    let id = localStorage.getItem('player_id');
    if (!id) {
      id = 'p_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('player_id', id);
    }
    return id;
  });

  const [playerToken, setPlayerToken] = useState<string>(() => localStorage.getItem('player_token') || '');

  const [socket, setSocket] = useState<Socket | null>(null);
  const [deviceNumber, setDeviceNumber] = useState<number | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isDisabledAfk, setIsDisabledAfk] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scene, setScene] = useState<any>(null);
  const [subState, setSubState] = useState<string>('IDLE');

  const [showCaptainQrModal, setShowCaptainQrModal] = useState(false);

  // 🌟 KONTAKTU ANKETAS STĀVOKLIS
  const [contactsForm, setContactsForm] = useState<Record<string, string>>({});
  const [isContactsSubmitted, setIsContactsSubmitted] = useState<boolean>(false);

  const isFullscreenSupported = typeof document !== 'undefined' && Boolean(
    document.fullscreenEnabled || (document as any).webkitFullscreenEnabled
  );

  const isIosDevice = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  // Balsošanas izvēles
  const [myChoice, setMyChoice] = useState<string | null>(() => localStorage.getItem('player_current_choice'));
  const [stagedChoice, setStagedChoice] = useState<string | null>(null);
  const [selectedMultipleOptions, setSelectedMultipleOptions] = useState<string[]>([]);

  // 🎵 Muzikālā spēle
  const [musicTopChoice, setMusicTopChoice] = useState<string | null>(() => localStorage.getItem('player_music_top'));
  const [musicBottomChoice, setMusicBottomChoice] = useState<string | null>(() => localStorage.getItem('player_music_bottom'));
  const [stagedMusicTop, setStagedMusicTop] = useState<string | null>(null);
  const [stagedMusicBottom, setStagedMusicBottom] = useState<string | null>(null);

  // 🔢 Secība & ⚡ Pults
  const [orderedItems, setOrderedItems] = useState<string[]>([]);
  const [buzzerPressedOrder, setBuzzerPressedOrder] = useState<number | null>(null);
  const [isMyBuzzerTurn, setIsMyBuzzerTurn] = useState<boolean>(false);

  const [playersList, setPlayersList] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [teamLeaderboard, setTeamLeaderboard] = useState<any[]>([]);
  const [leaderboardType, setLeaderboardType] = useState<string>('TOTAL');
  const [podiumStage, setPodiumStage] = useState<number>(0);
  const [buzzerTestPresses, setBuzzerTestPresses] = useState(0);

  // 🌟 Personīgās statistikas stāvoklis
  const [personalStats, setPersonalStats] = useState<{
    myRank: number | null;
    previousRank?: number | null;
    rankDelta?: number;
    totalPlayers: number;
    score: number;
    roundScore: number;
    lastQuestionScore?: number;
    totalTimeMs: number;
    roundTimeMs: number;
    lbType?: string;
    teamRank?: number | null;
    previousTeamRank?: number | null;
    teamRankDelta?: number;
    totalTeams?: number;
    teamScore?: number | null;
    teamName?: string;
    isInitialBaseline?: boolean;
  } | null>(() => {
    const savedScore = localStorage.getItem('player_saved_score');
    return savedScore ? {
      myRank: null,
      previousRank: null,
      rankDelta: 0,
      totalPlayers: 1,
      score: Number(savedScore) || 0,
      roundScore: 0,
      lastQuestionScore: 0,
      totalTimeMs: 0,
      roundTimeMs: 0,
      isInitialBaseline: true
    } : null;
  });

  const [branding, setBranding] = useState<any>(() => {
    try {
      const cached = localStorage.getItem('cached_branding');
      return cached
        ? JSON.parse(cached)
        : {
            appTitle: 'EVENT BUZZER',
            appLogo: '',
            appBgImage: '',
            welcomeImage: '',
            appBgColor: '#121212',
            lobbyMode: 'CIRCLE',
            gameLogoPosition: 'NONE',
            teamModeEnabled: Boolean(urlTeam)
          };
    } catch {
      return {
        appTitle: 'EVENT BUZZER',
        appLogo: '',
        appBgImage: '',
        welcomeImage: '',
        appBgColor: '#121212',
        lobbyMode: 'CIRCLE',
        gameLogoPosition: 'NONE',
        teamModeEnabled: Boolean(urlTeam)
      };
    }
  });

  const [serverBaseUrl, setServerBaseUrl] = useState<string>('');
  const noSleepVideoRef = useRef<HTMLVideoElement | null>(null);

  const toggleFullscreen = () => {
    triggerHaptic('tap');
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  // 🌟 NEIZSLĒDZAMĀ EKRĀNA DZINĒJS
  useEffect(() => {
    let wakeLock: any = null;
    let isLocked = false;

    const requestLock = async () => {
      if ('wakeLock' in navigator && (navigator as any).wakeLock) {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          isLocked = true;
          wakeLock.addEventListener('release', () => {
            isLocked = false;
          });
        } catch {}
      }
    };

    requestLock();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestLock();
      }
    };

    const handleUserInteraction = () => {
      initHapticContext();
      if (!isLocked) requestLock();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    document.addEventListener('touchstart', handleUserInteraction, { passive: true });
    document.addEventListener('click', handleUserInteraction, { passive: true });

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 2;
      canvas.height = 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 2, 2);
      }
      if ((canvas as any).captureStream && noSleepVideoRef.current) {
        const stream = (canvas as any).captureStream(2);
        noSleepVideoRef.current.srcObject = stream;
        noSleepVideoRef.current.play().catch(() => {});
      }
    } catch {}

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('click', handleUserInteraction);
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (urlPin) {
      const cleanP = urlPin.trim();
      setPin(cleanP);
      localStorage.setItem('player_pin', cleanP);

      fetch(`${BACKEND_URL}/api/session-branding/${cleanP}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.branding) {
            setBranding((prev: any) => ({ ...prev, ...res.branding }));
            localStorage.setItem('cached_branding', JSON.stringify(res.branding));
            if (res.connectionUrl) setServerBaseUrl(res.connectionUrl);
          }
        })
        .catch(() => {});
    }

    if (urlTeam) {
      const cleanT = urlTeam.trim();
      setTeamName(cleanT);
      setIsCaptain(false);
      localStorage.setItem('player_team', cleanT);
      localStorage.setItem('player_is_captain', 'false');
    }
  }, [urlPin, urlTeam]);

  useEffect(() => {
    const s = io(BACKEND_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });
    setSocket(s);

    const tryAutoJoin = () => {
      const savedPin = urlPin || localStorage.getItem('player_pin');
      const savedName = localStorage.getItem('player_name');
      const savedTeam = urlTeam || localStorage.getItem('player_team') || '';
      const savedCaptain = urlTeam ? false : localStorage.getItem('player_is_captain') === 'true';
      const savedToken = localStorage.getItem('player_token') || undefined;
      const wasJoined = sessionStorage.getItem('player_active_session') === 'true';

      if (savedPin) {
        s.emit('get-branding', { pin: savedPin.trim() });
      }

      if (wasJoined && savedPin && savedName) {
        s.emit('join-session', {
          pin: savedPin.trim(),
          name: savedName.trim(),
          teamName: savedTeam,
          isCaptain: savedCaptain,
          playerId,
          playerToken: savedToken
        });
      }
    };

    s.on('connect', () => {
      tryAutoJoin();
    });

    s.on('join-success', (data: any) => {
      setIsJoined(true);
      setIsGameOver(false);
      setIsDisabledAfk(false);
      sessionStorage.setItem('player_active_session', 'true');

      if (data?.playerToken) {
        setPlayerToken(data.playerToken);
        localStorage.setItem('player_token', data.playerToken);
      }

      if (data?.deviceNumber) setDeviceNumber(data.deviceNumber);
      if (data?.teamName) setTeamName(data.teamName);
      if (data?.isCaptain !== undefined) setIsCaptain(data.isCaptain);
      if (data?.connectionUrl) setServerBaseUrl(data.connectionUrl);
      if (data?.branding) {
        setBranding((prev: any) => {
          const updated = { ...prev, ...data.branding };
          localStorage.setItem('cached_branding', JSON.stringify(updated));
          return updated;
        });
      }
      if (data?.currentScene) {
        setScene(data.currentScene);
        if (data.currentScene.type === 'ORDERING') {
          setOrderedItems([...(data.currentScene.config?.options || [])]);
        }
        if (data.currentScene.type === 'LEADERBOARD' && data.currentScene.config?.lbType) {
          setLeaderboardType(data.currentScene.config.lbType.toUpperCase());
        }
      }
      const currentSub = (data?.subState || data?.currentScene?.subState || 'IDLE').toUpperCase();
      setSubState(currentSub);

      if (data?.score !== undefined) {
        localStorage.setItem('player_saved_score', String(data.score));
        setPersonalStats({
          myRank: data?.myRank ?? null,
          previousRank: null,
          rankDelta: 0,
          totalPlayers: data?.totalPlayers ?? 1,
          score: data.score,
          roundScore: data.roundScore ?? 0,
          lastQuestionScore: data.lastQuestionScore ?? 0,
          totalTimeMs: 0,
          roundTimeMs: 0,
          teamRank: data?.teamRank ?? null,
          previousTeamRank: null,
          teamRankDelta: 0,
          totalTeams: data?.totalTeams ?? 1,
          teamScore: data?.teamScore ?? null,
          isInitialBaseline: true
        });
      }
    });

    s.on('client:sync-response', (data: any) => {
      if (data?.currentScene) {
        setScene(data.currentScene);
        if (data.currentScene.type === 'LEADERBOARD' && data.currentScene.config?.lbType) {
          setLeaderboardType(data.currentScene.config.lbType.toUpperCase());
        }
      }
      if (data?.subState) setSubState(data.subState.toUpperCase());
      if (data?.myChoice) {
        setMyChoice(data.myChoice);
        localStorage.setItem('player_current_choice', data.myChoice);
      }
      if (data?.topAnswer) {
        setMusicTopChoice(data.topAnswer);
        localStorage.setItem('player_music_top', data.topAnswer);
      }
      if (data?.bottomAnswer) {
        setMusicBottomChoice(data.bottomAnswer);
        localStorage.setItem('player_music_bottom', data.bottomAnswer);
      }
      if (data?.myContacts && Object.keys(data.myContacts).length > 0) {
        setContactsForm(data.myContacts);
        setIsContactsSubmitted(true);
      }
      if (data?.myOptionIds && Array.isArray(data.myOptionIds)) {
        setSelectedMultipleOptions(data.myOptionIds);
      }
      if (data?.score !== undefined) {
        setPersonalStats((prev) => prev ? {
          ...prev,
          score: data.score,
          roundScore: data.roundScore ?? prev.roundScore,
          lastQuestionScore: data.lastQuestionScore ?? prev.lastQuestionScore,
          myRank: data.myRank ?? prev.myRank,
          previousRank: data.previousRank ?? prev.previousRank,
          rankDelta: data.rankDelta ?? prev.rankDelta,
          isInitialBaseline: Boolean(data.isInitialBaseline)
        } : null);
      }
    });

    s.on('session-branding', (br: any) => {
      if (br && Object.keys(br).length > 0) {
        setBranding((prev: any) => {
          const updated = { ...prev, ...br };
          localStorage.setItem('cached_branding', JSON.stringify(updated));
          return updated;
        });
      }
    });

    s.on('presence-update', (data: any) => {
      if (Array.isArray(data?.players)) {
        setPlayersList(data.players);
      }
    });

    s.on('state-update', (newScene: any) => {
      setScene(newScene);
      const newSub = (newScene?.subState || 'READY').toUpperCase();
      setSubState(newSub);

      if (newScene?.type === 'LEADERBOARD' && newScene?.config?.lbType) {
        setLeaderboardType(newScene.config.lbType.toUpperCase());
      }

      if (newSub === 'READY') {
        setMyChoice(null);
        setStagedChoice(null);
        setSelectedMultipleOptions([]);
        setMusicTopChoice(null);
        setMusicBottomChoice(null);
        setStagedMusicTop(null);
        setStagedMusicBottom(null);
        setBuzzerPressedOrder(null);
        setIsMyBuzzerTurn(false);
        localStorage.removeItem('player_current_choice');
        localStorage.removeItem('player_music_top');
        localStorage.removeItem('player_music_bottom');
      }
      setPodiumStage(0);

      if (newScene?.type === 'ORDERING') {
        setOrderedItems([...(newScene.config?.options || [])]);
      }
    });

    s.on('my-personal-stats', (data: any) => {
      setPersonalStats(data);
      if (data?.score !== undefined) {
        localStorage.setItem('player_saved_score', String(data.score));
      }

      if (data?.lbType) {
        setLeaderboardType(data.lbType.toUpperCase());
      }

      if (!data?.isInitialBaseline && data?.lbType !== 'ROUND') {
        if (data?.rankDelta && data.rankDelta > 0) {
          triggerHaptic('success');
        } else if (data?.rankDelta && data.rankDelta < 0) {
          triggerHaptic('warn');
        }
      }
    });

    s.on('buzzer-race-press', (data: { winner: any; allWinners: any[] }) => {
      if (data?.winner?.playerId === playerId) {
        setBuzzerPressedOrder(data.winner.position);
        setIsMyBuzzerTurn(true);
        triggerHaptic('success');
      } else {
        setIsMyBuzzerTurn(false);
      }
    });

    s.on('leaderboard-update', (payload: any) => {
      if (Array.isArray(payload)) {
        setLeaderboard(payload);
        setLeaderboardType('TOTAL');
      } else {
        setLeaderboard(payload?.data || []);
        if (payload?.lbType) setLeaderboardType(payload.lbType.toUpperCase());
      }
      setPodiumStage(0);
    });

    s.on('team-leaderboard-update', (payload: any) => {
      const list = Array.isArray(payload) ? payload : payload?.data || [];
      setTeamLeaderboard(list);
    });

    s.on('podium-stage-change', (stage: number) => setPodiumStage(stage));

    s.on('player-disabled-afk', (data: { playerId: string }) => {
      if (data.playerId === playerId) setIsDisabledAfk(true);
    });

    s.on('game-over', () => setIsGameOver(true));

    s.on('session-ended', () => {
      sessionStorage.removeItem('player_active_session');
      localStorage.removeItem('player_pin');
      localStorage.removeItem('player_token');
      localStorage.removeItem('player_team');
      localStorage.removeItem('player_is_captain');
      localStorage.removeItem('player_current_choice');
      localStorage.removeItem('player_music_top');
      localStorage.removeItem('player_music_bottom');
      localStorage.removeItem('player_saved_score');
      setIsJoined(false);
      setIsGameOver(false);
      setIsDisabledAfk(false);
      setScene(null);
      setMyChoice(null);
      setStagedChoice(null);
      setSelectedMultipleOptions([]);
      setMusicTopChoice(null);
      setMusicBottomChoice(null);
      setDeviceNumber(null);
      setBuzzerTestPresses(0);
      setOrderedItems([]);
      setBuzzerPressedOrder(null);
      setIsMyBuzzerTurn(false);
      setContactsForm({});
      setIsContactsSubmitted(false);
      setPin('');
      setPlayerToken('');
      setPersonalStats(null);
      alert('Vadītājs ir beidzis spēles sesiju.');
    });

    s.on('error-message', (msg: string) => alert(msg));

    return () => {
      s.disconnect();
    };
  }, [playerId, urlPin, urlTeam]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && socket && isJoined && pin) {
        socket.emit('client:request-sync', { pin, playerId, playerToken });
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [socket, isJoined, pin, playerId, playerToken]);

  useEffect(() => {
    if (socket && pin && pin.trim().length >= 4) {
      socket.emit('get-branding', { pin: pin.trim() });
    }
  }, [pin, socket]);

  const isTeamMode = Boolean(branding?.teamModeEnabled || urlTeam || isTeamFromQr);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic('tap');
    if (!pin.trim()) return alert('Lūdzu ievadiet PIN kodu!');
    if (!name.trim()) return alert('Lūdzu ievadiet savu vārdu!');

    if (isTeamMode) {
      if (!isTeamFromQr && !teamName.trim()) {
        return alert('Lūdzu ievadiet savas komandas nosaukumu!');
      }
      if (isTeamFromQr && !teamName.trim()) {
        return alert('Kļūda komandas saitē. Noskenējiet kapteiņa QR kodu vēlreiz.');
      }
    }

    localStorage.setItem('player_pin', pin.trim());
    localStorage.setItem('player_name', name.trim());
    localStorage.setItem('player_is_captain', String(!isTeamFromQr));
    if (isTeamMode && teamName) localStorage.setItem('player_team', teamName.trim());

    if (socket) {
      socket.emit('join-session', {
        pin: pin.trim(),
        name: name.trim(),
        teamName: isTeamMode ? teamName.trim() : '',
        isCaptain: isTeamMode ? !isTeamFromQr : false,
        playerId,
        playerToken: playerToken || undefined
      });
    }
  };

  const rawOptions: string[] = scene?.config?.options || ['A', 'B', 'C', 'D'];
  const requiredCount = scene?.config?.requiredCount ?? (scene?.config?.correctAnswers?.length || 1);
  const isMultiSelectMode = scene?.config?.selectionMode === 'ALL' && requiredCount > 1;
  const maxRequiredChoices = requiredCount > 0 ? requiredCount : 1;
  const submitMode = scene?.config?.submitMode || 'INSTANT';

  const playerUIMode: 'AUTO' | 'CLASSIC_GRID' | 'TEXT_CARDS' | 'MUSIC_DUAL' =
    scene?.config?.playerUIMode || 'AUTO';

  const hasOptionText = rawOptions.some((opt) => opt && opt.trim() !== '' && !/^[A-F]$/i.test(opt.trim()));
  const shouldShowVerticalCards =
    playerUIMode === 'TEXT_CARDS' || playerUIMode === 'MUSIC_DUAL' || hasOptionText;

  const renderRankDeltaPill = (delta?: number, isBaseline: boolean = false) => {
    if (isBaseline || delta === undefined || delta === null || delta === 0) {
      return (
        <span style={{
          background: 'rgba(108, 117, 125, 0.25)',
          border: '1px solid #6c757d',
          color: '#ccc',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '0.8rem',
          fontWeight: 'bold',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px'
        }}>
          — Saglabāta
        </span>
      );
    }
    if (delta > 0) {
      return (
        <span style={{
          background: 'rgba(40, 167, 69, 0.25)',
          border: '1.5px solid #28a745',
          color: '#00ff66',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '0.85rem',
          fontWeight: '900',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
          boxShadow: '0 0 10px rgba(40, 167, 69, 0.5)'
        }}>
          ▲ +{delta} {delta === 1 ? 'vieta' : 'vietas'}
        </span>
      );
    }
    return (
      <span style={{
        background: 'rgba(220, 53, 69, 0.25)',
        border: '1px solid #dc3545',
        color: '#ff4d4d',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '0.85rem',
        fontWeight: '900',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px'
      }}>
        ▼ {Math.abs(delta)} {Math.abs(delta) === 1 ? 'vieta' : 'vietas'}
      </span>
    );
  };

  // 🎵 Muzikālā spēle
  const handleMusicOptionClick = (option: string, letter: string, isTopCategory: boolean) => {
    if (!socket || subState !== 'ACTIVE' || isDisabledAfk) return;
    triggerHaptic('tap');
    const choiceValue = option || letter;

    if (submitMode === 'CONFIRM') {
      if (isTopCategory) setStagedMusicTop(choiceValue);
      else setStagedMusicBottom(choiceValue);
    } else {
      let updatedTop = musicTopChoice;
      let updatedBottom = musicBottomChoice;

      if (isTopCategory) {
        if (musicTopChoice) return;
        updatedTop = choiceValue;
        setMusicTopChoice(choiceValue);
        localStorage.setItem('player_music_top', choiceValue);

        socket.emit('participant:submit-answer', {
          pin,
          playerId,
          playerToken,
          category: 'TOP',
          answers: [choiceValue],
          answer: choiceValue
        });
      } else {
        if (musicBottomChoice) return;
        updatedBottom = choiceValue;
        setMusicBottomChoice(choiceValue);
        localStorage.setItem('player_music_bottom', choiceValue);

        socket.emit('participant:submit-answer', {
          pin,
          playerId,
          playerToken,
          category: 'BOTTOM',
          answers: [choiceValue],
          answer: choiceValue
        });
      }

      if (updatedTop && updatedBottom) {
        const combined = `${updatedTop} + ${updatedBottom}`;
        setMyChoice(combined);
        localStorage.setItem('player_current_choice', combined);
      }
    }
  };

  const handleMusicConfirmSubmit = () => {
    if (!stagedMusicTop || !stagedMusicBottom || myChoice || !socket || subState !== 'ACTIVE' || isDisabledAfk) return;
    triggerHaptic('tap');

    const combinedChoice = `${stagedMusicTop} + ${stagedMusicBottom}`;
    setMusicTopChoice(stagedMusicTop);
    setMusicBottomChoice(stagedMusicBottom);
    setMyChoice(combinedChoice);
    localStorage.setItem('player_current_choice', combinedChoice);
    localStorage.setItem('player_music_top', stagedMusicTop);
    localStorage.setItem('player_music_bottom', stagedMusicBottom);

    socket.emit('participant:submit-answer', {
      pin,
      playerId,
      playerToken,
      answers: [stagedMusicTop, stagedMusicBottom],
      answer: combinedChoice
    });
  };

  // Standarta balsošana
  const handleSingleVoteClick = (option: string, letter: string) => {
    if (myChoice || !socket || subState === 'PAUSED' || isDisabledAfk) return;
    triggerHaptic('tap');

    if (submitMode === 'CONFIRM') {
      setStagedChoice(option || letter);
    } else {
      const chosenStr = option || letter;
      setMyChoice(chosenStr);
      localStorage.setItem('player_current_choice', chosenStr);
      socket.emit('participant:submit-answer', { 
        pin, 
        answer: chosenStr, 
        answers: [chosenStr], 
        playerId, 
        playerToken 
      });
    }
  };

  const handleConfirmSingleVote = () => {
    if (!stagedChoice || myChoice || !socket || subState === 'PAUSED' || isDisabledAfk) return;
    triggerHaptic('tap');
    setMyChoice(stagedChoice);
    localStorage.setItem('player_current_choice', stagedChoice);
    socket.emit('participant:submit-answer', { 
      pin, 
      answer: stagedChoice, 
      answers: [stagedChoice], 
      playerId, 
      playerToken 
    });
  };

  const toggleMultiSelectOption = (item: string) => {
    if (myChoice || subState === 'PAUSED' || isDisabledAfk) return;
    triggerHaptic('tap');

    setSelectedMultipleOptions((prev) => {
      if (prev.includes(item)) {
        return prev.filter((x) => x !== item);
      } else {
        if (prev.length >= maxRequiredChoices) return prev;
        return [...prev, item];
      }
    });
  };

  const handleMultiVoteSubmit = () => {
    if (myChoice || !socket || selectedMultipleOptions.length !== maxRequiredChoices || subState === 'PAUSED' || isDisabledAfk) return;
    triggerHaptic('tap');

    const chosenStr = selectedMultipleOptions.join(', ');
    setMyChoice(chosenStr);
    localStorage.setItem('player_current_choice', chosenStr);

    socket.emit('participant:submit-answer', {
      pin,
      answer: chosenStr,
      answers: selectedMultipleOptions,
      playerId,
      playerToken
    });
  };

  const handleBuzzerPress = () => {
    if (subState === 'READY') {
      triggerHaptic('tap');
      return;
    }
    if (subState === 'ACTIVE' && !buzzerPressedOrder) {
      triggerHaptic('warn');
      setBuzzerPressedOrder(1);
      socket?.emit('participant:submit-answer', {
        pin,
        answer: 'BUZZ',
        answers: ['BUZZ'],
        playerId,
        playerToken
      });
    }
  };

  const moveOrderingItem = (index: number, direction: 'UP' | 'DOWN') => {
    if (myChoice || subState !== 'ACTIVE' || isDisabledAfk) return;
    triggerHaptic('tap');
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= orderedItems.length) return;

    const updated = [...orderedItems];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setOrderedItems(updated);
  };

  const handleOrderingSubmit = () => {
    if (myChoice || !socket || subState !== 'ACTIVE' || isDisabledAfk) return;
    triggerHaptic('tap');

    const orderStr = orderedItems.join(' ➔ ');
    setMyChoice(orderStr);
    localStorage.setItem('player_current_choice', orderStr);
    socket.emit('participant:submit-answer', {
      pin,
      answer: orderStr,
      answers: orderedItems,
      playerId,
      playerToken
    });
  };

  const handleTestBuzzer = () => {
    if (!socket) return;
    triggerHaptic('tap');
    setBuzzerTestPresses((prev) => prev + 1);
    socket.emit('participant:test-buzzer', { pin, playerId });
  };

  // 🌟 KONTAKTU IESNIEGŠANA
  const handleContactsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !pin) return;
    triggerHaptic('success');

    socket.emit('participant:submit-contacts', {
      pin,
      playerId,
      playerToken,
      contacts: contactsForm
    });

    setIsContactsSubmitted(true);
  };

  const handleLeaveOrNewGame = () => {
    sessionStorage.removeItem('player_active_session');
    localStorage.removeItem('player_pin');
    localStorage.removeItem('player_token');
    localStorage.removeItem('player_team');
    localStorage.removeItem('player_is_captain');
    localStorage.removeItem('player_current_choice');
    localStorage.removeItem('player_music_top');
    localStorage.removeItem('player_music_bottom');
    localStorage.removeItem('player_saved_score');
    setIsJoined(false);
    setIsGameOver(false);
    setIsDisabledAfk(false);
    setScene(null);
    setMyChoice(null);
    setStagedChoice(null);
    setSelectedMultipleOptions([]);
    setMusicTopChoice(null);
    setMusicBottomChoice(null);
    setDeviceNumber(null);
    setBuzzerTestPresses(0);
    setOrderedItems([]);
    setBuzzerPressedOrder(null);
    setIsMyBuzzerTurn(false);
    setContactsForm({});
    setIsContactsSubmitted(false);
    setPin('');
    setPlayerToken('');
    setPersonalStats(null);
  };

  const isRoundLb = (scene?.config?.lbType || personalStats?.lbType || leaderboardType || '').toUpperCase() === 'ROUND';
  const totalPlayersCount = personalStats?.totalPlayers ?? 1;
  const myRank = personalStats?.myRank ?? '-';
  const rankDelta = personalStats?.rankDelta ?? 0;
  const lastQuestionScore = personalStats?.lastQuestionScore ?? 0;
  const isBaseline = Boolean(personalStats?.isInitialBaseline);

  const currentScoreToDisplay = personalStats ? (isRoundLb ? personalStats.roundScore : personalStats.score) : 0;
  const currentTimeToDisplay = personalStats ? (isRoundLb ? personalStats.roundTimeMs : personalStats.totalTimeMs) : 0;

  const myTeamRank = personalStats?.teamRank ?? '-';
  const teamRankDelta = personalStats?.teamRankDelta ?? 0;
  const totalTeamsCount = personalStats?.totalTeams ?? 1;
  const currentTeamScoreToDisplay = personalStats ? (personalStats.teamScore ?? 0) : 0;

  const appBgStyle: React.CSSProperties = {
    ...fullScreenMobile,
    backgroundColor: branding.appBgColor || '#121212',
    backgroundImage: branding.appBgImage ? `url(${MEDIA_BASE_URL}/${branding.appBgImage})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  };

  const myTeammates = isTeamMode && teamName
    ? playersList.filter((p) => p.teamName?.trim().toLowerCase() === teamName.trim().toLowerCase())
    : [];

  const baseHost = serverBaseUrl && serverBaseUrl.trim() !== '' ? serverBaseUrl.trim() : window.location.origin;
  const captainJoinUrl = `${baseHost.replace(/\/$/, '')}/?pin=${pin}&team=${encodeURIComponent(teamName)}`;
  const captainQrUrl = getOfflineQrCodeUrl(captainJoinUrl, 220);

  const isExactChoicesSelected = selectedMultipleOptions.length === maxRequiredChoices;
  const isFinalLeaderboard = scene?.type === 'LEADERBOARD' && (scene?.config?.lbType === 'FINAL' || leaderboardType === 'FINAL');
  const isBuzzerRace = scene?.type === 'BUZZER_RACE';
  const isOrdering = scene?.type === 'ORDERING';
  const isMusicMode = playerUIMode === 'MUSIC_DUAL';
  const isContactsScene = scene?.type === 'CONTACTS';

  const renderGameLogo = () => {
    if (!branding.appLogo || branding.gameLogoPosition === 'NONE') return null;
    return (
      <div style={{ textAlign: 'center', margin: '4px 0', flexShrink: 0 }}>
        <img
          src={`${MEDIA_BASE_URL}/${branding.appLogo}`}
          alt="Logo"
          style={{ maxHeight: '42px', maxWidth: '65%', objectFit: 'contain' }}
        />
      </div>
    );
  };

  if (!isJoined) {
    return (
      <div style={appBgStyle}>
        <video ref={noSleepVideoRef} playsInline muted loop style={{ display: 'none' }} />

        <div style={loginCard}>
          {branding.appLogo ? (
            <div style={{ textAlign: 'center', marginBottom: '12px' }}>
              <img
                src={`${MEDIA_BASE_URL}/${branding.appLogo}`}
                alt="Logo"
                style={{ maxHeight: '90px', maxWidth: '85%', objectFit: 'contain' }}
              />
            </div>
          ) : (
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎮</div>
          )}

          <h1 style={{ margin: '0 0 4px 0', fontSize: '1.5rem', color: '#ffc107', fontWeight: '900' }}>
            {branding.appTitle || 'EVENT BUZZER'}
          </h1>
          <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '15px' }}>
            {isTeamMode ? (isTeamFromQr ? '👥 Pievienošanās komandai' : '👑 Komandu spēle: Izveido komandu') : 'Individuālā spēle'}
          </p>

          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              style={mobileInput}
              placeholder="PIN kods"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              maxLength={6}
            />

            <input
              style={mobileInput}
              placeholder="Tavs Vārds"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              autoFocus
            />

            {isTeamMode && (
              isTeamFromQr ? (
                <div style={{ background: '#1c2833', border: '1px solid #00e5ff', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#aaa' }}>Pievienojies komandai:</div>
                  <div style={{ fontSize: '1.2rem', color: '#00ff00', fontWeight: 'bold', marginTop: '2px' }}>
                    {teamName}
                  </div>
                </div>
              ) : (
                <div style={{ background: '#261c02', border: '1px solid #ffc107', padding: '10px', borderRadius: '8px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#ffc107', fontWeight: 'bold', marginBottom: '4px', textAlign: 'left' }}>
                    👑 Ievadi Komandas nosaukumu (Kapteinis):
                  </label>
                  <input
                    style={{ ...mobileInput, borderColor: '#ffc107', color: '#ffc107', fontWeight: 'bold' }}
                    placeholder="Piemēram: Zelta Bulta"
                    value={teamName}
                    onChange={(e) => {
                      setTeamName(e.target.value);
                      setIsCaptain(true);
                    }}
                    maxLength={25}
                  />
                  <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '6px', textAlign: 'left' }}>
                    💡 Biedri pievienosies, noskenējot tavu QR kodu nākamajā solī!
                  </div>
                </div>
              )
            )}

            <button type="submit" style={btnJoin}>
              {isTeamMode && !isTeamFromQr ? 'IZVEIDOT KOMANDU 👑' : 'SĀKT SPĒLI 🚀'}
            </button>
          </form>

          {isIosDevice && (
            <div style={{ marginTop: '12px', fontSize: '0.72rem', color: '#888', lineHeight: 1.3 }}>
              💡 iPhone pilnekrānam: Safari apakšā spied <strong>'Dalīties'</strong> (Share) ➔ <strong>'Pievienot sākuma ekrānam'</strong>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isDisabledAfk) {
    return (
      <div style={appBgStyle}>
        <div style={infoCard}>
          <div style={{ fontSize: '3rem', marginBottom: '10px' }}>💤</div>
          <h2 style={{ color: '#ff9800', margin: '0 0 10px 0' }}>ESI ATSLĒGTS NEAKTIVITĀTES DĒĻ</h2>
          <p style={{ color: '#ccc', lineHeight: 1.5, margin: '0 0 15px 0' }}>
            Tu ilgstoši neatbildēji uz jautājumiem. Pasaki pasākuma vadītājam, lai tevi pieslēdz atpakaļ!
          </p>
          <button onClick={() => setIsDisabledAfk(false)} style={btnJoin}>
            Pārbaudīt statusu 🔄
          </button>
        </div>
      </div>
    );
  }

  if (!scene) {
    return (
      <div style={{ ...fullScreenMobile, backgroundColor: '#000', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <video ref={noSleepVideoRef} playsInline muted loop style={{ display: 'none' }} />

        <div style={mobileHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={keypadBadge}>📟 #{deviceNumber || 1}</div>
            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#ffc107' }}>
              {name} {isTeamMode && teamName && `[${teamName}]`}
            </span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isFullscreenSupported && (
              <button onClick={toggleFullscreen} style={btnFullscreenBadge} title="Pilnekrāns">⛶</button>
            )}
            <button onClick={handleLeaveOrNewGame} style={btnExitSmall}>Iziet</button>
          </div>
        </div>

        <div style={{ margin: 'auto', textAlign: 'center', padding: '15px', width: '90%', maxWidth: '380px', overflowY: 'auto' }}>
          {isTeamMode && isCaptain && (
            <div style={{ ...infoCard, border: '2px solid #ffc107', marginBottom: '15px', background: '#1c1705' }}>
              <div style={{ fontSize: '0.9rem', color: '#ffc107', fontWeight: 'bold' }}>👑 TAVA KOMANDA: {teamName}</div>
              <p style={{ margin: '6px 0 10px 0', fontSize: '1.1rem', color: '#fff', fontWeight: 'bold' }}>
                Parādi šo QR kodu savam galdiņam!
              </p>
              
              <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
                <img
                  src={captainQrUrl}
                  alt="Captain QR"
                  style={{ width: '160px', height: '160px', borderRadius: '10px', border: '3px solid #ffc107', background: '#fff', padding: '6px' }}
                />
              </div>

              <div style={{ fontSize: '0.85rem', color: '#00ff00', fontWeight: 'bold', marginBottom: '6px' }}>
                👥 Pieslēgušies biedri ({myTeammates.length}):
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center', maxHeight: '80px', overflowY: 'auto' }}>
                {myTeammates.map((m) => (
                  <span key={m.id} style={{ background: '#332700', border: '1px solid #ffc107', padding: '3px 8px', borderRadius: '4px', fontSize: '0.8rem', color: '#fff' }}>
                    {m.name} {m.isCaptain && '👑'}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={infoCard}>
            {branding.appLogo && (
              <img
                src={`${MEDIA_BASE_URL}/${branding.appLogo}`}
                alt="Logo"
                style={{ maxHeight: '80px', maxWidth: '80%', marginBottom: '10px', objectFit: 'contain' }}
              />
            )}
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎯</div>
            <h2 style={{ color: '#00e5ff', margin: '0 0 8px 0', fontSize: '1.3rem' }}>PĀRBAUDI PULTI!</h2>
            {isTeamMode && teamName && (
              <div style={{ color: '#00ff00', fontWeight: 'bold', marginBottom: '8px' }}>
                👥 Komanda: {teamName}
              </div>
            )}
            <p style={{ color: '#ccc', fontSize: '0.85rem', lineHeight: 1.4, marginBottom: '15px' }}>
              Spied pogu, lai pārbaudītu darbību — tava bumbiņa lielajā ekrānā pulsēs!
            </p>

            <button onClick={handleTestBuzzer} style={testBuzzerBtn}>
              🔴 PĀRBAUDĪT PULTI ({buzzerTestPresses > 0 ? `#${buzzerTestPresses} 💥` : 'SPIED ŠEIT 🎯'})
            </button>
          </div>
        </div>

        <div style={darkStatusStrip}>
          <span style={{ color: '#00ff00', fontWeight: 'bold', fontSize: '0.85rem' }}>
            ✅ Esi pieslēdzies! Gaidi vadītāja startu...
          </span>
        </div>
      </div>
    );
  }

  if (isGameOver) {
    return (
      <div style={appBgStyle}>
        <div style={infoCard}>
          <div style={{ fontSize: '3.5rem', marginBottom: '10px' }}>🎉</div>
          <h2 style={{ color: '#ffc107', margin: '0 0 10px 0' }}>SPĒLE IR NOSLĒGUSIES!</h2>

          {isTeamMode && teamName && (
            <div style={{ ...rankBadge, borderColor: '#00e5ff', background: '#0a1d2e', marginBottom: '10px' }}>
              <div style={{ fontSize: '0.85rem', color: '#00e5ff', fontWeight: 'bold' }}>👥 KOMANDAS REZULTĀTS ({teamName}):</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', margin: '4px 0' }}>
                <span style={{ fontSize: '2.4rem', fontWeight: 'bold', color: '#00ff00' }}>
                  #{myTeamRank} <span style={{ fontSize: '1.2rem', color: '#888' }}>/ {totalTeamsCount}</span>
                </span>
                {renderRankDeltaPill(teamRankDelta, isBaseline)}
              </div>
              <div style={{ fontSize: '1.05rem', color: '#fff' }}>
                Komandas punkti: <strong style={{ color: 'gold' }}>{currentTeamScoreToDisplay} pt</strong>
              </div>
            </div>
          )}

          <div style={rankBadge}>
            <div style={{ fontSize: '0.85rem', color: '#aaa' }}>👤 Tavs individuālais rezultāts:</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', margin: '4px 0' }}>
              <span style={{ fontSize: '2.2rem', fontWeight: 'bold', color: '#ffc107' }}>
                #{myRank} <span style={{ fontSize: '1.2rem', color: '#888' }}>/ {totalPlayersCount}</span>
              </span>
              {renderRankDeltaPill(rankDelta, isBaseline)}
            </div>
            <div style={{ fontSize: '1.1rem', color: '#fff' }}>
              Individuālie punkti: <strong style={{ color: 'gold' }}>{currentScoreToDisplay} pt</strong>
            </div>
            <div style={{ fontSize: '0.9rem', color: '#00e5ff', marginTop: '4px' }}>
              ⏱️ Atbildes laiks: {formatThinkingTime(currentTimeToDisplay)}
            </div>
          </div>

          <button onClick={handleLeaveOrNewGame} style={btnJoin}>
            🔄 SĀKT JAUNU SPĒLI
          </button>
        </div>
      </div>
    );
  }

  // 🌟 Noklusētie kontaktu lauki, ja studijā nav definēti
  const defaultContactFields = [
    { id: 'fullname', label: 'Vārds, Uzvārds', placeholder: 'Jānis Bērziņš', required: true, type: 'text' },
    { id: 'email', label: 'E-pasta adrese', placeholder: 'janis@piemers.lv', required: true, type: 'email' },
    { id: 'phone', label: 'Tālruņa numurs', placeholder: '+371 20000000', required: false, type: 'tel' },
    { id: 'company', label: 'Uzņēmums / Amats', placeholder: 'SIA Uzņēmums, Projektu vadītājs', required: false, type: 'text' }
  ];

  const activeContactFields = (scene?.config?.contactFields && scene.config.contactFields.length > 0)
    ? scene.config.contactFields
    : defaultContactFields;

  return (
    <div style={appBgStyle}>
      <video ref={noSleepVideoRef} playsInline muted loop style={{ display: 'none' }} />

      <div style={mobileHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={keypadBadge}>📟 #{deviceNumber || 1}</div>
          <span style={{ fontWeight: 'bold', fontSize: '0.9rem', maxWidth: '95px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
          {isTeamMode && teamName && <span style={{ fontSize: '0.75rem', color: '#00e5ff' }}>[{teamName}]</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          {isTeamMode && isCaptain && (
            <button
              onClick={() => setShowCaptainQrModal(true)}
              style={btnCaptainBadge}
              title="Parādīt komandas QR kodu jaunam biedram"
            >
              👑 + Biedrs (QR)
            </button>
          )}

          {isFullscreenSupported && (
            <button
              onClick={toggleFullscreen}
              style={btnFullscreenBadge}
              title="Ieslēgt pilnekrānu"
            >
              {isFullscreen ? '⛶' : '⛶'}
            </button>
          )}

          <div style={{ background: '#000', border: '1px solid #00ff00', borderRadius: '6px', padding: '3px 6px', color: '#00ff00', fontWeight: 'bold', fontSize: '0.8rem' }}>
            PIN: {pin}
          </div>
          <button onClick={handleLeaveOrNewGame} style={btnExitSmall}>Iziet</button>
        </div>
      </div>

      {showCaptainQrModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100dvh',
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(12px)',
            zIndex: 999999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            boxSizing: 'border-box'
          }}
          onClick={() => setShowCaptainQrModal(false)}
        >
          <div
            style={{
              background: '#1c1705',
              border: '2px solid #ffc107',
              borderRadius: '16px',
              padding: '20px',
              maxWidth: '340px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 10px 40px rgba(0,0,0,0.95)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '1rem', color: '#ffc107', fontWeight: 'bold', marginBottom: '4px' }}>
              👑 TAVA KOMANDA: {teamName}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#ccc', marginBottom: '10px' }}>
              Parādi šo QR kodu, lai pievienotu spēlētāju savam galdiņam:
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
              <img
                src={captainQrUrl}
                alt="Captain QR"
                style={{ width: '160px', height: '160px', borderRadius: '12px', background: '#fff', padding: '6px', border: '3px solid #ffc107' }}
              />
            </div>

            <div style={{ fontSize: '0.9rem', color: '#00ff00', fontWeight: 'bold', marginBottom: '8px' }}>
              👥 Pieslēgušies biedri: {myTeammates.length}
            </div>

            <button
              onClick={() => setShowCaptainQrModal(false)}
              style={{
                width: '100%',
                padding: '10px',
                background: '#ffc107',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '0.95rem',
                cursor: 'pointer'
              }}
            >
              Turpināt spēli [✕]
            </button>
          </div>
        </div>
      )}

      <div style={mobileBody}>
        {branding.gameLogoPosition === 'TOP' && renderGameLogo()}

        {subState === 'PAUSED' && (
          <div style={{ ...infoCard, borderColor: '#ff9800', marginBottom: '15px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '8px' }}>⏸️</div>
            <h2 style={{ color: '#ff9800', margin: '0 0 8px 0', fontSize: '1.4rem' }}>SPĒLE IR IEPAUZĒTA</h2>
            <p style={{ color: '#ccc', margin: 0, fontSize: '0.95rem' }}>
              Vadītājs ir iepauzējis laika atskaiti. Pultis īslaicīgi nobloķētas!
            </p>
          </div>
        )}

        {/* 🌟 JAUNS: KONTAKTU SLAIDA ANKETA TĀLRUNĪ */}
        {isContactsScene && subState !== 'PAUSED' && (
          <div style={{ ...infoCard, width: '92%', maxWidth: '380px', maxHeight: '82dvh', overflowY: 'auto', textAlign: 'left', border: '2px solid #00e5ff' }}>
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '4px' }}>📋</div>
              <h2 style={{ color: '#00e5ff', margin: '0 0 4px 0', fontSize: '1.3rem' }}>
                {scene?.config?.contactsTitle || 'DALĪBNIEKA ANKETA'}
              </h2>
              <p style={{ color: '#ccc', fontSize: '0.8rem', margin: 0, lineHeight: 1.3 }}>
                {scene?.config?.contactsDescription || 'Lūdzu, ievadiet savus datus. Šī informācija netiks rādīta uz lielā ekrāna.'}
              </p>
            </div>

            {isContactsSubmitted ? (
              <div style={{ textAlign: 'center', padding: '15px 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: '8px' }}>✅</div>
                <h3 style={{ color: '#00ff00', margin: '0 0 6px 0' }}>PALDIES!</h3>
                <p style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '15px' }}>
                  Tava kontaktinformācija ir veiksmīgi reģistrēta!
                </p>
                <button
                  onClick={() => setIsContactsSubmitted(false)}
                  style={{ ...btnJoin, background: '#333', border: '1px solid #666', fontSize: '0.85rem', padding: '8px 16px' }}
                >
                  ✏️ Labot informāciju
                </button>
              </div>
            ) : (
              <form onSubmit={handleContactsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                {activeContactFields.map((f: any) => {
                  const currentVal = contactsForm[f.id] !== undefined 
                    ? contactsForm[f.id] 
                    : (f.id === 'fullname' || f.id === 'name') ? name : '';

                  return (
                    <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <label style={{ fontSize: '0.75rem', color: '#ffc107', fontWeight: 'bold' }}>
                        {f.label} {f.required && <span style={{ color: '#ff4d4d' }}>*</span>}
                      </label>
                      <input
                        type={f.type || 'text'}
                        required={Boolean(f.required)}
                        placeholder={f.placeholder || ''}
                        value={currentVal}
                        onChange={(e) => {
                          const val = e.target.value;
                          setContactsForm((prev) => ({ ...prev, [f.id]: val }));
                        }}
                        style={{ ...mobileInput, textAlign: 'left', fontSize: '0.9rem', padding: '8px 10px', background: '#000' }}
                      />
                    </div>
                  );
                })}

                <button type="submit" style={{ ...btnJoin, marginTop: '8px', background: '#00e5ff', color: '#000', fontWeight: '900' }}>
                  🚀 IESNIEGT KONTAKTUS
                </button>
              </form>
            )}
          </div>
        )}

        {scene?.type === 'TIMER' && subState !== 'PAUSED' && (
          <div style={infoCard}>
            <div style={{ fontSize: '3.5rem', marginBottom: '8px' }}>⏱️</div>
            <h2 style={{ color: '#00e5ff', margin: '0 0 8px 0', fontSize: '1.4rem' }}>
              {scene?.config?.timerLabel || (scene?.config?.timerType === 'CLOCK' ? 'PULKSTENIS' : 'PĀRTRAUKUMS')}
            </h2>
            <p style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 'bold', lineHeight: 1.4, margin: 0 }}>
              Sekojiet līdzi laikam un informācijai galvenajā ekrānā!
            </p>
          </div>
        )}

        {scene?.type === 'BILLBOARD' && subState !== 'PAUSED' && (
          <div style={infoCard}>
            <div style={{ fontSize: '3.5rem', marginBottom: '10px' }}>👀</div>
            <h2 style={{ color: '#ffc107', margin: '0 0 10px 0', fontSize: '1.4rem' }}>SEKOJIET EKRĀNAM!</h2>
            <p style={{ color: '#fff', fontSize: '1.05rem', lineHeight: 1.5, margin: 0, fontWeight: 'bold' }}>
              Aicinām sekot līdzi informācijai galvenajā ekrānā!
            </p>
          </div>
        )}

        {/* LĪDERU TABULA */}
        {scene?.type === 'LEADERBOARD' && subState !== 'PAUSED' && (
          <div style={infoCard}>
            {isFinalLeaderboard && podiumStage < 3 ? (
              <div>
                <div style={{ fontSize: '3.5rem', marginBottom: '10px' }}>🥇</div>
                <h2 style={{ color: '#ffc107', margin: '0 0 12px 0', fontSize: '1.4rem' }}>FINĀLA APBALVOŠANA</h2>
                <p style={{ color: '#00e5ff', fontSize: '1.05rem', fontWeight: 'bold', lineHeight: 1.5, margin: 0 }}>
                  Skaties lielo ekrānu! Tūlīt tiks paziņoti uzvarētāji...
                </p>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '2.5rem', marginBottom: '6px' }}>
                  {leaderboardType === 'FINAL' ? '👑' : isRoundLb ? '🏆' : '⭐'}
                </div>
                
                <h2 style={{ color: '#ffc107', margin: '0 0 4px 0', fontSize: '1.3rem' }}>
                  {leaderboardType === 'FINAL'
                    ? 'FINĀLA REZULTĀTI'
                    : isRoundLb
                    ? '🏆 KĀRTAS REZULTĀTI'
                    : '⭐ KOPVĒRTĒJUMS'}
                </h2>

                <div style={{ fontSize: '0.8rem', color: isRoundLb ? '#00e5ff' : '#aaa', marginBottom: '10px', fontWeight: 'bold' }}>
                  {isRoundLb ? '📍 Rāda tikai šajā kārtā iegūtos punktus' : '⭐ Visu kārtu kopējā punktu summa'}
                </div>

                {isTeamMode && teamName && (
                  <div style={{ ...rankBadge, borderColor: '#00e5ff', background: '#0a1d2e', padding: '10px', margin: '8px 0' }}>
                    <div style={{ fontSize: '0.8rem', color: '#00e5ff', fontWeight: 'bold' }}>
                      👥 Komanda: {teamName}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '3px 0' }}>
                      <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#00ff00' }}>
                        #{myTeamRank} <span style={{ fontSize: '1rem', color: '#888' }}>/ {totalTeamsCount}</span>
                      </span>
                      {!isRoundLb && renderRankDeltaPill(teamRankDelta, isBaseline)}
                    </div>
                    <div style={{ fontSize: '0.95rem', color: '#fff' }}>
                      {isRoundLb ? 'Komandas punkti šajā kārtā:' : 'Kopējie komandas punkti:'}{' '}
                      <strong style={{ color: 'gold' }}>{currentTeamScoreToDisplay} pt</strong>
                    </div>
                  </div>
                )}

                <div style={{ ...rankBadge, padding: '10px', margin: '8px 0' }}>
                  <div style={{ fontSize: '0.8rem', color: '#aaa' }}>
                    👤 {isRoundLb ? 'Tavs sniegums šajā kārtā:' : 'Tavs kopvērtējuma sniegums:'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '3px 0' }}>
                    <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#ffc107' }}>
                      #{myRank} <span style={{ fontSize: '1rem', color: '#888' }}>/ {totalPlayersCount}</span>
                    </span>
                    {!isRoundLb && renderRankDeltaPill(rankDelta, isBaseline)}
                  </div>
                  
                  <div style={{ fontSize: '1.05rem', color: '#fff', margin: '4px 0' }}>
                    {isRoundLb ? 'Kārtā nopelnīti:' : 'Kopā nopelnīti:'}{' '}
                    <strong style={{ color: 'gold' }}>{currentScoreToDisplay} pt</strong>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: '#00e5ff', marginTop: '4px' }}>
                    ⏱️ {isRoundLb ? 'Kārtas laiks:' : 'Kopējais laiks:'} {formatThinkingTime(currentTimeToDisplay)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ⚡ ĀTRĀ PULTS */}
        {isBuzzerRace && subState !== 'PAUSED' && (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {isMyBuzzerTurn && scene?.config?.buzzerRaceType === 'WITH_OPTIONS' ? (
              <div style={{ width: '100%', textAlign: 'center' }}>
                <div style={textHeaderBadge}>🎉 TAVA KĀRTA! IZVĒLIES ATBILDI:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', margin: '15px 0' }}>
                  {rawOptions.map((opt, i) => (
                    <button
                      key={i}
                      disabled={!!myChoice}
                      onClick={() => handleSingleVoteClick(opt, String.fromCharCode(65 + i))}
                      style={{
                        ...btnVerticalCard,
                        background: myChoice === opt ? '#28a745' : BUTTON_COLORS[i % BUTTON_COLORS.length]
                      }}
                    >
                      <div style={letterBadgeSquare}>{String.fromCharCode(65 + i)}</div>
                      <div style={textOptionFull}>{opt}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', width: '100%' }}>
                <div style={textHeaderBadge}>
                  {subState === 'READY'
                    ? '🔥 IESILDĪŠANĀS (GATAVOJIES!)'
                    : buzzerPressedOrder
                    ? `🎉 NOPIKSTINĀTS #${buzzerPressedOrder}!`
                    : '🚨 SPIED POGU ĀTRĀK PAR CITIEM!'}
                </div>

                <button
                  onClick={handleBuzzerPress}
                  style={{
                    width: '240px',
                    height: '240px',
                    borderRadius: '50%',
                    background: buzzerPressedOrder
                      ? '#28a745'
                      : subState === 'READY'
                      ? 'radial-gradient(circle at 35% 35%, #ff7700, #cc5500, #882200)'
                      : 'radial-gradient(circle at 35% 35%, #ff4d4d, #cc0000, #800000)',
                    border: '8px solid #ffffff',
                    boxShadow: buzzerPressedOrder ? '0 0 50px #28a745' : '0 0 60px rgba(255, 0, 0, 0.8), inset 0 0 30px rgba(255,255,255,0.4)',
                    color: '#fff',
                    fontSize: '2.2rem',
                    fontWeight: '900',
                    cursor: 'pointer',
                    margin: '25px auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.1s ease',
                    touchAction: 'manipulation'
                  }}
                >
                  {buzzerPressedOrder ? '✅ GATAVS!' : subState === 'READY' ? '🔥 TESTĒ' : '⚡ SPIED!'}
                </button>

                <div style={{ color: subState === 'READY' ? '#ffc107' : '#00ff00', fontWeight: 'bold', fontSize: '1rem' }}>
                  {subState === 'READY' ? 'Pārbaudi klikšķi! Gaidi, kad vadītājs startēs laiku...' : buzzerPressedOrder ? 'Atbilde pieņemta! Skaties lielo ekrānu!' : 'Tiklīdz rit laiks, spied pirmais!'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 🔢 SECĪBAS KĀRTOŠANA */}
        {isOrdering && subState !== 'PAUSED' && (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '10px 0' }}>
            {subState === 'READY' && (
              <div style={infoCard}>
                <div style={{ fontSize: '3.5rem', marginBottom: '10px' }}>🔢</div>
                <h2 style={{ color: '#ffc107', margin: '0 0 10px 0' }}>SECĪBAS KĀRTOŠANA</h2>
                <p style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 'bold' }}>Tūlīt parādīsies varianti, ko vajadzēs sakārtot pareizā secībā!</p>
              </div>
            )}

            {subState === 'ACTIVE' && (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                <div style={textHeaderBadge}>
                  {myChoice ? '✅ SECĪBA IESNIEGTA' : '🔢 SAKĀRTO NO AUGŠAS UZ LEJU:'}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '10px 0', flex: 1, overflowY: 'auto' }}>
                  {orderedItems.map((item, idx) => (
                    <div key={`order-${idx}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1c2833', border: '2px solid #00e5ff', borderRadius: '10px', padding: '12px 14px', color: '#fff', fontWeight: 'bold' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: '#00e5ff', fontSize: '1.2rem', fontWeight: '900' }}>#{idx + 1}</span>
                        <span>{item}</span>
                      </div>
                      {!myChoice && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => moveOrderingItem(idx, 'UP')} disabled={idx === 0} style={{ ...btnMoveOrder, opacity: idx === 0 ? 0.3 : 1 }}>🔼</button>
                          <button onClick={() => moveOrderingItem(idx, 'DOWN')} disabled={idx === orderedItems.length - 1} style={{ ...btnMoveOrder, opacity: idx === orderedItems.length - 1 ? 0.3 : 1 }}>🔽</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {!myChoice && (
                  <button onClick={handleOrderingSubmit} style={{ ...btnJoin, width: '100%', padding: '14px', fontSize: '1.1rem' }}>
                    🚀 IESNIEGT SECĪBU
                  </button>
                )}

                {myChoice && (
                  <div style={voteConfirmedBadge}>
                    ✅ Mana secība: {myChoice}
                  </div>
                )}
              </div>
            )}

            {(subState === 'STATS' || subState === 'SUMMARY' || subState === 'REVEAL') && (
              <div style={infoCard}>
                <div style={{ fontSize: '3rem', marginBottom: '10px' }}>{subState === 'REVEAL' ? '🎉' : '⏳'}</div>
                <h2 style={{ color: subState === 'REVEAL' ? '#28a745' : '#ffc107', margin: 0 }}>
                  {subState === 'REVEAL' ? 'PAREIZĀ SECĪBA ATKLĀTA!' : 'BALSOŠANA NOSLĒGUSIES!'}
                </h2>
                <p style={{ color: '#ccc', marginTop: '8px' }}>Skaties pareizo atrisinājumu lielajā ekrānā!</p>
              </div>
            )}
          </div>
        )}

        {/* 🎵 2. MUZIKĀLĀ SPĒLE */}
        {isMusicMode && !isBuzzerRace && !isOrdering && !isContactsScene && scene?.type !== 'LEADERBOARD' && scene?.type !== 'BILLBOARD' && scene?.type !== 'TIMER' && subState !== 'PAUSED' && (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '4px 0', overflowY: 'auto' }}>
            {subState === 'READY' && (
              <div style={infoCard}>
                <div style={{ fontSize: '3.5rem', marginBottom: '10px' }}>🎵</div>
                <h2 style={{ color: '#ff007f', margin: '0 0 10px 0', fontSize: '1.4rem' }}>MUZIKĀLĀ SPĒLE</h2>
                <p style={{ color: '#fff', fontSize: '1rem', lineHeight: 1.4, margin: 0, fontWeight: 'bold' }}>
                  Gatavojies atzīmēt: <br />
                  <span style={{ color: '#00e5ff' }}>1. {scene?.config?.musicCategoryTop || 'Izpildītāju'}</span> + <span style={{ color: '#ff007f' }}>2. {scene?.config?.musicCategoryBottom || 'Dziesmas nosaukumu'}</span>
                </p>
              </div>
            )}

            {subState === 'ACTIVE' && (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ background: 'rgba(0, 229, 255, 0.08)', border: '1px solid #00e5ff', borderRadius: '12px', padding: '10px' }}>
                  <div style={{ fontSize: '0.9rem', color: '#00e5ff', fontWeight: 'bold', marginBottom: '8px', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{scene?.config?.musicCategoryTop || '🎤 Izpildītājs'}:</span>
                    {musicTopChoice && <span style={{ color: '#00ff00' }}>✓ Izvēlēts</span>}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {rawOptions.slice(0, 3).map((opt, i) => {
                      const letter = String.fromCharCode(65 + i);
                      const itemKey = opt || letter;
                      const isChosen = submitMode === 'CONFIRM' 
                        ? stagedMusicTop === itemKey 
                        : (musicTopChoice === itemKey || musicTopChoice === opt || musicTopChoice === letter);

                      return (
                        <button
                          key={i}
                          disabled={submitMode === 'INSTANT' && !!musicTopChoice}
                          onClick={() => handleMusicOptionClick(opt, letter, true)}
                          style={{
                            ...btnVerticalCard,
                            background: isChosen ? '#00e5ff' : 'rgba(0, 229, 255, 0.18)',
                            color: isChosen ? '#000' : '#fff',
                            border: isChosen ? '2px solid #fff' : '1px solid rgba(0, 229, 255, 0.4)',
                            opacity: submitMode === 'INSTANT' && musicTopChoice && !isChosen ? 0.35 : 1
                          }}
                        >
                          <div style={{ ...letterBadgeSquare, background: isChosen ? '#000' : '#00e5ff', color: isChosen ? '#00e5ff' : '#000' }}>
                            {letter}
                          </div>
                          <div style={{ ...textOptionFull, color: isChosen ? '#000' : '#fff' }}>
                            {opt || `Variants ${letter}`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 0, 127, 0.08)', border: '1px solid #ff007f', borderRadius: '12px', padding: '10px' }}>
                  <div style={{ fontSize: '0.9rem', color: '#ff007f', fontWeight: 'bold', marginBottom: '8px', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{scene?.config?.musicCategoryBottom || '🎵 Dziesmas nosaukums'}:</span>
                    {musicBottomChoice && <span style={{ color: '#00ff00' }}>✓ Izvēlēts</span>}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {rawOptions.slice(3, 6).map((opt, i) => {
                      const letter = String.fromCharCode(68 + i);
                      const itemKey = opt || letter;
                      const isChosen = submitMode === 'CONFIRM' 
                        ? stagedMusicBottom === itemKey 
                        : (musicBottomChoice === itemKey || musicBottomChoice === opt || musicBottomChoice === letter);

                      return (
                        <button
                          key={i + 3}
                          disabled={submitMode === 'INSTANT' && !!musicBottomChoice}
                          onClick={() => handleMusicOptionClick(opt, letter, false)}
                          style={{
                            ...btnVerticalCard,
                            background: isChosen ? '#ff007f' : 'rgba(255, 0, 127, 0.18)',
                            color: isChosen ? '#000' : '#fff',
                            border: isChosen ? '2px solid #fff' : '1px solid rgba(255, 0, 127, 0.4)',
                            opacity: submitMode === 'INSTANT' && musicBottomChoice && !isChosen ? 0.35 : 1
                          }}
                        >
                          <div style={{ ...letterBadgeSquare, background: isChosen ? '#000' : '#ff007f', color: isChosen ? '#ff007f' : '#fff' }}>
                            {letter}
                          </div>
                          <div style={{ ...textOptionFull, color: isChosen ? '#000' : '#fff' }}>
                            {opt || `Variants ${letter}`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {submitMode === 'CONFIRM' && !myChoice && (
                  <button
                    onClick={handleMusicConfirmSubmit}
                    disabled={!stagedMusicTop || !stagedMusicBottom}
                    style={{
                      ...btnSubmitMulti,
                      opacity: stagedMusicTop && stagedMusicBottom ? 1 : 0.4,
                      background: stagedMusicTop && stagedMusicBottom ? 'linear-gradient(135deg, #00e5ff, #ff007f)' : '#333'
                    }}
                  >
                    {stagedMusicTop && stagedMusicBottom
                      ? `🚀 IESNIEGT: ${stagedMusicTop} + ${stagedMusicBottom}`
                      : 'Izvēlies 1 izpildītāju + 1 dziesmu'}
                  </button>
                )}

                {myChoice && (
                  <div style={voteConfirmedBadge}>
                    ✅ Atbilde pieņemta: {myChoice}
                  </div>
                )}
              </div>
            )}

            {(subState === 'STATS' || subState === 'SUMMARY' || subState === 'REVEAL') && (
              <div style={infoCard}>
                <div style={{ fontSize: '3rem', marginBottom: '10px' }}>{subState === 'REVEAL' ? '🎉' : '⏳'}</div>
                <h2 style={{ color: subState === 'REVEAL' ? '#28a745' : '#ffc107', margin: 0 }}>
                  {subState === 'REVEAL' ? 'PAREIZĀ ATBILDE ATKLĀTA!' : 'BALSOŠANA NOSLĒGUSIES!'}
                </h2>
                
                {subState === 'REVEAL' && (
                  <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.6)', padding: '12px', borderRadius: '12px', border: '1px solid #333' }}>
                    <div style={{ fontSize: '1.35rem', color: lastQuestionScore > 0 ? '#00ff00' : '#ff4d4d', fontWeight: '900', margin: '4px 0' }}>
                      {lastQuestionScore > 0 ? `🎉 +${lastQuestionScore} pt!` : '❌ 0 pt šajā jautājumā'}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#aaa', marginTop: '6px' }}>
                      Gatavojies nākamajam jautājumam!
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 🅰️ 3. STANDARTA JAUTĀJUMI */}
        {!isMusicMode && !isBuzzerRace && !isOrdering && !isContactsScene && scene?.type !== 'LEADERBOARD' && scene?.type !== 'BILLBOARD' && scene?.type !== 'TIMER' && subState !== 'PAUSED' && (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
            {subState === 'READY' && (
              <div style={infoCard}>
                <div style={{ fontSize: '3.5rem', marginBottom: '10px' }}>⏳</div>
                <h2 style={{ color: '#ffc107', margin: '0 0 12px 0', fontSize: '1.5rem' }}>UZMANĪBU!</h2>
                <p style={{ color: '#fff', fontSize: '1.1rem', lineHeight: 1.5, margin: 0, fontWeight: 'bold' }}>
                  Uzgaidi, tūlīt startēs laiks un parādīsies atbilžu varianti!
                </p>
              </div>
            )}

            {subState === 'ACTIVE' && (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={textHeaderBadge}>
                  {myChoice
                    ? '✅ ATBILDE NOSŪTĪTA'
                    : isMultiSelectMode
                    ? `☑️ ATZĪMĒ ${maxRequiredChoices} VARIANTUS:`
                    : submitMode === 'CONFIRM'
                    ? 'IZVĒLIES UN APSTIPRINI:'
                    : 'SPIED ATBILDI:'}
                </div>

                {shouldShowVerticalCards ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      width: '100%',
                      flex: 1,
                      justifyContent: 'center',
                      maxHeight: '62vh',
                      overflowY: 'auto'
                    }}
                  >
                    {rawOptions.map((opt, i) => {
                      const letter = String.fromCharCode(65 + i);
                      const itemKey = opt || letter;
                      const isSelectedMulti = selectedMultipleOptions.includes(itemKey) || selectedMultipleOptions.includes(opt) || selectedMultipleOptions.includes(letter);
                      const isChosenSingle = myChoice === opt || myChoice === letter;
                      const isStaged = stagedChoice === opt || stagedChoice === letter;
                      const isChosen = isMultiSelectMode ? isSelectedMulti : (myChoice ? isChosenSingle : isStaged);

                      return (
                        <button
                          key={i}
                          disabled={!!myChoice}
                          onClick={() => {
                            if (isMultiSelectMode) toggleMultiSelectOption(itemKey);
                            else handleSingleVoteClick(opt, letter);
                          }}
                          style={{
                            ...btnVerticalCard,
                            background: isChosen ? '#28a745' : BUTTON_COLORS[i % BUTTON_COLORS.length],
                            border: isChosen ? '3px solid #fff' : 'none',
                            opacity: myChoice && !isChosen ? 0.35 : 1,
                            boxShadow: isChosen ? '0 0 25px #28a745' : '0 4px 12px rgba(0,0,0,0.6)'
                          }}
                        >
                          <div style={letterBadgeSquare}>{letter}</div>
                          <div style={textOptionFull}>{opt}</div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${rawOptions.length}, 1fr)`,
                      gap: '8px',
                      width: '100%',
                      flex: 1,
                      alignContent: 'center',
                      maxHeight: '52vh'
                    }}
                  >
                    {rawOptions.map((opt, i) => {
                      const letter = String.fromCharCode(65 + i);
                      const itemKey = opt || letter;
                      const isChosen = myChoice === opt || myChoice === letter;

                      return (
                        <button
                          key={i}
                          disabled={!!myChoice}
                          onClick={() => handleSingleVoteClick(opt, letter)}
                          style={{
                            ...buzzerBtnHorizontal,
                            background: isChosen ? '#28a745' : BUTTON_COLORS[i % BUTTON_COLORS.length],
                            border: isChosen ? '3px solid #fff' : 'none',
                            opacity: myChoice && !isChosen ? 0.35 : 1
                          }}
                        >
                          <span style={{ fontSize: '2.5rem', fontWeight: '900' }}>{letter}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {!isMultiSelectMode && !myChoice && submitMode === 'CONFIRM' && (
                  <button onClick={handleConfirmSingleVote} disabled={!stagedChoice} style={{ ...btnSubmitMulti, opacity: stagedChoice ? 1 : 0.4, background: stagedChoice ? 'linear-gradient(135deg, #28a745, #20c997)' : '#333' }}>
                    {stagedChoice ? `🚀 APSTIPRINĀT ATBILDI (${stagedChoice})` : 'Izvēlies atbildi...'}
                  </button>
                )}

                {isMultiSelectMode && !myChoice && (
                  <button onClick={handleMultiVoteSubmit} disabled={!isExactChoicesSelected} style={{ ...btnSubmitMulti, opacity: isExactChoicesSelected ? 1 : 0.4, background: isExactChoicesSelected ? 'linear-gradient(135deg, #28a745, #20c997)' : '#333' }}>
                    {isExactChoicesSelected ? `🚀 IESNIEGT (${selectedMultipleOptions.length}/${maxRequiredChoices})` : `Izvēlies ${maxRequiredChoices - selectedMultipleOptions.length} vēl`}
                  </button>
                )}

                {myChoice && (
                  <div style={voteConfirmedBadge}>✅ Atbilde ({myChoice}) pieņemta!</div>
                )}
              </div>
            )}

            {(subState === 'STATS' || subState === 'SUMMARY' || subState === 'REVEAL') && (
              <div style={infoCard}>
                <div style={{ fontSize: '3rem', marginBottom: '10px' }}>
                  {subState === 'SUMMARY' ? '⏳' : subState === 'REVEAL' ? '🎉' : '📊'}
                </div>
                <h2 style={{ color: subState === 'SUMMARY' ? '#ffc107' : '#28a745', margin: '0 0 10px 0' }}>
                  {subState === 'SUMMARY'
                    ? 'APKOPO REZULTĀTUS...'
                    : subState === 'REVEAL'
                    ? 'PAREIZĀ ATBILDE ATKLĀTA!'
                    : 'BALSOŠANA NOSLĒGUSIES!'}
                </h2>

                {subState === 'REVEAL' ? (
                  <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.6)', padding: '14px', borderRadius: '12px', border: '1px solid #333' }}>
                    <div style={{ fontSize: '1.4rem', color: lastQuestionScore > 0 ? '#00ff00' : '#ff4d4d', fontWeight: '900', margin: '4px 0' }}>
                      {lastQuestionScore > 0 ? `🎉 +${lastQuestionScore} pt!` : '❌ 0 pt šajā jautājumā'}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#aaa', marginTop: '6px' }}>
                      Gatavojies nākamajam jautājumam!
                    </div>
                  </div>
                ) : (
                  <p style={{ color: '#ccc', fontSize: '1rem', margin: 0 }}>
                    {subState === 'SUMMARY'
                      ? 'Skaties atbilžu kopsavilkumu lielajā ekrānā!'
                      : 'Gaidiet rezultātu atklāšanu...'}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {branding.gameLogoPosition === 'BOTTOM' && renderGameLogo()}
      </div>
    </div>
  );
}

// STILI
const fullScreenMobile: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100vw',
  height: '100dvh',
  color: '#fff',
  fontFamily: 'Segoe UI, Arial, sans-serif',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 999999,
  overflow: 'hidden',
  boxSizing: 'border-box',
  overscrollBehaviorY: 'contain',
  touchAction: 'manipulation'
};

const mobileHeader: React.CSSProperties = {
  height: '50px',
  background: 'rgba(18, 18, 18, 0.92)',
  backdropFilter: 'blur(10px)',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 10px',
  flexShrink: 0
};

const keypadBadge: React.CSSProperties = {
  background: '#ffc107',
  color: '#000',
  fontWeight: 'bold',
  padding: '3px 8px',
  borderRadius: '6px',
  fontSize: '0.85rem'
};

const btnCaptainBadge: React.CSSProperties = {
  background: 'linear-gradient(135deg, #ffc107, #ff9800)',
  color: '#000',
  border: '1px solid #fff',
  padding: '3px 7px',
  borderRadius: '6px',
  fontSize: '0.72rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  touchAction: 'manipulation'
};

const btnFullscreenBadge: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.12)',
  border: '1px solid rgba(255, 255, 255, 0.25)',
  color: '#fff',
  padding: '3px 7px',
  borderRadius: '6px',
  fontSize: '0.8rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  touchAction: 'manipulation'
};

const btnExitSmall: React.CSSProperties = {
  background: 'rgba(50, 50, 50, 0.8)',
  border: '1px solid #555',
  color: '#ccc',
  padding: '3px 8px',
  borderRadius: '4px',
  fontSize: '0.75rem',
  cursor: 'pointer',
  touchAction: 'manipulation'
};

const mobileBody: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 15px',
  overflowY: 'hidden',
  boxSizing: 'border-box'
};

const loginCard: React.CSSProperties = {
  margin: 'auto',
  background: 'rgba(20, 20, 20, 0.92)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: '16px',
  padding: '20px 18px',
  width: '85%',
  maxWidth: '360px',
  textAlign: 'center',
  boxShadow: '0 10px 35px rgba(0,0,0,0.9)'
};

const mobileInput: React.CSSProperties = {
  padding: '10px',
  borderRadius: '8px',
  background: 'rgba(0, 0, 0, 0.8)',
  border: '1px solid #555',
  color: '#fff',
  fontSize: '1rem',
  textAlign: 'center',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box'
};

const btnJoin: React.CSSProperties = {
  padding: '12px',
  borderRadius: '8px',
  background: '#28a745',
  color: '#fff',
  border: 'none',
  fontSize: '1rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  touchAction: 'manipulation'
};

const infoCard: React.CSSProperties = {
  textAlign: 'center',
  background: 'rgba(20, 20, 20, 0.9)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: '16px',
  padding: '18px 14px',
  width: '90%',
  maxWidth: '360px',
  boxShadow: '0 10px 30px rgba(0,0,0,0.9)'
};

const rankBadge: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.75)',
  border: '2px solid #ffc107',
  borderRadius: '10px',
  padding: '10px',
  margin: '8px 0'
};

const textHeaderBadge: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.85)',
  padding: '6px 14px',
  borderRadius: '8px',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  textAlign: 'center',
  color: '#ffc107',
  fontWeight: 'bold',
  fontSize: '0.95rem',
  margin: '0 auto 8px auto'
};

const voteConfirmedBadge: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.85)',
  padding: '8px 16px',
  borderRadius: '8px',
  border: '1px solid #28a745',
  textAlign: 'center',
  color: '#00ff00',
  fontWeight: 'bold',
  fontSize: '1rem',
  marginTop: '8px'
};

const btnSubmitMulti: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  borderRadius: '10px',
  color: '#fff',
  border: '2px solid #fff',
  fontSize: '1.05rem',
  fontWeight: 'bold',
  marginTop: '10px',
  cursor: 'pointer',
  touchAction: 'manipulation'
};

const darkStatusStrip: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.9)',
  padding: '12px',
  textAlign: 'center',
  borderTop: '1px solid rgba(255, 255, 255, 0.1)'
};

const testBuzzerBtn: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  borderRadius: '12px',
  background: 'linear-gradient(135deg, #e63946, #d90429)',
  color: '#fff',
  border: '2px solid #fff',
  fontSize: '1rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  touchAction: 'manipulation'
};

const btnMoveOrder: React.CSSProperties = {
  background: '#333',
  border: '1px solid #666',
  color: '#fff',
  padding: '6px 12px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '1rem',
  touchAction: 'manipulation'
};

const btnVerticalCard: React.CSSProperties = {
  width: '100%',
  minHeight: '48px',
  padding: '8px 12px',
  borderRadius: '10px',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
  boxSizing: 'border-box',
  userSelect: 'none',
  touchAction: 'manipulation',
  border: 'none',
  transition: 'transform 0.1s ease'
};

const letterBadgeSquare: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '6px',
  background: 'rgba(0, 0, 0, 0.35)',
  border: '1.5px solid rgba(255, 255, 255, 0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1.1rem',
  fontWeight: '900',
  flexShrink: 0
};

const textOptionFull: React.CSSProperties = {
  flex: 1,
  textAlign: 'left',
  marginLeft: '12px',
  fontSize: '1rem',
  fontWeight: 'bold',
  lineHeight: 1.25,
  wordBreak: 'break-word'
};

const buzzerBtnHorizontal: React.CSSProperties = {
  width: '100%',
  height: '110px',
  borderRadius: '14px',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxSizing: 'border-box',
  userSelect: 'none',
  touchAction: 'manipulation'
};