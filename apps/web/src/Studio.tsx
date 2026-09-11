import React, { useState, useEffect, useRef } from 'react';

const MEDIA_BASE_URL = `http://${window.location.hostname}:3000/project-media`;

const secondsToTimeStr = (totalSec: number = 0): string => {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  const cs = Math.floor((totalSec % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
};

const hexToRgba = (hex: string = '#000000', opacityPercent: number = 80) => {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacityPercent / 100})`;
};

interface MobileBranding {
  appTitle?: string;
  appLogo?: string;
  appBgImage?: string;
  appBgColor?: string;
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
  bgColor?: string;
  bgOpacity?: number;
  volume?: number;
  trimStart?: number;
  trimEnd?: number;
  isTrimEndCustom?: boolean;
  visibility?: 'ALWAYS' | 'DURING_QUESTION' | 'AFTER_REVEAL';
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
    question?: string;
    optionsCount: number;
    options: string[];
    correctAnswers: string[];
    answerCorrectness?: Record<string, number>;
    optionsLayout: 'GRID' | 'COLUMN' | 'INDIVIDUAL';
    optionsPositions?: Record<string | number, { x: number; y: number; w: number; h: number }>;
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

  // 4. PUNKTS: MOBILĀS LIETOTNES BRENDINGA STĀVOKLIS
  const [mobileBranding, setMobileBranding] = useState<MobileBranding>({
    appTitle: 'EVENT BUZZER',
    appLogo: '',
    appBgImage: '',
    appBgColor: '#121212'
  });

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
        optionsCount: 4,
        options: ['Rīga', 'Liepāja', 'Daugavpils', 'Jelgava'],
        correctAnswers: ['Rīga'],
        answerCorrectness: { Rīga: 100 },
        optionsLayout: 'GRID',
        optionsPositions: {},
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
            bgOpacity: 80,
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

  const primarySelectedId = selectedElementIds[selectedElementIds.length - 1] || null;
  const selectedElement = activeSlide?.config?.layout?.find((el) => el.id === primarySelectedId);

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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isTyping = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (!isTyping) {
          e.preventDefault();
          if (e.shiftKey) handleRedo();
          else handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (!isTyping) {
          e.preventDefault();
          handleRedo();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [historyIdx, history, activeSlideIdx]);

  const syncWorkingFolder = async (folderToSet?: string) => {
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/set-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const updateActiveSlide = (updater: (draft: Slide) => void) => {
    setSlides((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      updater(copy[activeSlideIdx]);
      pushToHistory(copy);
      return copy;
    });
  };

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
        optionsCount: 4,
        options: ['Variants A', 'Variants B', 'Variants C', 'Variants D'],
        correctAnswers: ['Variants A'],
        answerCorrectness: { 'Variants A': 100 },
        optionsLayout: 'GRID',
        optionsPositions: {},
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
            bgOpacity: 80,
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
            const curPos = s.config.optionsPositions[optionIdx] || { x: 10, y: 60, w: 38, h: 10 };
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
            const curPos = s.config.optionsPositions[optionIdx] || { x: 10, y: 60, w: 38, h: 10 };
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
              const curPos = s.config.optionsPositions[optionIdx] || { x: 10, y: 60, w: 38, h: 10 };
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

      if (activeSlide.type === 'QUESTION' || activeSlide.type === 'MAJORITY') {
        activeSlide.config.options.forEach((_, idx) => {
          const pos = activeSlide.config.optionsPositions?.[idx] || {
            x: 10 + (idx % 2) * 42,
            y: 58 + Math.floor(idx / 2) * 13,
            w: 38,
            h: 10
          };
          const optPxX = (pos.x / 100) * rect.width;
          const optPxY = (pos.y / 100) * rect.height;
          const optPxW = (pos.w / 100) * rect.width;
          const optPxH = (pos.h / 100) * rect.height;
          if (x1 < optPxX + optPxW && x2 > optPxX && y1 < optPxY + optPxH && y2 > optPxY) {
            newlySelected.push(`opt-index-${idx}`);
          }
        });
      }

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
        const res = await fetch(`http://${window.location.hostname}:3000/api/upload-media`, {
          method: 'POST',
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
      visibility: 'ALWAYS'
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

  // 4. PUNKTS: PROJEKTA SAGLABĀŠANA KOPĀ AR MOBILO BRENDINGU
  const handleSaveProject = async () => {
    const cleanFileName = projectFile.trim().endsWith('.json') ? projectFile.trim() : `${projectFile.trim()}.json`;
    if (availableProjects.includes(cleanFileName)) {
      const isConfirmed = window.confirm(
        `⚠️ UZMANĪBU!\n\nFails "${cleanFileName}" jau eksistē mapē:\n${activeFolder}\n\nVai viss ir pareizi un vēlaties to pārrakstīt?`
      );
      if (!isConfirmed) return;
    }

    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/save-to-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: cleanFileName,
          data: {
            scenes: slides,
            branding: mobileBranding // Saglabā arī pielāgoto telefona dizainu!
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Projekts saglabāts mapē:\n${data.fullPath || data.fileName}`);
        setProjectFile(data.fileName);
        syncWorkingFolder();
      }
    } catch {
      alert('❌ Kļūda saglabājot projektu!');
    }
  };

  const handleOpenProject = async (name: string) => {
    if (!name) return;
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/load-project/${name}`);
      const data = await res.json();
      if (data.scenes && Array.isArray(data.scenes)) {
        setSlides(data.scenes);
        if (data.branding) setMobileBranding(data.branding);
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
                      optionsLayout: 'GRID',
                      optionsPositions: {},
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

          <button style={{ ...btnAction, background: '#28a745' }} onClick={handleSaveProject}>
            💾 Saglabāt
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
                bgOpacity: 60,
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
          placeholder="C:/ManiSovi"
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
                  title="Pārvelc ar peli, lai samainītu vietām"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
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

            {activeSlide?.config?.layout?.map((el) => {
              const isSelected = selectedElementIds.includes(el.id);
              const isEditing = editingElementId === el.id;
              const bgRgba = hexToRgba(el.bgColor || '#000000', el.bgOpacity ?? (el.type === 'QUESTION' ? 80 : 50));

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
                    border: isSelected ? '2px dashed #00ff00' : '1px solid rgba(255,255,255,0.15)',
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
                    fontFamily: el.fontFamily || 'Segoe UI'
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
                          fontSize: `${el.fontSize || 2.2}vw`
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          fontSize: `${el.fontSize || 2.2}vw`,
                          color: el.color || '#fff',
                          textAlign: 'center',
                          width: '100%',
                          wordBreak: 'break-word',
                          whiteSpace: 'pre-wrap',
                          fontFamily: el.fontFamily || 'Segoe UI'
                        }}
                      >
                        {el.content}
                      </span>
                    )
                  ) : el.type === 'IMAGE' ? (
                    <img
                      src={`${MEDIA_BASE_URL}/${el.content}`}
                      alt="img"
                      style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                    />
                  ) : el.type === 'VIDEO' ? (
                    <video
                      ref={(r) => {
                        if (isSelected) previewMediaRef.current = r;
                      }}
                      src={`${MEDIA_BASE_URL}/${el.content}`}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
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
                const isIndividual = activeSlide.config.optionsLayout === 'INDIVIDUAL';
                const pos = activeSlide.config.optionsPositions?.[i] ||
                  activeSlide.config.optionsPositions?.[opt] || {
                    x: 10 + (i % 2) * 42,
                    y: 58 + Math.floor(i / 2) * 13,
                    w: 38,
                    h: 10
                  };

                const optionId = `opt-index-${i}`;
                const isCorrect = activeSlide.config.correctAnswers.includes(opt);
                const currentPct = activeSlide.config.answerCorrectness?.[opt] ?? 100;
                const isSelected = selectedElementIds.includes(optionId);
                const isEditing = editingElementId === optionId;
                const isOnlyLetter = !opt || opt.trim() === '';

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
                      left: isIndividual ? `${pos.x}%` : `${10 + (i % 2) * 42}%`,
                      top: isIndividual ? `${pos.y}%` : `${58 + Math.floor(i / 2) * 13}%`,
                      width: isOnlyLetter && !isEditing ? 'auto' : isIndividual ? `${pos.w}%` : '38%',
                      height: isIndividual ? `${pos.h}%` : '10%',
                      background: isOnlyLetter && !isEditing ? 'transparent' : isCorrect ? 'rgba(40, 167, 69, 0.9)' : 'rgba(30, 30, 30, 0.9)',
                      border: isSelected ? '2px dashed #ffc107' : isOnlyLetter && !isEditing ? 'none' : '2px solid #555',
                      borderRadius: isOnlyLetter && !isEditing ? '50%' : '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isOnlyLetter && !isEditing ? 'center' : 'space-between',
                      padding: isOnlyLetter && !isEditing ? '0' : '0 12px',
                      boxSizing: 'border-box',
                      cursor: isIndividual ? 'move' : 'pointer',
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
                        width: '45px',
                        height: '45px',
                        borderRadius: '50%',
                        background: isCorrect ? '#28a745' : '#111',
                        border: '2px solid #ffc107',
                        boxShadow: '0 0 15px rgba(0,0,0,0.9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '1.4rem',
                        color: '#ffc107'
                      }}
                    >
                      {String.fromCharCode(65 + i)}
                    </div>

                    {isEditing ? (
                      <input
                        autoFocus
                        value={opt}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateActiveSlide((s) => {
                            const old = s.config.options[i];
                            s.config.options[i] = val;
                            s.config.correctAnswers = s.config.correctAnswers.map((a) => (a === old ? val : a));
                            if (s.config.answerCorrectness && s.config.answerCorrectness[old]) {
                              s.config.answerCorrectness[val] = s.config.answerCorrectness[old];
                              delete s.config.answerCorrectness[old];
                            }
                          });
                        }}
                        onBlur={() => setEditingElementId(null)}
                        style={inlineInput}
                      />
                    ) : (
                      !isOnlyLetter && (
                        <span style={{ flex: 1, fontSize: '1.1vw', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginLeft: '10px' }}>
                          {opt}
                        </span>
                      )
                    )}

                    {activeSlide.type === 'QUESTION' && (!isOnlyLetter || isEditing) && (
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isCorrect}
                          title="Atzīmēt kā pareizo atbildi"
                          onChange={(e) => {
                            updateActiveSlide((s) => {
                              if (e.target.checked) {
                                if (!s.config.correctAnswers.includes(opt)) s.config.correctAnswers.push(opt);
                                if (!s.config.answerCorrectness) s.config.answerCorrectness = {};
                                if (!s.config.answerCorrectness[opt]) s.config.answerCorrectness[opt] = 100;
                              } else {
                                s.config.correctAnswers = s.config.correctAnswers.filter((a) => a !== opt);
                                if (s.config.answerCorrectness) delete s.config.answerCorrectness[opt];
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
                                  if (!s.config.answerCorrectness) s.config.answerCorrectness = {};
                                  s.config.answerCorrectness[opt] = val;
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
          {/* 4. PUNKTS: MOBILĀS LIETOTNES DIZAINA IESTATĪJUMI */}
          <div style={{ background: '#1c2833', border: '1px solid #007bff', borderRadius: '8px', padding: '10px', marginBottom: '15px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#00ff00', marginBottom: '8px' }}>
              📱 MOBILĀS LIETOTNES DIZAINS
            </div>

            <label style={labelStyle}>Lietotnes nosaukums telefonā:</label>
            <input
              style={inputStyle}
              value={mobileBranding.appTitle || 'EVENT BUZZER'}
              onChange={(e) => setMobileBranding({ ...mobileBranding, appTitle: e.target.value })}
              placeholder="EVENT BUZZER"
            />

            <label style={labelStyle}>
              Sākuma Logo (480 × 120 px PNG):
            </label>
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

            <label style={labelStyle}>
              Fona bilde (1080 × 1920 px 9:16):
            </label>
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
                <option value="FINAL">🥇 Final Scores (Fināla apbalvošana & beigas)</option>
              </select>
            </div>
          )}

          {activeSlide.type === 'BILLBOARD' && (
            <div style={{ margin: '8px 0', borderTop: '1px solid #333', paddingTop: '8px' }}>
              <button
                style={{ ...btnSmallAction, background: '#007bff' }}
                onClick={() => {
                  const newTitle: CanvasElement = {
                    id: `bb-txt-${Date.now()}`,
                    type: 'TEXT',
                    content: 'BILLBOARD VIRSRAKSTS',
                    x: 10,
                    y: 20,
                    w: 80,
                    h: 18,
                    fontSize: 3.5,
                    fontFamily: 'Segoe UI',
                    color: '#ffc107',
                    bgColor: '#000000',
                    bgOpacity: 70,
                    visibility: 'ALWAYS'
                  };
                  updateActiveSlide((s) => s.config.layout.push(newTitle));
                  setSelectedElementIds([newTitle.id]);
                }}
              >
                ➕ Pievienot Billboard tekstu
              </button>
            </div>
          )}

          {selectedElement && (
            <div style={selectedBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 'bold', color: '#00ff00', fontSize: '0.85rem' }}>
                  IZVĒLĒTS: {selectedElement.type}
                </span>
                <button
                  onClick={() => {
                    updateActiveSlide((s) => {
                      s.config.layout = s.config.layout.filter((x) => x.id !== selectedElement.id);
                    });
                    setSelectedElementIds([]);
                  }}
                  style={{ background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px', fontSize: '0.75rem' }}
                >
                  🗑️ Dzēst
                </button>
              </div>

              {(selectedElement.type === 'VIDEO' || selectedElement.type === 'AUDIO') && (
                <div style={{ marginBottom: '8px' }}>
                  <label style={labelStyle}>🔊 Skaļums ({selectedElement.volume ?? 100}%):</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={selectedElement.volume ?? 100}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      updateActiveSlide((s) => {
                        const el = s.config.layout.find((x) => x.id === selectedElement.id);
                        if (el) el.volume = val;
                      });
                    }}
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              <label style={labelStyle}>Rādīt / Atskaņot:</label>
              <select
                style={selectStyle}
                value={selectedElement.visibility || 'ALWAYS'}
                onChange={(e) =>
                  updateActiveSlide((s) => {
                    const el = s.config.layout.find((x) => x.id === selectedElement.id);
                    if (el) el.visibility = e.target.value as any;
                  })
                }
              >
                <option value="ALWAYS">Visu laiku (Always)</option>
                <option value="DURING_QUESTION">Kamēr rit jautājums (During Question)</option>
                <option value="AFTER_REVEAL">Tikai atklājot pareizo (After Reveal)</option>
              </select>

              {(selectedElement.type === 'VIDEO' || selectedElement.type === 'AUDIO') && (
                <div style={{ marginTop: '8px', borderTop: '1px solid #444', paddingTop: '8px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#ffc107', marginBottom: '6px' }}>
                    ✂️ TRIM IESTATĪJUMI (Sekundēs)
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Sākums (sek):</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={selectedElement.trimStart ?? 0}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          updateActiveSlide((s) => {
                            const el = s.config.layout.find((x) => x.id === selectedElement.id);
                            if (el) {
                              el.trimStart = val;
                              if (!el.isTrimEndCustom || (el.trimEnd && el.trimEnd <= el.trimStart)) {
                                el.trimEnd = Number((val + 30).toFixed(2));
                              }
                            }
                          });
                        }}
                        style={inputStyle}
                      />
                      <div style={{ fontSize: '0.75rem', color: '#00ff00', marginTop: '2px' }}>
                        {secondsToTimeStr(selectedElement.trimStart || 0)}
                      </div>
                    </div>

                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Beigas (sek):</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={selectedElement.trimEnd ?? ((selectedElement.trimStart || 0) + 30)}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          updateActiveSlide((s) => {
                            const el = s.config.layout.find((x) => x.id === selectedElement.id);
                            if (el) {
                              el.trimEnd = val;
                              el.isTrimEndCustom = true;
                            }
                          });
                        }}
                        style={inputStyle}
                      />
                      <div style={{ fontSize: '0.75rem', color: '#ffc107', marginTop: '2px' }}>
                        {secondsToTimeStr(selectedElement.trimEnd || ((selectedElement.trimStart || 0) + 30))}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    <button style={{ ...btnSmallAction, background: '#28a745' }} onClick={() => playPreviewFragment(selectedElement)}>
                      ▶️ Pārbaudīt fragmentu
                    </button>
                    <button style={{ ...btnSmallAction, background: '#666' }} onClick={stopPreviewFragment}>
                      ⏹️ Stop
                    </button>
                  </div>
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
              {mediaList
                .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
                .map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
            </select>
            <button
              style={btnSmallAction}
              onClick={() => {
                const bg = activeSlide.config.backgroundUrl;
                setSlides((prev) =>
                  prev.map((sl) => ({ ...sl, config: { ...sl.config, backgroundUrl: bg } }))
                );
                alert('🖼️ Fons pielietots visiem slaidiem!');
              }}
            >
              Pielietot šo fonu visiem slaidiem
            </button>
          </div>

          {/* JAUTĀJUMA / MAJORITY IESTATĪJUMI */}
          {(activeSlide.type === 'QUESTION' || activeSlide.type === 'MAJORITY') && (
            <div style={{ marginTop: '10px', borderTop: '1px solid #333', paddingTop: '10px' }}>
              <label style={labelStyle}>Atbilšu skaits (2-6):</label>
              <div style={{ display: 'flex', gap: '4px', margin: '6px 0' }}>
                {[2, 3, 4, 5, 6].map((num) => (
                  <button
                    key={num}
                    style={{
                      ...btnNumber,
                      background: activeSlide.config.optionsCount === num ? '#007bff' : '#333'
                    }}
                    onClick={() => {
                      updateActiveSlide((s) => {
                        s.config.optionsCount = num;
                        const cur = s.config.options || [];
                        const updated: string[] = [];
                        for (let i = 0; i < num; i++) updated.push(cur[i] || `Variants ${String.fromCharCode(65 + i)}`);
                        s.config.options = updated;
                      });
                    }}
                  >
                    {num}
                  </button>
                ))}
              </div>

              <label style={labelStyle}>Izkārtojums:</label>
              <select
                style={selectStyle}
                value={activeSlide.config.optionsLayout || 'GRID'}
                onChange={(e) => updateActiveSlide((s) => (s.config.optionsLayout = e.target.value as any))}
              >
                <option value="GRID">Režģī (2 kolonnas)</option>
                <option value="COLUMN">Stabiņā (1 kolonna)</option>
                <option value="INDIVIDUAL">Brīvi vilkt (Individuāli)</option>
              </select>

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
                  <label style={labelStyle}>Sākums / Max:</label>
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
                    <label style={labelStyle}>Beigās / Min:</label>
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

// --- STILI ---
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
  width: '310px',
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
  fontSize: '0.9rem',
  boxShadow: '0 4px 10px rgba(0,123,255,0.3)'
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