import React, { useState, useEffect, useRef } from 'react';
import { BACKEND_URL, getAdminHeaders } from './config';

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

export const getStudioFontSize = (fontSize?: number | string): string => {
  const scaleMultiplier = 1.35;
  if (typeof fontSize === 'number') {
    return `${fontSize * scaleMultiplier * 9.6}px`;
  }
  if (typeof fontSize === 'string') {
    const num = parseFloat(fontSize);
    if (!isNaN(num)) return `${num * scaleMultiplier * 9.6}px`;
  }
  return `${2.2 * scaleMultiplier * 9.6}px`;
};

export const getOptionFontSize = (text: string = ''): string => {
  const len = text.trim().length;
  if (len <= 15) return '15px';
  if (len <= 30) return '13px';
  if (len <= 55) return '11px';
  return '10px';
};

interface MobileBranding {
  appTitle?: string;
  appLogo?: string;
  appBgImage?: string;
  welcomeImage?: string;
  appBgColor?: string;
  lobbyMode?: 'CIRCLE' | 'INTERACTIVE_DOTS';
  optionsRevealTiming?: 'ON_ACTIVE' | 'ALWAYS';
  timerMode?: 'ALL_VOTED' | 'FULL_TIME';
  teamModeEnabled?: boolean;
  teamScoringMode?: 'AVG' | 'SUM';
  predefinedTeams?: string[];
  maxMissedQuestions?: number;
}

interface CanvasElement {
  id: string;
  type: 'QUESTION' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO';
  content: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  bold?: boolean;
  bgColor?: string;
  bgOpacity?: number;
  volume?: number;
  trimStart?: number;
  trimEnd?: number;
  isTrimEndCustom?: boolean;
  visibility?: 'ALWAYS' | 'DURING_QUESTION' | 'UNTIL_REVEAL' | 'AFTER_REVEAL';
  blurMode?: 'NONE' | 'STATIC' | 'PROGRESSIVE';
  blurAmount?: number;
}

interface Slide {
  id: string;
  title: string;
  type: 'QUESTION' | 'BILLBOARD' | 'LEADERBOARD' | 'MAJORITY';
  config: {
    duration: number;
    points: number;
    pointsMin?: number;
    pointsMax?: number;
    scoringMode?: 'FIXED' | 'DECREASING';
    speedBonusEnabled?: boolean;
    selectionMode?: 'ALL' | 'ANY_ONE';
    autoStart?: boolean;
    question?: string;
    notes?: string;
    optionsCount: number;
    options: string[];
    correctAnswers: string[];
    answerCorrectness?: Record<string, number>;
    optionsLayout: 'INDIVIDUAL' | 'RIGHT_COLUMN' | 'GRID';
    optionsPositions?: Record<string | number, { x: number; y: number; w: number; h: number }>;
    optionsColor?: string;
    optionsBgColor?: string;
    optionsBgOpacity?: number;
    optionsCorrectColor?: string;
    backgroundUrl?: string;
    lbType?: 'ROUND' | 'TOTAL' | 'FINAL';
    layout: CanvasElement[];
  };
}

export default function Studio() {
  const [activeFolder, setActiveFolder] = useState<string>(
    localStorage.getItem('event_studio_folder') || ''
  );
  const [projectFile, setProjectFile] = useState('mans_quiz.json');
  const [availableProjects, setAvailableProjects] = useState<string[]>([]);
  const [mediaList, setMediaList] = useState<string[]>([]);
  const [isSnapToGrid, setIsSnapToGrid] = useState(true);

  const [mobileBranding, setMobileBranding] = useState<MobileBranding>({
    appTitle: 'EVENT BUZZER',
    appLogo: '',
    appBgImage: '',
    welcomeImage: '',
    appBgColor: '#121212',
    lobbyMode: 'CIRCLE',
    optionsRevealTiming: 'ON_ACTIVE',
    timerMode: 'ALL_VOTED',
    teamModeEnabled: false,
    teamScoringMode: 'AVG',
    predefinedTeams: ['1. Galdiņš', '2. Galdiņš', '3. Galdiņš', 'VIP Komanda'],
    maxMissedQuestions: 5
  });

  const [newTeamInput, setNewTeamInput] = useState('');

  const [slides, setSlides] = useState<Slide[]>([
    {
      id: 'slide-1',
      title: '1. Jautājums',
      type: 'QUESTION',
      config: {
        duration: 30,
        points: 10,
        pointsMin: 1,
        pointsMax: 10,
        scoringMode: 'FIXED',
        speedBonusEnabled: false,
        selectionMode: 'ALL',
        autoStart: false,
        notes: 'Paskaidrojums vadītājam: Rīga dibināta 1201. gadā.',
        optionsCount: 4,
        options: ['Rīga', 'Liepāja', 'Daugavpils', 'Jelgava'],
        correctAnswers: ['Rīga'],
        answerCorrectness: { Rīga: 100 },
        optionsLayout: 'INDIVIDUAL',
        optionsPositions: {},
        optionsColor: '#ffffff',
        optionsBgColor: '#000000',
        optionsBgOpacity: 85,
        optionsCorrectColor: '#00ff00',
        layout: [
          {
            id: 'q-box',
            type: 'QUESTION',
            content: 'Kura ir Latvijas galvaspilsēta?',
            x: 15,
            y: 10,
            w: 70,
            h: 15,
            fontSize: 2.2,
            fontFamily: 'Segoe UI',
            color: '#ffffff',
            bgColor: '#000000',
            bgOpacity: 85,
            bold: true,
            visibility: 'ALWAYS'
          }
        ]
      }
    }
  ]);

  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [selectedSlideIndices, setSelectedSlideIndices] = useState<number[]>([0]);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [copiedSlides, setCopiedSlides] = useState<Slide[] | null>(null);

  const [marqueeBox, setMarqueeBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const [history, setHistory] = useState<Slide[][]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const isHistoryAction = useRef(false);

  const [dragState, setDragState] = useState<{
    mode: 'MOVE' | 'RESIZE_RIGHT' | 'RESIZE_LEFT';
    primaryId: string;
    startX: number;
    startY: number;
    elementsSnapshot: { id: string; target: 'LAYOUT' | 'OPTION'; origX: number; origY: number; origW: number; origH: number }[];
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const previewMediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const activeSlide = slides[activeSlideIdx] || slides[0];

  const selectedElements = (activeSlide?.config?.layout || []).filter((el) =>
    selectedElementIds.includes(el.id)
  );
  const primarySelectedElement = selectedElements[selectedElements.length - 1] || null;

  const pushToHistory = (newSlides: Slide[]) => {
    if (isHistoryAction.current) {
      isHistoryAction.current = false;
      return;
    }
    const currentCloned = JSON.parse(JSON.stringify(newSlides));
    setHistory((prev) => {
      const next = prev.slice(0, historyIdx + 1);
      if (next.length > 30) next.shift();
      return [...next, currentCloned];
    });
    setHistoryIdx((prev) => Math.min(prev + 1, 30));
  };

  const handleUndo = () => {
    if (historyIdx > 0) {
      isHistoryAction.current = true;
      const targetState = history[historyIdx - 1];
      setHistoryIdx(historyIdx - 1);
      setSlides(JSON.parse(JSON.stringify(targetState)));
      if (activeSlideIdx >= targetState.length) setActiveSlideIdx(targetState.length - 1);
    }
  };

  const handleRedo = () => {
    if (historyIdx < history.length - 1) {
      isHistoryAction.current = true;
      const targetState = history[historyIdx + 1];
      setHistoryIdx(historyIdx + 1);
      setSlides(JSON.parse(JSON.stringify(targetState)));
      if (activeSlideIdx >= targetState.length) setActiveSlideIdx(targetState.length - 1);
    }
  };

  const updateActiveSlide = (updater: (draft: Slide) => void) => {
    setSlides((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      updater(copy[activeSlideIdx]);
      pushToHistory(copy);
      return copy;
    });
  };

  const updateSelectedElements = (updater: (el: CanvasElement) => void) => {
    updateActiveSlide((s) => {
      s.config.layout.forEach((el) => {
        if (selectedElementIds.includes(el.id)) {
          updater(el);
        }
      });
    });
  };

  const deleteSelectedElements = () => {
    if (selectedElementIds.length === 0) return;
    updateActiveSlide((s) => {
      s.config.layout = s.config.layout.filter((x) => !selectedElementIds.includes(x.id));
    });
    setSelectedElementIds([]);
  };

  const handleSaveProject = async () => {
    const cleanFileName = projectFile.trim().endsWith('.json') ? projectFile.trim() : `${projectFile.trim()}.json`;
    if (availableProjects.includes(cleanFileName)) {
      const isConfirmed = window.confirm(
        `⚠️ UZMANĪBU!\n\nFails "${cleanFileName}" jau eksistē mapē:\n${activeFolder}\n\nVai vēlaties to pārrakstīt?`
      );
      if (!isConfirmed) return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/save-to-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminHeaders()
        },
        body: JSON.stringify({
          fileName: cleanFileName,
          data: {
            scenes: slides,
            branding: mobileBranding
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Projekts veiksmīgi saglabāts:\n${data.fullPath || data.fileName}`);
        setProjectFile(data.fileName);
        syncWorkingFolder();
      }
    } catch {
      alert('❌ Kļūda saglabājot projektu!');
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isTyping = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveProject();
        return;
      }

      if (isTyping) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementIds.length > 0) {
          e.preventDefault();
          deleteSelectedElements();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedSlideIndices.length > 0) {
          e.preventDefault();
          const toCopy = selectedSlideIndices
            .sort((a, b) => a - b)
            .map((idx) => JSON.parse(JSON.stringify(slides[idx])));
          setCopiedSlides(toCopy);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (copiedSlides && copiedSlides.length > 0) {
          e.preventDefault();
          const insertIdx = activeSlideIdx + 1;
          const newPasted = copiedSlides.map((s, i) => {
            const cloned = JSON.parse(JSON.stringify(s));
            cloned.id = `slide-${Date.now()}-${i}`;
            cloned.title = `${cloned.title} (Kopija)`;
            if (cloned.config?.layout) {
              cloned.config.layout = cloned.config.layout.map((el: any, elI: number) => ({
                ...el,
                id: `el-${Date.now()}-${i}-${elI}`
              }));
            }
            return cloned;
          });

          const updated = [...slides];
          updated.splice(insertIdx, 0, ...newPasted);
          setSlides(updated);
          pushToHistory(updated);

          const newIndices = newPasted.map((_, i) => insertIdx + i);
          setSelectedSlideIndices(newIndices);
          setActiveSlideIdx(insertIdx);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [historyIdx, history, activeSlideIdx, selectedSlideIndices, copiedSlides, slides, selectedElementIds, projectFile, availableProjects, mobileBranding]);

  const syncWorkingFolder = async (folderToSet?: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/set-path`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminHeaders()
        },
        body: JSON.stringify({ path: folderToSet || activeFolder })
      });
      const data = await res.json();
      if (data.success) {
        setActiveFolder(data.currentPath);
        localStorage.setItem('event_studio_folder', data.currentPath);
        if (Array.isArray(data.projects)) setAvailableProjects(data.projects);
        if (Array.isArray(data.media)) setMediaList(data.media);
      }
    } catch {
      console.error('Neizdevās sinhronizēt mapi');
    }
  };

  useEffect(() => {
    syncWorkingFolder();
    pushToHistory(slides);
  }, []);

  const handleSlideDropReorder = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const updated = [...slides];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    setSlides(updated);
    pushToHistory(updated);
    setActiveSlideIdx(toIdx);
    setSelectedSlideIndices([toIdx]);
  };

  const handleAddSlide = () => {
    const newSlide: Slide = {
      id: `slide-${Date.now()}`,
      title: `${slides.length + 1}. Slaids`,
      type: 'QUESTION',
      config: {
        duration: 30,
        points: 10,
        pointsMin: 1,
        pointsMax: 10,
        scoringMode: 'FIXED',
        speedBonusEnabled: false,
        selectionMode: 'ALL',
        autoStart: false,
        notes: '',
        optionsCount: 4,
        options: ['Variants A', 'Variants B', 'Variants C', 'Variants D'],
        correctAnswers: ['Variants A'],
        answerCorrectness: { 'Variants A': 100 },
        optionsLayout: 'INDIVIDUAL',
        optionsPositions: {},
        optionsColor: '#ffffff',
        optionsBgColor: '#000000',
        optionsBgOpacity: 85,
        optionsCorrectColor: '#00ff00',
        backgroundUrl: activeSlide?.config?.backgroundUrl,
        layout: [
          {
            id: `q-${Date.now()}`,
            type: 'QUESTION',
            content: 'Ievadiet jautājumu šeit...',
            x: 15,
            y: 10,
            w: 70,
            h: 15,
            fontSize: 2.2,
            fontFamily: 'Segoe UI',
            color: '#ffffff',
            bgColor: '#000000',
            bgOpacity: 85,
            bold: true,
            visibility: 'ALWAYS'
          }
        ]
      }
    };
    const updated = [...slides, newSlide];
    setSlides(updated);
    pushToHistory(updated);
    setActiveSlideIdx(updated.length - 1);
    setSelectedSlideIndices([updated.length - 1]);
    setSelectedElementIds([]);
    setEditingElementId(null);
  };

  const handleDuplicateSpecificSlide = (idx: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const source = JSON.parse(JSON.stringify(slides[idx]));
    source.id = `slide-${Date.now()}`;
    source.title = `${source.title} (Kopija)`;
    const updated = [...slides];
    updated.splice(idx + 1, 0, source);
    setSlides(updated);
    pushToHistory(updated);
    setActiveSlideIdx(idx + 1);
    setSelectedSlideIndices([idx + 1]);
  };

  const handleDeleteSpecificSlide = (idxToDelete: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (slides.length <= 1) return alert('Nevar izdzēst vienīgo slaidu!');
    const updated = slides.filter((_, i) => i !== idxToDelete);
    setSlides(updated);
    pushToHistory(updated);
    const newIdx = Math.max(0, idxToDelete - 1);
    setActiveSlideIdx(newIdx);
    setSelectedSlideIndices([newIdx]);
  };

  const startDragOrResize = (
    e: React.MouseEvent,
    mode: 'MOVE' | 'RESIZE_RIGHT' | 'RESIZE_LEFT',
    primaryId: string
  ) => {
    if (editingElementId === primaryId) return;
    e.stopPropagation();
    e.preventDefault();

    let currentSelection = [...selectedElementIds];
    if (!currentSelection.includes(primaryId)) {
      currentSelection = e.ctrlKey || e.metaKey ? [...currentSelection, primaryId] : [primaryId];
      setSelectedElementIds(currentSelection);
    }

    const snapshot: { id: string; target: 'LAYOUT' | 'OPTION'; origX: number; origY: number; origW: number; origH: number }[] = [];

    currentSelection.forEach((id) => {
      if (id.startsWith('opt-index-')) {
        const idx = Number(id.replace('opt-index-', ''));
        const pos = activeSlide.config.optionsPositions?.[idx] || {
          x: 10 + (idx % 2) * 42,
          y: 58 + Math.floor(idx / 2) * 13,
          w: 38,
          h: 10
        };
        snapshot.push({ id, target: 'OPTION', origX: pos.x, origY: pos.y, origW: pos.w, origH: pos.h });
      } else {
        const el = activeSlide.config.layout.find((x) => x.id === id);
        if (el) snapshot.push({ id: el.id, target: 'LAYOUT', origX: el.x, origY: el.y, origW: el.w, origH: el.h });
      }
    });

    setDragState({
      mode,
      primaryId,
      startX: e.clientX,
      startY: e.clientY,
      elementsSnapshot: snapshot
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (marqueeBox && canvasRef.current) {
      setMarqueeBox((prev) => (prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null));
      return;
    }

    if (!dragState || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const deltaXPercent = ((e.clientX - dragState.startX) / rect.width) * 100;
    const deltaYPercent = ((e.clientY - dragState.startY) / rect.height) * 100;

    updateActiveSlide((s) => {
      if (!s.config.optionsPositions) s.config.optionsPositions = {};

      dragState.elementsSnapshot.forEach((item) => {
        const optionIdx = item.target === 'OPTION' ? Number(item.id.replace('opt-index-', '')) : null;

        if (dragState.mode === 'MOVE') {
          let newX = Math.round(item.origX + deltaXPercent);
          let newY = Math.round(item.origY + deltaYPercent);
          if (isSnapToGrid) {
            newX = Math.round(newX / 2) * 2;
            newY = Math.round(newY / 2) * 2;
          }
          newX = Math.max(0, Math.min(newX, 90));
          newY = Math.max(0, Math.min(newY, 90));

          if (item.target === 'LAYOUT') {
            const el = s.config.layout.find((x) => x.id === item.id);
            if (el) { el.x = newX; el.y = newY; }
          } else if (optionIdx !== null) {
            const curPos = s.config.optionsPositions[optionIdx] || { x: 10, y: 58, w: 38, h: 10 };
            s.config.optionsPositions[optionIdx] = { ...curPos, x: newX, y: newY };
          }
        } else if (dragState.mode === 'RESIZE_RIGHT' && item.id === dragState.primaryId) {
          let newW = Math.round(item.origW + deltaXPercent);
          let newH = Math.round(item.origH + deltaYPercent);
          if (isSnapToGrid) {
            newW = Math.round(newW / 2) * 2;
            newH = Math.round(newH / 2) * 2;
          }
          newW = Math.max(8, Math.min(newW, 100));
          newH = Math.max(4, Math.min(newH, 100));

          if (item.target === 'LAYOUT') {
            const el = s.config.layout.find((x) => x.id === item.id);
            if (el) { el.w = newW; el.h = newH; }
          } else if (optionIdx !== null) {
            const curPos = s.config.optionsPositions[optionIdx] || { x: 10, y: 58, w: 38, h: 10 };
            s.config.optionsPositions[optionIdx] = { ...curPos, w: newW, h: newH };
          }
        } else if (dragState.mode === 'RESIZE_LEFT' && item.id === dragState.primaryId) {
          let newX = Math.round(item.origX + deltaXPercent);
          let newW = Math.round(item.origW - deltaXPercent);
          let newH = Math.round(item.origH + deltaYPercent);

          if (isSnapToGrid) {
            newX = Math.round(newX / 2) * 2;
            newW = Math.round(newW / 2) * 2;
            newH = Math.round(newH / 2) * 2;
          }
          if (newW >= 8 && newX >= 0) {
            if (item.target === 'LAYOUT') {
              const el = s.config.layout.find((x) => x.id === item.id);
              if (el) { el.x = newX; el.w = newW; el.h = newH; }
            } else if (optionIdx !== null) {
              const curPos = s.config.optionsPositions[optionIdx] || { x: 10, y: 58, w: 38, h: 10 };
              s.config.optionsPositions[optionIdx] = { ...curPos, x: newX, w: newW, h: newH };
            }
          }
        }
      });
    });
  };

  const handleMouseUp = () => {
    if (marqueeBox && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x1 = Math.min(marqueeBox.startX, marqueeBox.currentX) - rect.left;
      const x2 = Math.max(marqueeBox.startX, marqueeBox.currentX) - rect.left;
      const y1 = Math.min(marqueeBox.startY, marqueeBox.currentY) - rect.top;
      const y2 = Math.max(marqueeBox.startY, marqueeBox.currentY) - rect.top;

      const newlySelected: string[] = [];

      activeSlide.config.layout.forEach((el) => {
        const elPxX = (el.x / 100) * rect.width;
        const elPxY = (el.y / 100) * rect.height;
        const elPxW = (el.w / 100) * rect.width;
        const elPxH = (el.h / 100) * rect.height;
        if (x1 < elPxX + elPxW && x2 > elPxX && y1 < elPxY + elPxH && y2 > elPxY) {
          newlySelected.push(el.id);
        }
      });

      setSelectedElementIds(newlySelected);
      setMarqueeBox(null);
    }
    setDragState(null);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const formData = new FormData();
      formData.append('mediaFile', file);

      try {
        const res = await fetch(`${BACKEND_URL}/api/upload-media`, {
          method: 'POST',
          headers: getAdminHeaders(),
          body: formData
        });
        const data = await res.json();
        if (data.success) {
          syncWorkingFolder();
          addMediaElement(data.fileName);
        }
      } catch {
        alert('Kļūda ielādējot failu!');
      }
    }
  };

  const addMediaElement = (fileName: string) => {
    const isVideo = /\.(mp4|mov|webm)$/i.test(fileName);
    const isAudio = /\.(mp3|wav|ogg)$/i.test(fileName);

    const newElement: CanvasElement = {
      id: `media-${Date.now()}`,
      type: isVideo ? 'VIDEO' : isAudio ? 'AUDIO' : 'IMAGE',
      content: fileName,
      x: 30,
      y: 30,
      w: 40,
      h: isAudio ? 12 : 35,
      volume: 100,
      trimStart: 0,
      trimEnd: 30,
      isTrimEndCustom: false,
      visibility: 'DURING_QUESTION',
      blurMode: 'NONE',
      blurAmount: 12
    };

    updateActiveSlide((s) => s.config.layout.push(newElement));
    setSelectedElementIds([newElement.id]);
  };

  const playPreviewFragment = (el: CanvasElement) => {
    if (!previewMediaRef.current) return;
    const media = previewMediaRef.current;
    media.volume = (el.volume !== undefined ? el.volume : 100) / 100;
    media.currentTime = el.trimStart || 0;
    media.play().catch(() => {});

    media.ontimeupdate = () => {
      if (el.trimEnd && media.currentTime >= el.trimEnd) {
        media.pause();
        media.ontimeupdate = null;
      }
    };
  };

  const stopPreviewFragment = () => {
    if (previewMediaRef.current) previewMediaRef.current.pause();
  };

  const handleOpenProject = async (name: string) => {
    if (!name) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/load-project/${encodeURIComponent(name)}`, {
        headers: getAdminHeaders()
      });
      const data = await res.json();
      if (data.scenes && Array.isArray(data.scenes)) {
        setSlides(data.scenes);
        if (data.branding) setMobileBranding((prev) => ({ ...prev, ...data.branding }));
        setProjectFile(name);
        pushToHistory(data.scenes);
        setActiveSlideIdx(0);
        setSelectedSlideIndices([0]);
        setSelectedElementIds([]);
      }
    } catch {
      alert('❌ Neizdevās atvērt projektu!');
    }
  };

  const handleAddTeam = () => {
    if (!newTeamInput.trim()) return;
    const current = mobileBranding.predefinedTeams || [];
    if (!current.includes(newTeamInput.trim())) {
      setMobileBranding({ ...mobileBranding, predefinedTeams: [...current, newTeamInput.trim()] });
    }
    setNewTeamInput('');
  };

  const handleRemoveTeam = (teamToRemove: string) => {
    const current = mobileBranding.predefinedTeams || [];
    setMobileBranding({ ...mobileBranding, predefinedTeams: current.filter((t) => t !== teamToRemove) });
  };

  const hasMultipleSelection = selectedElements.length > 1;

  return (
    <div style={studioLayout} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      {/* 1. RIBBON */}
      <div style={ribbonStyle}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold', color: '#ffc107', fontSize: '1.1rem' }}>EVENT STUDIO</span>

          <button style={btnAction} onClick={handleUndo} title="Atsaukt (Ctrl+Z)">
            ↩️ Atsaukt
          </button>
          <button style={btnAction} onClick={handleRedo} title="Pārdarīt (Ctrl+Y)">
            ↪️ Pārdarīt
          </button>

          <button
            style={btnAction}
            onClick={() => {
              if (window.confirm('Sākt jaunu projektu?')) {
                setProjectFile('jauns_projekts.json');
                const initial: Slide[] = [
                  {
                    id: 'slide-1',
                    title: '1. Slaids',
                    type: 'QUESTION',
                    config: {
                      duration: 30,
                      points: 10,
                      optionsCount: 4,
                      options: ['A', 'B', 'C', 'D'],
                      correctAnswers: ['A'],
                      answerCorrectness: { A: 100 },
                      selectionMode: 'ALL',
                      autoStart: false,
                      optionsLayout: 'INDIVIDUAL',
                      optionsPositions: {},
                      optionsColor: '#ffffff',
                      optionsBgColor: '#000000',
                      optionsBgOpacity: 85,
                      optionsCorrectColor: '#00ff00',
                      layout: []
                    }
                  }
                ];
                setSlides(initial);
                pushToHistory(initial);
                setActiveSlideIdx(0);
                setSelectedSlideIndices([0]);
              }
            }}
          >
            📄 Jauns
          </button>

          <button style={{ ...btnAction, background: '#28a745' }} onClick={handleSaveProject} title="Saglabāt (Ctrl + S)">
            💾 Saglabāt [Ctrl+S]
          </button>

          <input
            style={inputName}
            value={projectFile}
            onChange={(e) => setProjectFile(e.target.value)}
            title="Projekta nosaukums"
          />

          <select style={selectOpen} onChange={(e) => e.target.value && handleOpenProject(e.target.value)} value="">
            <option value="">📂 Atvērt esošu...</option>
            {availableProjects.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            style={btnAction}
            onClick={() => {
              const newText: CanvasElement = {
                id: `txt-${Date.now()}`,
                type: 'TEXT',
                content: 'Teksts / Norāde',
                x: 25,
                y: 35,
                w: 50,
                h: 12,
                fontSize: 2.2,
                fontFamily: 'Segoe UI',
                color: '#ffffff',
                bgColor: '#000000',
                bgOpacity: 85,
                bold: true,
                visibility: 'ALWAYS'
              };
              updateActiveSlide((s) => s.config.layout.push(newText));
              setSelectedElementIds([newText.id]);
            }}
          >
            🔤 Pievienot tekstu
          </button>

          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: '#ccc' }}>
            <input type="checkbox" checked={isSnapToGrid} onChange={(e) => setIsSnapToGrid(e.target.checked)} />
            Snap Grid
          </label>
        </div>
      </div>

      {/* 2. MAPES JOSLA */}
      <div style={folderBar}>
        <span style={{ color: '#aaa', fontSize: '0.85rem' }}>📁 Aktuālā darba mape:</span>
        <input
          style={folderInput}
          value={activeFolder}
          onChange={(e) => setActiveFolder(e.target.value)}
          placeholder="C:/ManiProjekti"
        />
        <button
          style={btnSmallFolder}
          onClick={() => {
            syncWorkingFolder(activeFolder);
            alert(`Mape nomainīta uz: ${activeFolder}`);
          }}
        >
          Nomainīt & Pārskenēt
        </button>
      </div>

      {/* 3. GALVENĀ ZONA */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* KREISĀ PUSE: Slaidi */}
        <div style={sidebarLeft}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontWeight: 'bold', color: '#888', fontSize: '0.85rem' }}>
              SLAIDI ({slides.length})
            </span>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {slides.map((s, idx) => {
              const isMultiSelected = selectedSlideIndices.includes(idx);
              const isCurrentActive = idx === activeSlideIdx;

              return (
                <div
                  key={s.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', String(idx))}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const fromIdx = Number(e.dataTransfer.getData('text/plain'));
                    if (!isNaN(fromIdx)) handleSlideDropReorder(fromIdx, idx);
                  }}
                  onClick={(e) => {
                    if (e.ctrlKey || e.metaKey) {
                      if (selectedSlideIndices.includes(idx)) {
                        if (selectedSlideIndices.length > 1) {
                          setSelectedSlideIndices(selectedSlideIndices.filter((i) => i !== idx));
                        }
                      } else {
                        setSelectedSlideIndices([...selectedSlideIndices, idx]);
                      }
                      setActiveSlideIdx(idx);
                    } else {
                      setSelectedSlideIndices([idx]);
                      setActiveSlideIdx(idx);
                      setSelectedElementIds([]);
                      setEditingElementId(null);
                    }
                  }}
                  style={{
                    ...slideThumb,
                    borderColor: isMultiSelected ? '#007bff' : '#333',
                    background: isCurrentActive ? '#2a2a2a' : isMultiSelected ? '#1a2a3a' : '#1c1c1c'
                  }}
                  title="Pārvelc ar peli, vai kopē ar Ctrl+C / Ctrl+V"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                      {s.config?.autoStart && <span title="Automātiskais starts" style={{ color: '#00e5ff', marginRight: '4px' }}>⚡</span>}
                      ☰ {idx + 1}. {s.title}
                    </span>

                    <div style={{ display: 'flex', gap: '3px' }} onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => handleDuplicateSpecificSlide(idx, e)} style={iconBtnSmall} title="Kopēt">
                        📋
                      </button>
                      {slides.length > 1 && (
                        <button onClick={(e) => handleDeleteSpecificSlide(idx, e)} style={{ ...iconBtnSmall, color: '#dc3545' }} title="Dzēst">
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#ffc107', marginTop: '3px' }}>
                    {s.type} {s.type === 'LEADERBOARD' && `(${s.config.lbType || 'TOTAL'})`}
                  </div>
                </div>
              );
            })}

            <button onClick={handleAddSlide} style={btnAddSlideUnderList}>
              ➕ Pievienot jaunu slaidu
            </button>
          </div>
        </div>

        {/* CENTRS: Kanva */}
        <div style={canvasContainer}>
          <div
            ref={canvasRef}
            style={{
              ...canvasBoard,
              backgroundImage: activeSlide?.config?.backgroundUrl
                ? `url(${MEDIA_BASE_URL}/${activeSlide.config.backgroundUrl})`
                : 'none',
              backgroundSize: 'cover'
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                if (!e.ctrlKey && !e.metaKey) {
                  setSelectedElementIds([]);
                  setEditingElementId(null);
                }
                setMarqueeBox({
                  startX: e.clientX,
                  startY: e.clientY,
                  currentX: e.clientX,
                  currentY: e.clientY
                });
              }
            }}
          >
            {marqueeBox && canvasRef.current && (
              <div
                style={{
                  position: 'absolute',
                  left: `${Math.min(marqueeBox.startX, marqueeBox.currentX) - canvasRef.current.getBoundingClientRect().left}px`,
                  top: `${Math.min(marqueeBox.startY, marqueeBox.currentY) - canvasRef.current.getBoundingClientRect().top}px`,
                  width: `${Math.abs(marqueeBox.currentX - marqueeBox.startX)}px`,
                  height: `${Math.abs(marqueeBox.currentY - marqueeBox.startY)}px`,
                  background: 'rgba(0, 123, 255, 0.25)',
                  border: '1px solid #007bff',
                  pointerEvents: 'none',
                  zIndex: 100
                }}
              />
            )}

            {/* KANVAS ELEMENTI */}
            {activeSlide?.config?.layout?.map((el) => {
              const isSelected = selectedElementIds.includes(el.id);
              const isEditing = editingElementId === el.id;
              const bgRgba = hexToRgba(el.bgColor || '#000000', el.bgOpacity ?? (el.type === 'QUESTION' ? 85 : 60));
              const blurVal = (el.blurMode === 'STATIC' || el.blurMode === 'PROGRESSIVE') ? `${el.blurAmount || 12}px` : 'none';
              const calculatedFontSize = getStudioFontSize(el.fontSize);

              return (
                <div
                  key={el.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedElementIds(e.ctrlKey || e.metaKey ? [...selectedElementIds, el.id] : [el.id]);
                  }}
                  onMouseDown={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.dataset.role === 'resize-handle') return;
                    startDragOrResize(e, 'MOVE', el.id);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (el.type === 'QUESTION' || el.type === 'TEXT') setEditingElementId(el.id);
                  }}
                  style={{
                    position: 'absolute',
                    left: `${el.x}%`,
                    top: `${el.y}%`,
                    width: `${el.w}%`,
                    minHeight: `${el.h}%`,
                    height: 'auto',
                    border: isSelected ? '2px dashed #00ff00' : 'none',
                    cursor: isEditing ? 'text' : 'move',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: el.type === 'QUESTION' || el.type === 'TEXT' ? bgRgba : 'transparent',
                    backdropFilter: el.type === 'QUESTION' || el.type === 'TEXT' ? 'blur(6px)' : 'none',
                    borderRadius: el.type === 'QUESTION' ? '12px' : '6px',
                    padding: '10px 15px',
                    boxSizing: 'border-box',
                    zIndex: isSelected ? 25 : 5,
                    fontFamily: el.fontFamily || 'Segoe UI',
                    fontWeight: el.fontWeight || (el.bold ? 'bold' : 'normal')
                  }}
                >
                  {el.type === 'QUESTION' || el.type === 'TEXT' ? (
                    isEditing ? (
                      <textarea
                        autoFocus
                        value={el.content}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateActiveSlide((s) => {
                            const item = s.config.layout.find((x) => x.id === el.id);
                            if (item) item.content = val;
                          });
                        }}
                        onBlur={() => setEditingElementId(null)}
                        style={{
                          ...inlineTextArea,
                          color: el.color || '#fff',
                          fontFamily: el.fontFamily || 'Segoe UI',
                          fontSize: calculatedFontSize,
                          fontWeight: el.fontWeight || (el.bold ? 'bold' : 'normal')
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          fontSize: calculatedFontSize,
                          color: el.color || '#fff',
                          textAlign: 'center',
                          width: '100%',
                          wordBreak: 'break-word',
                          whiteSpace: 'pre-wrap',
                          fontFamily: el.fontFamily || 'Segoe UI',
                          fontWeight: el.fontWeight || (el.bold ? 'bold' : 'normal')
                        }}
                      >
                        {el.content}
                      </span>
                    )
                  ) : el.type === 'IMAGE' ? (
                    <img
                      src={`${MEDIA_BASE_URL}/${el.content}`}
                      alt="img"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        pointerEvents: 'none',
                        filter: blurVal !== 'none' ? `blur(${blurVal})` : 'none',
                        transition: 'filter 0.3s ease'
                      }}
                    />
                  ) : el.type === 'VIDEO' ? (
                    <video
                      ref={(r) => {
                        if (isSelected) previewMediaRef.current = r;
                      }}
                      src={`${MEDIA_BASE_URL}/${el.content}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        pointerEvents: 'none',
                        filter: blurVal !== 'none' ? `blur(${blurVal})` : 'none',
                        transition: 'filter 0.3s ease'
                      }}
                    />
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <audio
                        ref={(r) => {
                          if (isSelected) previewMediaRef.current = r;
                        }}
                        src={`${MEDIA_BASE_URL}/${el.content}`}
                      />
                      <span>🎵 {el.content}</span>
                    </div>
                  )}

                  {isSelected && (
                    <div
                      data-role="resize-handle"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        startDragOrResize(e, 'RESIZE_RIGHT', el.id);
                      }}
                      style={resizeHandleRight}
                      title="Pavelc stūri, lai mainītu izmēru"
                    />
                  )}
                </div>
              );
            })}

            {/* ATBILŽU POGAS */}
            {(activeSlide?.type === 'QUESTION' || activeSlide?.type === 'MAJORITY') &&
              activeSlide?.config?.options?.map((opt, i) => {
                const isIndividual = (activeSlide.config.optionsLayout || 'INDIVIDUAL') === 'INDIVIDUAL';
                const isRightColumn = activeSlide.config.optionsLayout === 'RIGHT_COLUMN';
                const totalOpt = activeSlide.config.options.length;

                let defaultPos = {
                  x: 10 + (i % 2) * 42,
                  y: 58 + Math.floor(i / 2) * 13,
                  w: 38,
                  h: 10
                };

                if (isRightColumn) {
                  const itemHeight = Math.min(12, Math.floor(65 / totalOpt) - 2);
                  defaultPos = {
                    x: 56,
                    y: 20 + i * (itemHeight + 3),
                    w: 40,
                    h: itemHeight
                  };
                }

                const pos = isIndividual
                  ? (activeSlide.config.optionsPositions?.[i] || activeSlide.config.optionsPositions?.[opt] || defaultPos)
                  : defaultPos;

                const letter = String.fromCharCode(65 + i);
                const optKey = (opt && opt.trim() !== '') ? opt : letter;

                const isCorrect =
                  activeSlide.config.correctAnswers.includes(optKey) ||
                  activeSlide.config.correctAnswers.includes(letter) ||
                  (opt && opt.trim() !== '' && activeSlide.config.correctAnswers.includes(opt));

                const currentPct = activeSlide.config.answerCorrectness?.[optKey] ?? activeSlide.config.answerCorrectness?.[letter] ?? 100;
                const optionId = `opt-index-${i}`;
                const isSelected = selectedElementIds.includes(optionId);
                const isEditing = editingElementId === optionId;
                const isOnlyLetter = !opt || opt.trim() === '';

                const optBg = activeSlide.config.optionsBgColor || '#000000';
                const optOpacity = activeSlide.config.optionsBgOpacity ?? 85;
                const optColor = activeSlide.config.optionsColor || '#ffffff';
                const optCorrectColor = activeSlide.config.optionsCorrectColor || '#00ff00';
                const isZeroOpacity = optOpacity === 0;

                return (
                  <div
                    key={`opt-box-${i}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedElementIds(e.ctrlKey || e.metaKey ? [...selectedElementIds, optionId] : [optionId]);
                    }}
                    onMouseDown={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.dataset.role === 'resize-handle' || target.tagName === 'INPUT') return;
                      if (isIndividual) startDragOrResize(e, 'MOVE', optionId);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingElementId(optionId);
                    }}
                    style={{
                      position: 'absolute',
                      left: `${pos.x}%`,
                      top: `${pos.y}%`,
                      width: isOnlyLetter && !isEditing ? 'auto' : `${pos.w}%`,
                      height: `${pos.h}%`,
                      background: isZeroOpacity || isOnlyLetter ? 'transparent' : hexToRgba(optBg, optOpacity),
                      backdropFilter: isZeroOpacity || isOnlyLetter ? 'none' : 'blur(6px)',
                      boxShadow: isZeroOpacity || isOnlyLetter ? 'none' : '0 4px 15px rgba(0,0,0,0.5)',
                      border: isSelected ? '2px dashed #ffc107' : 'none',
                      borderRadius: isOnlyLetter && !isEditing ? '50%' : '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isOnlyLetter && !isEditing ? 'center' : 'space-between',
                      padding: isOnlyLetter && !isEditing ? '0' : isZeroOpacity ? '0 6px' : '0 12px',
                      boxSizing: 'border-box',
                      cursor: isIndividual ? 'move' : 'default',
                      zIndex: 10,
                      overflow: 'visible'
                    }}
                  >
                    {isIndividual && isSelected && (
                      <div
                        data-role="resize-handle"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          startDragOrResize(e, 'RESIZE_LEFT', optionId);
                        }}
                        style={resizeHandleLeft}
                        title="Mainīt izmēru no kreisās puses"
                      />
                    )}

                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: isCorrect ? optCorrectColor : '#111',
                        border: isCorrect ? `2px solid #ffffff` : '2px solid #ffc107',
                        boxShadow: isCorrect ? `0 0 15px ${optCorrectColor}` : '0 0 10px rgba(0,0,0,0.9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '1.2rem',
                        color: isCorrect ? '#000' : '#ffc107',
                        flexShrink: 0
                      }}
                    >
                      {letter}
                    </div>

                    {isEditing ? (
                      <input
                        autoFocus
                        value={opt}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateActiveSlide((s) => {
                            const oldVal = s.config.options[i];
                            const oldKey = (oldVal && oldVal.trim() !== '') ? oldVal : letter;
                            s.config.options[i] = val;
                            const newKey = (val && val.trim() !== '') ? val : letter;

                            s.config.correctAnswers = s.config.correctAnswers.map((a) => (a === oldKey || a === oldVal ? newKey : a));
                            if (s.config.answerCorrectness && s.config.answerCorrectness[oldKey]) {
                              s.config.answerCorrectness[newKey] = s.config.answerCorrectness[oldKey];
                              if (oldKey !== newKey) delete s.config.answerCorrectness[oldKey];
                            }
                          });
                        }}
                        onBlur={() => setEditingElementId(null)}
                        style={inlineInput}
                      />
                    ) : (
                      !isOnlyLetter && (
                        <span
                          style={{
                            flex: 1,
                            fontSize: getOptionFontSize(opt),
                            color: optColor,
                            fontWeight: 'bold',
                            whiteSpace: 'normal',
                            lineHeight: 1.2,
                            overflow: 'hidden',
                            marginLeft: '10px',
                            wordBreak: 'break-word',
                            textAlign: 'left',
                            textShadow: isZeroOpacity ? '0 1px 4px #000' : 'none'
                          }}
                        >
                          {opt}
                        </span>
                      )
                    )}

                    {activeSlide.type === 'QUESTION' && (
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isCorrect}
                          title={`Atzīmēt ${letter} kā pareizo atbildi`}
                          onChange={(e) => {
                            updateActiveSlide((s) => {
                              const targetKey = (s.config.options[i] && s.config.options[i].trim() !== '') ? s.config.options[i] : letter;
                              if (e.target.checked) {
                                s.config.correctAnswers = s.config.correctAnswers.filter((a) => a !== letter && a !== s.config.options[i]);
                                s.config.correctAnswers.push(targetKey);
                                if (!s.config.answerCorrectness) s.config.answerCorrectness = {};
                                s.config.answerCorrectness[targetKey] = 100;
                              } else {
                                s.config.correctAnswers = s.config.correctAnswers.filter((a) => a !== letter && a !== s.config.options[i] && a !== targetKey);
                                if (s.config.answerCorrectness) {
                                  delete s.config.answerCorrectness[targetKey];
                                  delete s.config.answerCorrectness[letter];
                                  delete s.config.answerCorrectness[s.config.options[i]];
                                }
                              }
                            });
                          }}
                        />

                        {isCorrect && (
                          <div
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              background: '#111',
                              border: '1px solid #ffc107',
                              borderRadius: '4px',
                              padding: '2px 4px'
                            }}
                          >
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={currentPct}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const val = Math.max(1, Math.min(100, Number(e.target.value) || 0));
                                updateActiveSlide((s) => {
                                  const targetKey = (s.config.options[i] && s.config.options[i].trim() !== '') ? s.config.options[i] : letter;
                                  if (!s.config.answerCorrectness) s.config.answerCorrectness = {};
                                  s.config.answerCorrectness[targetKey] = val;
                                });
                              }}
                              style={inputPercent}
                              title="% no punktiem"
                            />
                            <span style={{ fontSize: '0.75rem', color: '#ffc107', fontWeight: 'bold' }}>%</span>
                          </div>
                        )}
                      </div>
                    )}

                    {isIndividual && isSelected && (
                      <div
                        data-role="resize-handle"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          startDragOrResize(e, 'RESIZE_RIGHT', optionId);
                        }}
                        style={resizeHandleRight}
                        title="Mainīt izmēru no labās puses"
                      />
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        {/* LABĀ PUSE: Iestatījumu panelis */}
        <div style={sidebarRight}>
          <div style={{ background: '#1c2833', border: '1px solid #007bff', borderRadius: '8px', padding: '10px', marginBottom: '15px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#00ff00', marginBottom: '8px' }}>
              📱 MOBILĀS LIETOTNES & SPĒLES IESTATĪJUMI
            </div>

            <label style={labelStyle}>Lietotnes nosaukums telefonā:</label>
            <input
              style={inputStyle}
              value={mobileBranding.appTitle || 'EVENT BUZZER'}
              onChange={(e) => setMobileBranding({ ...mobileBranding, appTitle: e.target.value })}
              placeholder="EVENT BUZZER"
            />

            <label style={labelStyle}>Sākuma reģistrācijas ekrāns:</label>
            <select
              style={{ ...selectStyle, borderColor: '#00e5ff' }}
              value={mobileBranding.lobbyMode || 'CIRCLE'}
              onChange={(e) => setMobileBranding({ ...mobileBranding, lobbyMode: e.target.value as any })}
            >
              <option value="CIRCLE">Klasiskais (Lielais PIN, QR un Aplis)</option>
              <option value="INTERACTIVE_DOTS">Interaktīvais (Bumbiņas ar Pults testu)</option>
            </select>

            <label style={labelStyle}>⏱️ Taimera režīms visiem jautājumiem:</label>
            <select
              style={{ ...selectStyle, borderColor: '#00e5ff' }}
              value={mobileBranding.timerMode || 'ALL_VOTED'}
              onChange={(e) => setMobileBranding({ ...mobileBranding, timerMode: e.target.value as any })}
            >
              <option value="ALL_VOTED">⚡ Pārtraukt laiku, tiklīdz visi atbildējuši (Ātrais)</option>
              <option value="FULL_TIME">⏳ Vienmēr skaitīt pilno laiku līdz 0s (Pilnais)</option>
            </select>

            <label style={labelStyle}>💤 Neaktivitātes (AFK) atslēgšanas limits:</label>
            <select
              style={selectStyle}
              value={mobileBranding.maxMissedQuestions || 5}
              onChange={(e) => setMobileBranding({ ...mobileBranding, maxMissedQuestions: Number(e.target.value) })}
            >
              <option value="3">Pēc 3 neatbildētiem jautājumiem</option>
              <option value="5">Pēc 5 neatbildētiem jautājumiem (Ieteicams)</option>
              <option value="10">Pēc 10 neatbildētiem jautājumiem</option>
              <option value="999">Izslēgt auto-atslēgšanu</option>
            </select>

            {/* KOMANDU REŽĪMS */}
            <div style={{ marginTop: '10px', background: '#15222e', border: '1px solid #00e5ff', borderRadius: '6px', padding: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#00e5ff', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={!!mobileBranding.teamModeEnabled}
                  onChange={(e) => setMobileBranding({ ...mobileBranding, teamModeEnabled: e.target.checked })}
                />
                👥 Ieslēgt Komandu režīmu
              </label>

              {mobileBranding.teamModeEnabled && (
                <div style={{ marginTop: '8px' }}>
                  <label style={labelStyle}>Komandu punktu aprēķins:</label>
                  <select
                    style={selectStyle}
                    value={mobileBranding.teamScoringMode || 'AVG'}
                    onChange={(e) => setMobileBranding({ ...mobileBranding, teamScoringMode: e.target.value as any })}
                  >
                    <option value="AVG">Vidējais punktu skaits (Taisnīgi dažādiem izmēriem)</option>
                    <option value="SUM">Kopējā punktu summa</option>
                  </select>

                  <label style={labelStyle}>Iepriekš sagatavotās komandas / galdiņi:</label>
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                    <input
                      style={{ ...inputStyle, flex: 1 }}
                      placeholder="Pievienot komandu..."
                      value={newTeamInput}
                      onChange={(e) => setNewTeamInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTeam()}
                    />
                    <button onClick={handleAddTeam} style={{ ...btnSmallAction, width: 'auto', background: '#007bff', margin: 0 }}>
                      ➕
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '90px', overflowY: 'auto' }}>
                    {(mobileBranding.predefinedTeams || []).map((team) => (
                      <span
                        key={team}
                        style={{
                          background: '#003366',
                          color: '#fff',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {team}
                        <button
                          onClick={() => handleRemoveTeam(team)}
                          style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer', padding: 0, fontWeight: 'bold' }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <label style={labelStyle}>Sākuma Logo (480 × 120 px PNG):</label>
            <select
              style={selectStyle}
              value={mobileBranding.appLogo || ''}
              onChange={(e) => setMobileBranding({ ...mobileBranding, appLogo: e.target.value })}
            >
              <option value="">(Noklusējuma ikona 🎮)</option>
              {mediaList.filter((f) => /\.(png|webp|svg)$/i.test(f)).map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>

            <label style={labelStyle}>Fona bilde (1080 × 1920 px 9:16):</label>
            <select
              style={selectStyle}
              value={mobileBranding.appBgImage || ''}
              onChange={(e) => setMobileBranding({ ...mobileBranding, appBgImage: e.target.value })}
            >
              <option value="">(Tumšs fons)</option>
              {mediaList.filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f)).map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Fona krāsa:</span>
              <input
                type="color"
                value={mobileBranding.appBgColor || '#121212'}
                onChange={(e) => setMobileBranding({ ...mobileBranding, appBgColor: e.target.value })}
                style={colorPicker}
              />
            </div>
          </div>

          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#ffc107' }}>SLAIDA TIPS</div>
          <select
            style={selectStyle}
            value={activeSlide.type}
            onChange={(e) => updateActiveSlide((s) => (s.type = e.target.value as any))}
          >
            <option value="QUESTION">Question (Jautājums)</option>
            <option value="MAJORITY">Majority Rules (Vairākums)</option>
            <option value="LEADERBOARD">Leaderboard (Līderu tabula)</option>
            <option value="BILLBOARD">Billboard (Informatīvs ekrāns)</option>
          </select>

          {/* VADĪTĀJA PIEZĪMES */}
          <div style={{ margin: '8px 0', borderTop: '1px solid #333', paddingTop: '8px' }}>
            <label style={{ ...labelStyle, color: '#ffc107', fontWeight: 'bold' }}>📝 Piezīmes vadītājam (Host Notes):</label>
            <textarea
              style={{ ...inputStyle, minHeight: '60px', resize: 'vertical', fontSize: '0.85rem' }}
              value={activeSlide.config.notes || ''}
              onChange={(e) => updateActiveSlide((s) => (s.config.notes = e.target.value))}
              placeholder="Ieraksti skaidrojumu vadītājam..."
            />
          </div>

          {activeSlide.type === 'LEADERBOARD' && (
            <div style={{ margin: '10px 0', borderTop: '1px solid #333', paddingTop: '10px' }}>
              <label style={labelStyle}>Līderu tabulas sadaļa:</label>
              <select
                style={{ ...selectStyle, borderColor: '#ffc107' }}
                value={activeSlide.config.lbType || 'TOTAL'}
                onChange={(e) => updateActiveSlide((s) => (s.config.lbType = e.target.value as any))}
              >
                <option value="ROUND">🏆 Round Scores (Kārtas punkti)</option>
                <option value="TOTAL">⭐ Total Scores (Kopējie punkti)</option>
                <option value="FINAL">🥇 Final Scores (Fināla apbalvošana)</option>
              </select>
            </div>
          )}

          {/* IZVĒLĒTO ELEMENTU INSPEKTORS */}
          {selectedElements.length > 0 && primarySelectedElement && (
            <div style={selectedBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', color: '#00ff00', fontSize: '0.85rem' }}>
                  {hasMultipleSelection
                    ? `👥 ATLASĪTI: ${selectedElements.length} ELEMENTI (MULTI-EDIT)`
                    : `IZVĒLĒTS: ${primarySelectedElement.type}`}
                </span>
                <button
                  onClick={deleteSelectedElements}
                  style={{ background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '3px 8px', fontSize: '0.75rem', fontWeight: 'bold' }}
                  title="Dzēst ar [Delete / Backspace]"
                >
                  🗑️ Dzēst [Del]
                </button>
              </div>

              {/* TEKSTA UN FONA KOPĒJIE IESTATĪJUMI */}
              {selectedElements.some((el) => el.type === 'QUESTION' || el.type === 'TEXT') && (
                <div style={{ marginTop: '8px', borderTop: '1px solid #444', paddingTop: '8px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#ffc107', marginBottom: '8px' }}>
                    🎨 TEKSTA & FONA STILS
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ flex: 1.4 }}>
                      <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Fonts:</span>
                      <select
                        style={selectStyle}
                        value={primarySelectedElement.fontFamily || 'Segoe UI'}
                        onChange={(e) => updateSelectedElements((el) => { el.fontFamily = e.target.value; })}
                      >
                        <option value="Segoe UI">Segoe UI</option>
                        <option value="Montserrat">Montserrat</option>
                        <option value="Impact">Impact</option>
                        <option value="Roboto">Roboto</option>
                        <option value="Arial">Arial</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Courier New">Courier New</option>
                      </select>
                    </div>

                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Izmērs:</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0.8"
                        max="12.0"
                        value={primarySelectedElement.fontSize ?? 2.2}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 2.2;
                          updateSelectedElements((el) => { el.fontSize = val; });
                        }}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', background: '#1a1a1a', padding: '6px 10px', borderRadius: '6px', border: '1px solid #333' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Teksts:</span>
                      <input
                        type="color"
                        value={primarySelectedElement.color || '#ffffff'}
                        onChange={(e) => updateSelectedElements((el) => { el.color = e.target.value; })}
                        style={colorPicker}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Fons:</span>
                      <input
                        type="color"
                        value={primarySelectedElement.bgColor || '#000000'}
                        onChange={(e) => updateSelectedElements((el) => { el.bgColor = e.target.value; })}
                        style={colorPicker}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => updateSelectedElements((el) => { el.bold = !el.bold; })}
                      style={{
                        padding: '4px 10px',
                        background: primarySelectedElement.bold ? '#007bff' : '#333',
                        color: '#fff',
                        border: '1px solid #555',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                      title="Treknraksts (Bold)"
                    >
                      B
                    </button>
                  </div>

                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Fona caurspīdīgums:</span>
                      <span style={{ fontSize: '0.8rem', color: '#00e5ff', fontWeight: 'bold' }}>
                        {primarySelectedElement.bgOpacity ?? (primarySelectedElement.type === 'QUESTION' ? 85 : 60)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={primarySelectedElement.bgOpacity ?? (primarySelectedElement.type === 'QUESTION' ? 85 : 60)}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateSelectedElements((el) => { el.bgOpacity = val; });
                      }}
                      style={{ width: '100%', accentColor: '#00e5ff', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              )}

              {/* 🌫️ BLUR SISTĒMA ATTĒLIEM & VIDEO */}
              {selectedElements.some((el) => el.type === 'IMAGE' || el.type === 'VIDEO') && (
                <div style={{ marginTop: '8px', borderTop: '1px solid #444', paddingTop: '8px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#00e5ff', marginBottom: '6px' }}>
                    🌫️ BLUR (AIZMIGLOŠANAS) EFEKTS
                  </div>

                  <label style={labelStyle}>Aizmiglojuma režīms:</label>
                  <select
                    style={{ ...selectStyle, borderColor: '#00e5ff' }}
                    value={primarySelectedElement.blurMode || 'NONE'}
                    onChange={(e) => updateSelectedElements((el) => { el.blurMode = e.target.value as any; })}
                  >
                    <option value="NONE">❌ Bez Blur (Normāls ass skats)</option>
                    <option value="STATIC">🔒 Fiksēts Blur (Vienmēr miglains)</option>
                    <option value="PROGRESSIVE">✨ Dinamiskais Blur (Kļūst skaidrs uz beigām)</option>
                  </select>

                  {(primarySelectedElement.blurMode === 'STATIC' || primarySelectedElement.blurMode === 'PROGRESSIVE') && (
                    <div style={{ marginTop: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Miglas stiprums (sākuma stāvoklis):</span>
                        <span style={{ fontSize: '0.8rem', color: '#00e5ff', fontWeight: 'bold' }}>
                          {primarySelectedElement.blurAmount || 12} px
                        </span>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max="40"
                        step="1"
                        value={primarySelectedElement.blurAmount || 12}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateSelectedElements((el) => { el.blurAmount = val; });
                        }}
                        style={{ width: '100%', accentColor: '#00e5ff', cursor: 'pointer' }}
                      />
                      {primarySelectedElement.blurMode === 'PROGRESSIVE' && (
                        <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '3px' }}>
                          💡 Sāksies ar {primarySelectedElement.blurAmount || 12}px un jautājuma pēdējās 2 sekundēs kļūs pilnīgi ass (0px)!
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* REDZAMĪBAS REŽĪMI */}
              <label style={labelStyle}>Rādīt / Atskaņot:</label>
              <select
                style={selectStyle}
                value={primarySelectedElement.visibility || (primarySelectedElement.type === 'QUESTION' || primarySelectedElement.type === 'TEXT' ? 'ALWAYS' : 'DURING_QUESTION')}
                onChange={(e) => updateSelectedElements((el) => { el.visibility = e.target.value as any; })}
              >
                <option value="DURING_QUESTION">Kamēr rit jautājums (Parādās ar laiku, pazūd pie Reveal)</option>
                <option value="UNTIL_REVEAL">Redzams uzreiz līdz atbildei (Uzreiz no READY līdz Reveal)</option>
                <option value="ALWAYS">Visu laiku (Always - redzams arī pēc atbildes)</option>
                <option value="AFTER_REVEAL">Tikai atklājot atbildi (After Reveal - parādās pie Reveal)</option>
              </select>

              {/* 🔊 SKAĻUMS & TRIM AUDIO/VIDEO */}
              {selectedElements.some((el) => el.type === 'VIDEO' || el.type === 'AUDIO') && (
                <div style={{ marginTop: '8px', borderTop: '1px solid #444', paddingTop: '8px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#ffc107', marginBottom: '6px' }}>
                    🔊 SKAĻUMS & ✂️ TRIM IESTATĪJUMI
                  </div>

                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Medija skaļums:</span>
                      <span style={{ fontSize: '0.8rem', color: '#00ff00', fontWeight: 'bold' }}>
                        {primarySelectedElement.volume ?? 100}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={primarySelectedElement.volume ?? 100}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateSelectedElements((el) => { el.volume = val; });
                        if (previewMediaRef.current) {
                          previewMediaRef.current.volume = val / 100;
                        }
                      }}
                      style={{ width: '100%', accentColor: '#00ff00', cursor: 'pointer' }}
                    />
                  </div>

                  {!hasMultipleSelection && (
                    <>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Sākums (sek):</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={primarySelectedElement.trimStart ?? 0}
                            onChange={(e) => {
                              const val = Math.max(0, parseFloat(e.target.value) || 0);
                              updateSelectedElements((el) => {
                                el.trimStart = val;
                                if (!el.isTrimEndCustom || (el.trimEnd && el.trimEnd <= el.trimStart)) {
                                  el.trimEnd = Number((val + 30).toFixed(2));
                                }
                              });
                            }}
                            style={inputStyle}
                          />
                        </div>

                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Beigas (sek):</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={primarySelectedElement.trimEnd ?? ((primarySelectedElement.trimStart || 0) + 30)}
                            onChange={(e) => {
                              const val = Math.max(0, parseFloat(e.target.value) || 0);
                              updateSelectedElements((el) => {
                                el.trimEnd = val;
                                el.isTrimEndCustom = true;
                              });
                            }}
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                        <button style={{ ...btnSmallAction, background: '#28a745' }} onClick={() => playPreviewFragment(primarySelectedElement)}>
                          ▶️ Pārbaudīt fragmentu
                        </button>
                        <button style={{ ...btnSmallAction, background: '#666' }} onClick={stopPreviewFragment}>
                          ⏹️ Stop
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* FONA ATTĒLA IZVĒLE */}
          <div style={{ marginTop: '10px', borderTop: '1px solid #333', paddingTop: '10px' }}>
            <label style={labelStyle}>Slaida fons:</label>
            <select
              style={selectStyle}
              value={activeSlide.config.backgroundUrl || ''}
              onChange={(e) => updateActiveSlide((s) => (s.config.backgroundUrl = e.target.value))}
            >
              <option value="">(Melns fons)</option>
              {mediaList.filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f)).map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* JAUTĀJUMA IESTATĪJUMI */}
          {(activeSlide.type === 'QUESTION' || activeSlide.type === 'MAJORITY') && (
            <div style={{ marginTop: '10px', borderTop: '1px solid #333', paddingTop: '10px' }}>
              <div style={{ marginBottom: '10px', background: '#1c2833', border: '1px solid #00e5ff', borderRadius: '8px', padding: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#00e5ff', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!activeSlide.config.autoStart}
                    onChange={(e) => updateActiveSlide((s) => (s.config.autoStart = e.target.checked))}
                  />
                  ⚡ Automātiskais starts (Auto-Start)
                </label>
                <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: '4px', lineHeight: 1.3 }}>
                  Pārejot uz šo slaidu, laiks un mediji startēsies uzreiz bez atsevišķa [Space] spiediena.
                </div>
              </div>

              {/* ATBILŽU IZKĀRTOJUMS */}
              <div style={{ marginBottom: '10px' }}>
                <label style={labelStyle}>Atbilšu izkārtojums (Layout):</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => updateActiveSlide((s) => (s.config.optionsLayout = 'INDIVIDUAL'))}
                    style={{
                      padding: '7px 4px',
                      color: '#fff',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      background: (activeSlide.config.optionsLayout || 'INDIVIDUAL') === 'INDIVIDUAL' ? '#007bff' : '#222',
                      border: (activeSlide.config.optionsLayout || 'INDIVIDUAL') === 'INDIVIDUAL' ? '2px solid #00e5ff' : '1px solid #444'
                    }}
                  >
                    ✋ Manuāls
                  </button>
                  <button
                    type="button"
                    onClick={() => updateActiveSlide((s) => (s.config.optionsLayout = 'RIGHT_COLUMN'))}
                    style={{
                      padding: '7px 4px',
                      color: '#fff',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      background: activeSlide.config.optionsLayout === 'RIGHT_COLUMN' ? '#007bff' : '#222',
                      border: activeSlide.config.optionsLayout === 'RIGHT_COLUMN' ? '2px solid #00e5ff' : '1px solid #444'
                    }}
                  >
                    📑 Labajā pusē
                  </button>
                  <button
                    type="button"
                    onClick={() => updateActiveSlide((s) => (s.config.optionsLayout = 'GRID'))}
                    style={{
                      padding: '7px 4px',
                      color: '#fff',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      background: activeSlide.config.optionsLayout === 'GRID' ? '#007bff' : '#222',
                      border: activeSlide.config.optionsLayout === 'GRID' ? '2px solid #00e5ff' : '1px solid #444'
                    }}
                  >
                    ⏹️ Horizontāli
                  </button>
                </div>
              </div>

              {/* ATBILŽU KRĀSAS, INTENSITĀTE & PAREIZĀS ATBILDES KRĀSA */}
              <div style={{ background: '#182430', border: '1px solid #007bff', borderRadius: '6px', padding: '8px', marginBottom: '10px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#00e5ff', marginBottom: '6px' }}>
                  🎨 ATBILŽU LOGU & TEKSTA STILS
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Teksts:</span>
                    <input
                      type="color"
                      value={activeSlide.config.optionsColor || '#ffffff'}
                      onChange={(e) => updateActiveSlide((s) => (s.config.optionsColor = e.target.value))}
                      style={colorPicker}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Fons:</span>
                    <input
                      type="color"
                      value={activeSlide.config.optionsBgColor || '#000000'}
                      onChange={(e) => updateActiveSlide((s) => (s.config.optionsBgColor = e.target.value))}
                      style={colorPicker}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#00ff00', fontWeight: 'bold' }}>Pareizā:</span>
                    <input
                      type="color"
                      value={activeSlide.config.optionsCorrectColor || '#00ff00'}
                      onChange={(e) => updateActiveSlide((s) => (s.config.optionsCorrectColor = e.target.value))}
                      style={colorPicker}
                      title="Pareizās atbildes burta un spīduma krāsa"
                    />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Loga fona intensitāte:</span>
                    <span style={{ fontSize: '0.8rem', color: '#00ff00', fontWeight: 'bold' }}>
                      {activeSlide.config.optionsBgOpacity ?? 85}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={activeSlide.config.optionsBgOpacity ?? 85}
                    onChange={(e) => updateActiveSlide((s) => (s.config.optionsBgOpacity = Number(e.target.value)))}
                    style={{ width: '100%', accentColor: '#00ff00', cursor: 'pointer' }}
                  />
                </div>
              </div>

              <label style={labelStyle}>Atbilšu skaits (2-6):</label>
              <div style={{ display: 'flex', gap: '4px', margin: '6px 0' }}>
                {[2, 3, 4, 5, 6].map((num) => (
                  <button
                    key={num}
                    style={{ ...btnNumber, background: activeSlide.config.optionsCount === num ? '#007bff' : '#333' }}
                    onClick={() => {
                      updateActiveSlide((s) => {
                        s.config.optionsCount = num;
                        const cur = s.config.options || [];
                        const updated: string[] = [];
                        for (let i = 0; i < num; i++) updated.push(cur[i] !== undefined ? cur[i] : `Variants ${String.fromCharCode(65 + i)}`);
                        s.config.options = updated;
                      });
                    }}
                  >
                    {num}
                  </button>
                ))}
              </div>

              {activeSlide.config.correctAnswers.length > 1 && (
                <div style={{ marginTop: '8px', background: '#1c2833', border: '1px solid #00e5ff', borderRadius: '6px', padding: '8px' }}>
                  <label style={{ ...labelStyle, color: '#00e5ff', fontWeight: 'bold', marginTop: 0 }}>
                    🎯 Vairāku pareizo atbilžu režīms:
                  </label>
                  <select
                    style={{ ...selectStyle, borderColor: '#00e5ff', marginTop: '4px', marginBottom: '4px' }}
                    value={activeSlide.config.selectionMode || 'ALL'}
                    onChange={(e) => updateActiveSlide((s) => (s.config.selectionMode = e.target.value as any))}
                  >
                    <option value="ALL">☑️ Jānorāda visas pareizās (Daudzizvēle)</option>
                    <option value="ANY_ONE">☝️ Pietiek ar vienu pareizo (Viens klikšķis)</option>
                  </select>
                </div>
              )}

              <label style={labelStyle}>Punktu režīms:</label>
              <select
                style={selectStyle}
                value={activeSlide.config.scoringMode || 'FIXED'}
                onChange={(e) => updateActiveSlide((s) => (s.config.scoringMode = e.target.value as any))}
              >
                <option value="FIXED">Fiksēti punkti</option>
                <option value="DECREASING">Dilstoši punkti</option>
              </select>

              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Max punkti:</label>
                  <input
                    type="number"
                    style={inputStyle}
                    value={activeSlide.config.pointsMax ?? activeSlide.config.points}
                    onChange={(e) =>
                      updateActiveSlide((s) => {
                        const val = Number(e.target.value);
                        s.config.points = val;
                        s.config.pointsMax = val;
                      })
                    }
                  />
                </div>
                {activeSlide.config.scoringMode === 'DECREASING' && (
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Min punkti:</label>
                    <input
                      type="number"
                      style={inputStyle}
                      value={activeSlide.config.pointsMin ?? 1}
                      onChange={(e) => updateActiveSlide((s) => (s.config.pointsMin = Number(e.target.value)))}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MEDIJU MAPE */}
          <div style={{ marginTop: '15px', borderTop: '1px solid #333', paddingTop: '10px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#aaa', marginBottom: '6px' }}>
              📁 MEDIJU MAPE ({mediaList.length})
            </div>
            <div style={{ maxHeight: '140px', overflowY: 'auto' }}>
              {mediaList.map((m) => (
                <div key={m} style={mediaItem} onClick={() => addMediaElement(m)} title="Klikšķini, lai pievienotu">
                  📄 {m}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// STILI
const studioLayout: React.CSSProperties = {
  height: '100vh',
  width: '100vw',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#121212',
  color: '#fff',
  fontFamily: 'Segoe UI, Arial, sans-serif',
  overflow: 'hidden',
  userSelect: 'none'
};

const ribbonStyle: React.CSSProperties = {
  height: '55px',
  background: '#1e1e1e',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 15px',
  borderBottom: '1px solid #333'
};

const folderBar: React.CSSProperties = {
  height: '35px',
  background: '#151515',
  display: 'flex',
  alignItems: 'center',
  padding: '0 15px',
  gap: '10px',
  borderBottom: '1px solid #2a2a2a'
};

const folderInput: React.CSSProperties = {
  flex: 1,
  background: '#000',
  border: '1px solid #444',
  color: '#0f0',
  padding: '4px 10px',
  borderRadius: '4px',
  fontSize: '0.85rem'
};

const btnSmallFolder: React.CSSProperties = {
  background: '#007bff',
  color: '#fff',
  border: 'none',
  padding: '5px 12px',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '0.8rem'
};

const sidebarLeft: React.CSSProperties = {
  width: '230px',
  background: '#181818',
  borderRight: '1px solid #333',
  padding: '12px',
  overflowY: 'hidden',
  display: 'flex',
  flexDirection: 'column'
};

const sidebarRight: React.CSSProperties = {
  width: '320px',
  background: '#181818',
  borderLeft: '1px solid #333',
  padding: '12px',
  overflowY: 'auto'
};

const canvasContainer: React.CSSProperties = {
  flex: 1,
  background: '#0a0a0a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '15px'
};

const canvasBoard: React.CSSProperties = {
  width: '960px',
  height: '540px',
  background: '#181818',
  borderRadius: '10px',
  position: 'relative',
  overflow: 'hidden',
  border: '2px solid #333',
  boxShadow: '0 10px 40px rgba(0,0,0,0.8)'
};

const resizeHandleRight: React.CSSProperties = {
  position: 'absolute',
  right: '-8px',
  bottom: '-8px',
  width: '18px',
  height: '18px',
  background: '#007bff',
  border: '2px solid #ffffff',
  cursor: 'nwse-resize',
  borderRadius: '3px',
  zIndex: 100,
  boxShadow: '0 0 6px rgba(0,0,0,0.9)'
};

const resizeHandleLeft: React.CSSProperties = {
  position: 'absolute',
  left: '-8px',
  bottom: '-8px',
  width: '18px',
  height: '18px',
  background: '#ffc107',
  border: '2px solid #ffffff',
  cursor: 'nesw-resize',
  borderRadius: '3px',
  zIndex: 100,
  boxShadow: '0 0 6px rgba(0,0,0,0.9)'
};

const slideThumb: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: '6px',
  border: '1px solid #333',
  marginBottom: '6px',
  cursor: 'grab',
  transition: 'all 0.15s ease'
};

const iconBtnSmall: React.CSSProperties = {
  background: '#333',
  color: '#ccc',
  border: '1px solid #444',
  borderRadius: '3px',
  cursor: 'pointer',
  padding: '2px 5px',
  fontSize: '0.75rem',
  lineHeight: 1
};

const btnAddSlideUnderList: React.CSSProperties = {
  width: '100%',
  marginTop: '10px',
  padding: '12px',
  background: '#007bff',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '0.9rem'
};

const inputStyle: React.CSSProperties = {
  background: '#252525',
  border: '1px solid #444',
  color: '#fff',
  padding: '5px 8px',
  borderRadius: '4px',
  width: '100%',
  boxSizing: 'border-box'
};

const inputName: React.CSSProperties = { ...inputStyle, width: '150px' };
const selectStyle: React.CSSProperties = { ...inputStyle, marginBottom: '8px' };
const selectOpen: React.CSSProperties = { ...inputStyle, width: '180px' };

const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#aaa',
  marginTop: '6px',
  display: 'block'
};

const btnAction: React.CSSProperties = {
  background: '#2d2d2d',
  color: '#fff',
  border: '1px solid #555',
  padding: '6px 12px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '0.85rem'
};

const btnSmallAction: React.CSSProperties = {
  width: '100%',
  background: '#333',
  color: '#fff',
  border: '1px solid #555',
  padding: '5px',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.75rem',
  marginBottom: '8px'
};

const btnNumber: React.CSSProperties = {
  flex: 1,
  padding: '5px 0',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 'bold'
};

const selectedBox: React.CSSProperties = {
  background: '#222',
  border: '1px solid #00ff00',
  padding: '10px',
  borderRadius: '6px',
  marginTop: '10px'
};

const mediaItem: React.CSSProperties = {
  padding: '5px 8px',
  background: '#222',
  borderRadius: '4px',
  marginBottom: '4px',
  fontSize: '0.8rem',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

const colorPicker: React.CSSProperties = {
  border: '1px solid #444',
  background: 'transparent',
  width: '32px',
  height: '28px',
  padding: '0',
  cursor: 'pointer',
  borderRadius: '4px'
};

const inlineTextArea: React.CSSProperties = {
  width: '100%',
  minHeight: '60px',
  background: 'transparent',
  border: 'none',
  outline: 'none',
  textAlign: 'center',
  resize: 'none'
};

const inlineInput: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: '#fff',
  fontSize: '1.1rem',
  padding: 0,
  margin: '0 8px'
};

const inputPercent: React.CSSProperties = {
  width: '42px',
  background: '#000',
  border: 'none',
  outline: 'none',
  color: '#00ff00',
  fontWeight: 'bold',
  fontSize: '0.85rem',
  textAlign: 'center',
  padding: '1px 2px'
};
