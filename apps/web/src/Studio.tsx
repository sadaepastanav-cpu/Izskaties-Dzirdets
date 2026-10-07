import React, { useState, useEffect, useRef } from 'react';
import { BACKEND_URL, getAdminHeaders } from './config';
import { Slide, CanvasElement, MobileBranding, DiplomaConfig } from './types';
import { getStudioFontSize, getOptionFontSize, hexToRgba } from './utils/formatting';

const MEDIA_BASE_URL = `${BACKEND_URL}/project-media`;

interface ImportedQuestionPreview {
  title: string;
  options: string[];
  correctAnswers: string[];
  duration: number;
  points: number;
  notes?: string;
  playerUIMode?: 'AUTO' | 'CLASSIC_GRID' | 'TEXT_CARDS' | 'MUSIC_DUAL';
}

export default function Studio() {
  const [activeFolder, setActiveFolder] = useState<string>(
    localStorage.getItem('event_studio_folder') || ''
  );
  const [projectFile, setProjectFile] = useState('mans_quiz.json');
  const [availableProjects, setAvailableProjects] = useState<string[]>([]);
  const [mediaList, setMediaList] = useState<string[]>([]);
  const [mediaSearchQuery, setMediaSearchQuery] = useState('');
  const [isSnapToGrid, setIsSnapToGrid] = useState(true);

  // 📊 Excel / CSV Importa logs
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRawText, setImportRawText] = useState('');
  const [importedQuestions, setImportedQuestions] = useState<ImportedQuestionPreview[]>([]);
  const [importMode, setImportMode] = useState<'APPEND' | 'REPLACE'>('APPEND');

  // 🏆 Diplomu dizaina priekšskatījuma logs
  const [showDiplomaModal, setShowDiplomaModal] = useState(false);

  // Akordeona sadaļas
  const [sections, setSections] = useState({
    branding: true,
    diploma: false,
    media: true,
    info: true,
    options: true,
    timer: true,
    style: false
  });

  const toggleSection = (key: keyof typeof sections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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
    maxMissedQuestions: 5,
    gameLogoPosition: 'NONE',
    diplomaConfig: {
      theme: 'GOLD_DARK',
      bgColor: '#111111',
      borderColor: '#ffc107',
      titleColor: '#ffffff',
      winnerColor: '#ffd700',
      customTitle: '🏆 DIPLOMS 🏆',
      customSubtitle: 'Par iegūto vietu spēlē',
      footerText: 'Event Studio',
      inkSaverMode: false,
      showLogo: true,
      logoPosition: 'TOP'
    }
  });

  const [newTeamInput, setNewTeamInput] = useState('');
  const [newOrderingItemInput, setNewOrderingItemInput] = useState('');

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
        requiredCount: 1,
        submitMode: 'INSTANT',
        autoStart: false,
        notes: 'Paskaidrojums vadītājam: Rīga dibināta 1201. gadā.',
        optionsCount: 4,
        options: ['Rīga', 'Liepāja', 'Daugavpils', 'Jelgava'],
        correctAnswers: ['Rīga'],
        correctOrder: ['Rīga', 'Liepāja', 'Daugavpils', 'Jelgava'],
        answerCorrectness: { Rīga: 100 },
        optionsLayout: 'INDIVIDUAL',
        optionsPositions: {},
        optionsColor: '#ffffff',
        optionsBgColor: '#000000',
        optionsBgOpacity: 85,
        optionsCorrectColor: '#00ff00',
        buzzerRaceType: 'WITH_OPTIONS',
        buzzerEvaluationMode: 'AUTO',
        buzzerMode: 'QUEUE_PASS',
        buzzerMaxQueue: 5,
        maxAttemptsPerPlayer: 1,
        lbType: 'TOTAL',
        playerUIMode: 'AUTO',
        musicCategoryTop: '🎤 Izpildītājs',
        musicCategoryBottom: '🎵 Dziesmas nosaukums',
        timerType: 'COUNTDOWN',
        timerPlacement: 'CENTER',
        timerLabel: 'Pārtraukums',
        timerDuration: 300,
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
      if (!copy[activeSlideIdx]) return prev;
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

  const handleDuplicateSelectedElements = () => {
    if (selectedElementIds.length === 0) return;
    const newIds: string[] = [];
    updateActiveSlide((s) => {
      const toClone = s.config.layout.filter((el) => selectedElementIds.includes(el.id));
      toClone.forEach((el, idx) => {
        const cloned: CanvasElement = JSON.parse(JSON.stringify(el));
        cloned.id = `${cloned.type.toLowerCase()}-${Date.now()}-${idx}`;
        cloned.x = Math.min(85, cloned.x + 3);
        cloned.y = Math.min(85, cloned.y + 3);
        s.config.layout.push(cloned);
        newIds.push(cloned.id);
      });
    });
    if (newIds.length > 0) {
      setSelectedElementIds(newIds);
    }
  };

  const bringSelectedToFront = () => {
    if (selectedElementIds.length === 0) return;
    updateActiveSlide((s) => {
      const selected = s.config.layout.filter((el) => selectedElementIds.includes(el.id));
      const unselected = s.config.layout.filter((el) => !selectedElementIds.includes(el.id));
      s.config.layout = [...unselected, ...selected];
    });
  };

  const sendSelectedToBack = () => {
    if (selectedElementIds.length === 0) return;
    updateActiveSlide((s) => {
      const selected = s.config.layout.filter((el) => selectedElementIds.includes(el.id));
      const unselected = s.config.layout.filter((el) => !selectedElementIds.includes(el.id));
      s.config.layout = [...selected, ...unselected];
    });
  };

  const uploadAndAddMedia = async (file: File) => {
    const formData = new FormData();
    formData.append('mediaFile', file);

    try {
      const res = await fetch(`${BACKEND_URL}/api/upload-media`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: formData
      });
      const data = await res.json();
      if (data.success && data.fileName) {
        syncWorkingFolder();
        addMediaElement(data.fileName);
      }
    } catch {
      alert('Kļūda ielādējot failu!');
    }
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

  // 📊 EXCEL / CSV PARSERIS
  const parseDelimitedText = (text: string): string[][] => {
    const lines = text.trim().split(/\r\n|\n|\r/);
    return lines.map((line) => {
      const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      return result;
    });
  };

  const processImportText = (raw: string) => {
    setImportRawText(raw);
    const rows = parseDelimitedText(raw);
    if (rows.length === 0) {
      setImportedQuestions([]);
      return;
    }

    const firstRowStr = rows[0].join(' ').toLowerCase();
    const hasHeader =
      firstRowStr.includes('jautājums') ||
      firstRowStr.includes('question') ||
      firstRowStr.includes('variants') ||
      firstRowStr.includes('option') ||
      firstRowStr.includes('pareizā') ||
      firstRowStr.includes('correct');

    const dataRows = hasHeader ? rows.slice(1) : rows;
    const parsed: ImportedQuestionPreview[] = [];

    dataRows.forEach((cols) => {
      if (cols.length < 2 || !cols[0] || cols[0].trim() === '') return;

      const title = cols[0].trim();
      let rawOptions: string[] = [];
      let correctIndicator = '';
      let duration = 30;
      let points = 10;
      let notes = '';

      if (cols.length >= 6) {
        rawOptions = [cols[1], cols[2], cols[3], cols[4], cols[5], cols[6]].filter(Boolean);
        correctIndicator = cols[5] ? cols[5].trim() : 'A';
        if (cols[6] && !isNaN(Number(cols[6]))) duration = Number(cols[6]);
        if (cols[7] && !isNaN(Number(cols[7]))) points = Number(cols[7]);
        if (cols[8]) notes = cols[8].trim();
      } else if (cols.length >= 3) {
        rawOptions = cols.slice(1, cols.length - 1).filter(Boolean);
        correctIndicator = cols[cols.length - 1] ? cols[cols.length - 1].trim() : 'A';
      } else {
        rawOptions = [cols[1], 'B', 'C', 'D'];
        correctIndicator = 'A';
      }

      let correctAnswers: string[] = [];
      const letterMatch = correctIndicator.toUpperCase().match(/^[A-F]$/);
      if (letterMatch) {
        const letterIdx = letterMatch[0].charCodeAt(0) - 65;
        if (rawOptions[letterIdx]) {
          correctAnswers = [rawOptions[letterIdx]];
        } else {
          correctAnswers = [letterMatch[0]];
        }
      } else {
        correctAnswers = [correctIndicator];
      }

      parsed.push({
        title,
        options: rawOptions.length > 0 ? rawOptions : ['A', 'B', 'C', 'D'],
        correctAnswers,
        duration,
        points,
        notes
      });
    });

    setImportedQuestions(parsed);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        processImportText(content);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const executeImportToProject = () => {
    if (importedQuestions.length === 0) return alert('Nav atrasts neviens jautājums ko importēt!');

    const generatedSlides: Slide[] = importedQuestions.map((q, idx) => {
      const correctnessMap: Record<string, number> = {};
      q.correctAnswers.forEach((ans) => {
        correctnessMap[ans] = 100;
      });

      return {
        id: `slide-${Date.now()}-${idx}`,
        title: `${idx + 1}. ${q.title.slice(0, 24)}...`,
        type: 'QUESTION',
        config: {
          duration: q.duration || 30,
          points: q.points || 10,
          pointsMin: 1,
          pointsMax: q.points || 10,
          scoringMode: 'FIXED',
          speedBonusEnabled: false,
          selectionMode: 'ALL',
          requiredCount: q.correctAnswers.length || 1,
          submitMode: 'INSTANT',
          autoStart: false,
          notes: q.notes || '',
          optionsCount: q.options.length,
          options: q.options,
          correctAnswers: q.correctAnswers,
          correctOrder: [...q.options],
          answerCorrectness: correctnessMap,
          optionsLayout: 'INDIVIDUAL',
          optionsPositions: {},
          optionsColor: '#ffffff',
          optionsBgColor: '#000000',
          optionsBgOpacity: 85,
          optionsCorrectColor: '#00ff00',
          buzzerRaceType: 'WITH_OPTIONS',
          buzzerEvaluationMode: 'AUTO',
          buzzerMode: 'QUEUE_PASS',
          buzzerMaxQueue: 5,
          maxAttemptsPerPlayer: 1,
          lbType: 'TOTAL',
          playerUIMode: 'AUTO',
          musicCategoryTop: '🎤 Izpildītājs',
          musicCategoryBottom: '🎵 Dziesmas nosaukums',
          timerType: 'COUNTDOWN',
          timerPlacement: 'CENTER',
          timerLabel: 'Pārtraukums',
          timerDuration: 300,
          backgroundUrl: activeSlide?.config?.backgroundUrl,
          layout: [
            {
              id: `q-box-${Date.now()}-${idx}`,
              type: 'QUESTION',
              content: q.title,
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
    });

    let newSlideList: Slide[] = [];
    if (importMode === 'REPLACE') {
      newSlideList = generatedSlides;
    } else {
      newSlideList = [...slides, ...generatedSlides];
    }

    setSlides(newSlideList);
    pushToHistory(newSlideList);
    setActiveSlideIdx(importMode === 'REPLACE' ? 0 : slides.length);
    setSelectedSlideIndices([importMode === 'REPLACE' ? 0 : slides.length]);
    setShowImportModal(false);
    setImportRawText('');
    setImportedQuestions([]);
    alert(`🎉 Veiksmīgi importēti ${generatedSlides.length} jautājumi!`);
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

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateSelectedElements();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
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

    const onPaste = (e: ClipboardEvent) => {
      const isTyping = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName);
      if (isTyping) return;

      if (e.clipboardData && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          uploadAndAddMedia(file);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('paste', onPaste);
    };
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
        requiredCount: 1,
        submitMode: 'INSTANT',
        autoStart: false,
        notes: '',
        optionsCount: 4,
        options: ['Variants A', 'Variants B', 'Variants C', 'Variants D'],
        correctAnswers: ['Variants A'],
        correctOrder: ['Variants A', 'Variants B', 'Variants C', 'Variants D'],
        answerCorrectness: { 'Variants A': 100 },
        optionsLayout: 'INDIVIDUAL',
        optionsPositions: {},
        optionsColor: '#ffffff',
        optionsBgColor: '#000000',
        optionsBgOpacity: 85,
        optionsCorrectColor: '#00ff00',
        buzzerRaceType: 'WITH_OPTIONS',
        buzzerEvaluationMode: 'AUTO',
        buzzerMode: 'QUEUE_PASS',
        buzzerMaxQueue: 5,
        maxAttemptsPerPlayer: 1,
        lbType: 'TOTAL',
        playerUIMode: 'AUTO',
        musicCategoryTop: '🎤 Izpildītājs',
        musicCategoryBottom: '🎵 Dziesmas nosaukums',
        timerType: 'COUNTDOWN',
        timerPlacement: 'CENTER',
        timerLabel: 'Pārtraukums',
        timerDuration: 300,
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
        const totalOpt = activeSlide.config.options?.length || 4;
        const pos = activeSlide.config.optionsPositions?.[idx] || {
          x: 10 + (idx % 2) * 42,
          y: totalOpt > 4 ? 52 + Math.floor(idx / 2) * 12 : 58 + Math.floor(idx / 2) * 13,
          w: 38,
          h: totalOpt > 4 ? 9 : 10
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
      uploadAndAddMedia(file);
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

  const moveOrderingItem = (index: number, direction: 'UP' | 'DOWN') => {
    const opts = [...(activeSlide.config.options || [])];
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= opts.length) return;
    const temp = opts[index];
    opts[index] = opts[targetIdx];
    opts[targetIdx] = temp;
    updateActiveSlide((s) => {
      s.config.options = opts;
      s.config.correctOrder = opts;
    });
  };

  const addOrderingItem = () => {
    if (!newOrderingItemInput.trim()) return;
    const opts = [...(activeSlide.config.options || []), newOrderingItemInput.trim()];
    updateActiveSlide((s) => {
      s.config.options = opts;
      s.config.correctOrder = opts;
      s.config.optionsCount = opts.length;
    });
    setNewOrderingItemInput('');
  };

  const removeOrderingItem = (index: number) => {
    const opts = (activeSlide.config.options || []).filter((_, idx) => idx !== index);
    updateActiveSlide((s) => {
      s.config.options = opts;
      s.config.correctOrder = opts;
      s.config.optionsCount = opts.length;
    });
  };

  const hasMultipleSelection = selectedElements.length > 1;
  const filteredMediaList = mediaList.filter((m) =>
    m.toLowerCase().includes(mediaSearchQuery.toLowerCase())
  );

  const diplomaCfg: DiplomaConfig = mobileBranding.diplomaConfig || {};

  return (
    <div style={studioLayout} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      {/* 1. RIBBON JOSLA */}
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
                      correctOrder: ['A', 'B', 'C', 'D'],
                      answerCorrectness: { A: 100 },
                      selectionMode: 'ALL',
                      requiredCount: 1,
                      submitMode: 'INSTANT',
                      autoStart: false,
                      optionsLayout: 'INDIVIDUAL',
                      optionsPositions: {},
                      optionsColor: '#ffffff',
                      optionsBgColor: '#000000',
                      optionsBgOpacity: 85,
                      optionsCorrectColor: '#00ff00',
                      buzzerRaceType: 'WITH_OPTIONS',
                      buzzerEvaluationMode: 'AUTO',
                      buzzerMode: 'QUEUE_PASS',
                      buzzerMaxQueue: 5,
                      maxAttemptsPerPlayer: 1,
                      lbType: 'TOTAL',
                      playerUIMode: 'AUTO',
                      musicCategoryTop: '🎤 Izpildītājs',
                      musicCategoryBottom: '🎵 Dziesmas nosaukums',
                      timerType: 'COUNTDOWN',
                      timerPlacement: 'CENTER',
                      timerLabel: 'Pārtraukums',
                      timerDuration: 300,
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

          <button
            style={{ ...btnAction, background: '#6f42c1', border: '1px solid #b537f2' }}
            onClick={() => setShowImportModal(true)}
            title="Importēt jautājumus no Excel vai CSV faila"
          >
            📊 Importēt (Excel/CSV)
          </button>

          <button
            style={{ ...btnAction, background: '#d63384' }}
            onClick={() => setShowDiplomaModal(true)}
            title="Apskatīt un pielāgot diplomu dizainu"
          >
            🏆 Diplomi
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
                      {s.type === 'TIMER' && <span title="Taimeris / Pulkstenis" style={{ color: '#ffc107', marginRight: '4px' }}>⏱️</span>}
                      {s.config?.playerUIMode === 'MUSIC_DUAL' && <span title="Muzikālā spēle" style={{ color: '#ff007f', marginRight: '4px' }}>🎵</span>}
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

            {/* ⏱️ JAUNĀ TAIMERA (TIMER) SLAIDA KANVAS SKATS */}
            {activeSlide?.type === 'TIMER' && (
              <div
                style={{
                  position: 'absolute',
                  left: activeSlide.config.timerPlacement === 'TOP_RIGHT' ? 'auto' : '50%',
                  right: activeSlide.config.timerPlacement === 'TOP_RIGHT' ? '25px' : 'auto',
                  top: activeSlide.config.timerPlacement === 'TOP_RIGHT' ? '25px' : '50%',
                  transform: activeSlide.config.timerPlacement === 'TOP_RIGHT' ? 'none' : 'translate(-50%, -50%)',
                  background: 'rgba(0, 0, 0, 0.85)',
                  border: '3px solid #ffc107',
                  borderRadius: '20px',
                  padding: activeSlide.config.timerPlacement === 'TOP_RIGHT' ? '15px 25px' : '30px 60px',
                  textAlign: 'center',
                  boxShadow: '0 10px 40px rgba(255, 193, 7, 0.4)',
                  zIndex: 20
                }}
              >
                <div style={{ fontSize: activeSlide.config.timerPlacement === 'TOP_RIGHT' ? '0.9rem' : '1.4rem', color: '#00e5ff', fontWeight: 'bold', marginBottom: '6px' }}>
                  {activeSlide.config.timerLabel || (activeSlide.config.timerType === 'CLOCK' ? 'PULKSTENIS' : 'PĀRTRAUKUMS')}
                </div>
                <div style={{ fontSize: activeSlide.config.timerPlacement === 'TOP_RIGHT' ? '2.4rem' : '4.5rem', fontWeight: '900', color: '#ffc107', letterSpacing: '2px', textShadow: '0 0 20px gold' }}>
                  {activeSlide.config.timerType === 'CLOCK' ? '19:45:00' : `${Math.floor((activeSlide.config.timerDuration || 300) / 60)}:00`}
                </div>
                {activeSlide.config.timerBgVideo && (
                  <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '6px' }}>
                    🎬 Video fons: {activeSlide.config.timerBgVideo}
                  </div>
                )}
              </div>
            )}

            {/* ⚡ ĀTRĀS PULTS KANVAS SKATS */}
            {activeSlide?.type === 'BUZZER_RACE' && (
              <div style={{ position: 'absolute', bottom: '30px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
                <div style={{ width: '110px', height: '110px', borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #ff4d4d, #cc0000, #800000)', border: '4px solid #fff', boxShadow: '0 0 25px rgba(255, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.2rem', fontWeight: '900' }}>
                  ⚡ BUZZER
                </div>
                <span style={{ color: '#ffc107', marginTop: '6px', fontWeight: 'bold', fontSize: '0.9rem', background: 'rgba(0,0,0,0.8)', padding: '2px 10px', borderRadius: '6px' }}>
                  {activeSlide.config.buzzerRaceType === 'WITH_OPTIONS' ? 'Ātrā pults: pirmais atbild ar variantiem' : 'Ātrā pults: mutiska atbilde vadītājam'}
                </span>
              </div>
            )}

            {/* 🔢 SECĪBAS KĀRTOŠANAS KANVAS SKATS */}
            {activeSlide?.type === 'ORDERING' && (
              <div style={{ position: 'absolute', bottom: '20px', width: '85%', left: '7.5%', display: 'flex', flexDirection: 'column', gap: '6px', zIndex: 10 }}>
                {(activeSlide.config.options || []).map((item, idx) => (
                  <div
                    key={`order-card-preview-${idx}`}
                    style={{
                      background: hexToRgba(activeSlide.config.optionsBgColor || '#000', activeSlide.config.optionsBgOpacity ?? 85),
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #333',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    <span style={{ color: '#00e5ff', fontWeight: 'bold', fontSize: '1.1rem' }}>#{idx + 1}</span>
                    <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.95rem' }}>{item || `Elements #${idx + 1}`}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ATBILŽU POGAS */}
            {(activeSlide?.type === 'QUESTION' || activeSlide?.type === 'MAJORITY' || (activeSlide?.type === 'BUZZER_RACE' && activeSlide?.config?.buzzerRaceType === 'WITH_OPTIONS')) &&
              activeSlide?.config?.options?.map((opt, i) => {
                const isIndividual = (activeSlide.config.optionsLayout || 'INDIVIDUAL') === 'INDIVIDUAL';
                const isRightColumn = activeSlide.config.optionsLayout === 'RIGHT_COLUMN';
                const totalOpt = activeSlide.config.options.length;

                let defaultPos = {
                  x: 10 + (i % 2) * 42,
                  y: totalOpt > 4 ? 52 + Math.floor(i / 2) * 12 : 58 + Math.floor(i / 2) * 13,
                  w: 38,
                  h: totalOpt > 4 ? 9 : 10
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

                const isMusicMode = activeSlide.config.playerUIMode === 'MUSIC_DUAL';
                const isMusicTop = isMusicMode && i < 3;
                const isMusicBottom = isMusicMode && i >= 3;

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
                      border: isSelected ? '2px dashed #ffc107' : isMusicTop ? '2px solid #00e5ff' : isMusicBottom ? '2px solid #ff007f' : 'none',
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
                        border: isCorrect ? `2px solid #ffffff` : isMusicTop ? '2px solid #00e5ff' : isMusicBottom ? '2px solid #ff007f' : '2px solid #ffc107',
                        boxShadow: isCorrect ? `0 0 15px ${optCorrectColor}` : '0 0 10px rgba(0,0,0,0.9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '1.2rem',
                        color: isCorrect ? '#000' : isMusicTop ? '#00e5ff' : isMusicBottom ? '#ff007f' : '#ffc107',
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

                    {(activeSlide.type === 'QUESTION' || activeSlide.type === 'BUZZER_RACE') && (
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
                                s.config.answerCorrectness[targetKey] = isMusicMode ? 50 : 100;
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

        {/* LABĀ PUSE: Inspektors un iestatījumi */}
        <div style={sidebarRight}>
          {selectedElements.length > 0 && primarySelectedElement && (
            <div style={selectedBoxTop}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', color: '#00ff00', fontSize: '0.85rem' }}>
                  {hasMultipleSelection ? `👥 ATLASĪTI: ${selectedElements.length} ELEMENTI` : `IZVĒLĒTS: ${primarySelectedElement.type}`}
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={handleDuplicateSelectedElements} style={{ background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '3px 6px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    📋 [Ctrl+D]
                  </button>
                  <button onClick={deleteSelectedElements} style={{ background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '3px 6px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    🗑️ [Del]
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                <button onClick={bringSelectedToFront} style={{ flex: 1, padding: '4px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  ⏫ Uz priekšu
                </button>
                <button onClick={sendSelectedToBack} style={{ flex: 1, padding: '4px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  ⏬ Uz aizmuguri
                </button>
              </div>

              {selectedElements.some((el) => el.type === 'QUESTION' || el.type === 'TEXT') && (
                <div style={{ borderTop: '1px solid #444', paddingTop: '6px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                    <select
                      style={{ ...selectStyle, flex: 1.4 }}
                      value={primarySelectedElement.fontFamily || 'Segoe UI'}
                      onChange={(e) => updateSelectedElements((el) => { el.fontFamily = e.target.value; })}
                    >
                      <option value="Segoe UI">Segoe UI</option>
                      <option value="Montserrat">Montserrat</option>
                      <option value="Impact">Impact</option>
                      <option value="Roboto">Roboto</option>
                      <option value="Arial">Arial</option>
                    </select>

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
                      style={{ ...inputStyle, flex: 1 }}
                      title="Fonta izmērs"
                    />
                  </div>
                </div>
              )}

              {selectedElements.some((el) => el.type === 'IMAGE' || el.type === 'VIDEO') && (
                <div style={{ borderTop: '1px solid #444', paddingTop: '6px', marginBottom: '6px' }}>
                  <label style={labelStyle}>Aizmiglojums (Blur):</label>
                  <select
                    style={{ ...selectStyle, borderColor: '#00e5ff' }}
                    value={primarySelectedElement.blurMode || 'NONE'}
                    onChange={(e) => updateSelectedElements((el) => { el.blurMode = e.target.value as any; })}
                  >
                    <option value="NONE">❌ Bez Blur (Normāls)</option>
                    <option value="STATIC">🔒 Fiksēts Blur</option>
                    <option value="PROGRESSIVE">✨ Dinamiskais Blur (Kļūst ass)</option>
                  </select>

                  {(primarySelectedElement.blurMode === 'STATIC' || primarySelectedElement.blurMode === 'PROGRESSIVE') && (
                    <div>
                      <input
                        type="range"
                        min="2"
                        max="40"
                        value={primarySelectedElement.blurAmount || 12}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateSelectedElements((el) => { el.blurAmount = val; });
                        }}
                        style={{ width: '100%', accentColor: '#00e5ff' }}
                      />
                    </div>
                  )}
                </div>
              )}

              {selectedElements.some((el) => el.type === 'VIDEO' || el.type === 'AUDIO') && (
                <div style={{ borderTop: '1px solid #444', paddingTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#aaa', marginBottom: '2px' }}>
                    <span>Skaļums:</span>
                    <span style={{ color: '#00ff00', fontWeight: 'bold' }}>{primarySelectedElement.volume ?? 100}%</span>
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
                      if (previewMediaRef.current) previewMediaRef.current.volume = val / 100;
                    }}
                    style={{ width: '100%', accentColor: '#00ff00' }}
                  />
                  <button style={{ ...btnSmallAction, background: '#28a745', marginTop: '6px' }} onClick={() => playPreviewFragment(primarySelectedElement)}>
                    ▶️ Pārbaudīt skaņu
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 📱 SPĒLES & MOBILIE IESTATĪJUMI */}
          <div style={accordionCard}>
            <div style={accordionHeader} onClick={() => toggleSection('branding')}>
              <span>📱 SPĒLES & MOBILIE IESTATĪJUMI</span>
              <span>{sections.branding ? '▲' : '▼'}</span>
            </div>

            {sections.branding && (
              <div style={{ marginTop: '10px' }}>
                <label style={labelStyle}>Lietotnes nosaukums telefonā:</label>
                <input
                  style={inputStyle}
                  value={mobileBranding.appTitle || 'EVENT BUZZER'}
                  onChange={(e) => setMobileBranding({ ...mobileBranding, appTitle: e.target.value })}
                />

                <label style={labelStyle}>Sākuma Logo (PNG/SVG):</label>
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

                {/* 🌟 SPĒLES LAIKA LOGO POZĪCIJA */}
                <label style={labelStyle}>Logo pozīcija spēles laikā:</label>
                <select
                  style={{ ...selectStyle, borderColor: '#00e5ff' }}
                  value={mobileBranding.gameLogoPosition || 'NONE'}
                  onChange={(e) => setMobileBranding({ ...mobileBranding, gameLogoPosition: e.target.value as any })}
                >
                  <option value="NONE">❌ Nerādīt spēles laikā (Tikai Lobby)</option>
                  <option value="TOP">⬆️ Rādīt augšā virs pultīm</option>
                  <option value="BOTTOM">⬇️ Rādīt apakšā zem pultīm</option>
                </select>

                <label style={labelStyle}>Spēlētāja fona attēls (9:16):</label>
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
                  <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Mobilā fona krāsa:</span>
                  <input
                    type="color"
                    value={mobileBranding.appBgColor || '#121212'}
                    onChange={(e) => setMobileBranding({ ...mobileBranding, appBgColor: e.target.value })}
                    style={colorPicker}
                  />
                </div>

                <label style={labelStyle}>Sākuma reģistrācijas ekrāns:</label>
                <select
                  style={{ ...selectStyle, borderColor: '#00e5ff' }}
                  value={mobileBranding.lobbyMode || 'CIRCLE'}
                  onChange={(e) => setMobileBranding({ ...mobileBranding, lobbyMode: e.target.value as any })}
                >
                  <option value="CIRCLE">Klasiskais (Lielais PIN & Aplis)</option>
                  <option value="INTERACTIVE_DOTS">Interaktīvais (Bumbiņas ar Pults testu)</option>
                </select>

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
                        <option value="AVG">Vidējais punktu skaits</option>
                        <option value="SUM">Kopējā punktu summa</option>
                      </select>

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

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '70px', overflowY: 'auto' }}>
                        {(mobileBranding.predefinedTeams || []).map((team) => (
                          <span
                            key={team}
                            style={{ background: '#003366', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            {team}
                            <button onClick={() => handleRemoveTeam(team)} style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer', padding: 0, fontWeight: 'bold' }}>×</button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 🏆 DIPLOMU DIZAINERS & IESTATĪJUMI */}
          <div style={accordionCard}>
            <div style={accordionHeader} onClick={() => toggleSection('diploma')}>
              <span>🏆 DIPLOMU DIZAINS & NOFORMĒJUMS</span>
              <span>{sections.diploma ? '▲' : '▼'}</span>
            </div>

            {sections.diploma && (
              <div style={{ marginTop: '10px' }}>
                <button
                  onClick={() => setShowDiplomaModal(true)}
                  style={{ ...btnSmallAction, background: '#d63384', color: '#fff', fontWeight: 'bold', marginBottom: '10px' }}
                >
                  👁️ Atvērt diplomu priekšskatījumu
                </button>

                <label style={labelStyle}>Drukas tēma:</label>
                <select
                  style={selectStyle}
                  value={diplomaCfg.theme || 'GOLD_DARK'}
                  onChange={(e) => setMobileBranding({
                    ...mobileBranding,
                    diplomaConfig: { ...diplomaCfg, theme: e.target.value as any }
                  })}
                >
                  <option value="GOLD_DARK">🌙 Zelta & Tumšs (Grezns)</option>
                  <option value="GOLD_WHITE_PRINT">🖨️ Balts & Tinti taupošs (Printerim)</option>
                </select>

                <label style={labelStyle}>Diplomu virsraksts:</label>
                <input
                  style={inputStyle}
                  value={diplomaCfg.customTitle || '🏆 DIPLOMS 🏆'}
                  onChange={(e) => setMobileBranding({
                    ...mobileBranding,
                    diplomaConfig: { ...diplomaCfg, customTitle: e.target.value }
                  })}
                />

                <label style={labelStyle}>Apakšvirsraksts:</label>
                <input
                  style={inputStyle}
                  value={diplomaCfg.customSubtitle || 'Par iegūto vietu spēlē'}
                  onChange={(e) => setMobileBranding({
                    ...mobileBranding,
                    diplomaConfig: { ...diplomaCfg, customSubtitle: e.target.value }
                  })}
                />

                <label style={labelStyle}>Kājenes teksts:</label>
                <input
                  style={inputStyle}
                  value={diplomaCfg.footerText || 'Event Studio'}
                  onChange={(e) => setMobileBranding({
                    ...mobileBranding,
                    diplomaConfig: { ...diplomaCfg, footerText: e.target.value }
                  })}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Rāmja krāsa:</span>
                  <input
                    type="color"
                    value={diplomaCfg.borderColor || '#ffc107'}
                    onChange={(e) => setMobileBranding({
                      ...mobileBranding,
                      diplomaConfig: { ...diplomaCfg, borderColor: e.target.value }
                    })}
                    style={colorPicker}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 📁 MEDIJU MAPE */}
          <div style={accordionCard}>
            <div style={accordionHeader} onClick={() => toggleSection('media')}>
              <span>📁 MEDIJU MAPE ({filteredMediaList.length})</span>
              <span>{sections.media ? '▲' : '▼'}</span>
            </div>

            {sections.media && (
              <div style={{ marginTop: '10px' }}>
                <input
                  style={{ ...inputStyle, marginBottom: '8px', fontSize: '0.85rem', borderColor: '#00e5ff' }}
                  placeholder="🔍 Meklēt mediju..."
                  value={mediaSearchQuery}
                  onChange={(e) => setMediaSearchQuery(e.target.value)}
                />
                <div style={{ maxHeight: '140px', overflowY: 'auto' }}>
                  {filteredMediaList.length === 0 ? (
                    <div style={{ fontSize: '0.75rem', color: '#888', fontStyle: 'italic', padding: '4px' }}>Nav atbilstošu failu</div>
                  ) : (
                    filteredMediaList.map((m) => (
                      <div key={m} style={mediaItem} onClick={() => addMediaElement(m)} title="Klikšķini, lai pievienotu slaidam">
                        📄 {m}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 📋 SLAIDA TIPS & PIEZĪMES */}
          <div style={accordionCard}>
            <div style={accordionHeader} onClick={() => toggleSection('info')}>
              <span>📋 SLAIDA TIPS & PIEZĪMES</span>
              <span>{sections.info ? '▲' : '▼'}</span>
            </div>

            {sections.info && (
              <div style={{ marginTop: '10px' }}>
                <label style={labelStyle}>Slaida tips:</label>
                <select
                  style={selectStyle}
                  value={activeSlide.type}
                  onChange={(e) => updateActiveSlide((s) => (s.type = e.target.value as any))}
                >
                  <option value="QUESTION">Question (Jautājums)</option>
                  <option value="TIMER">⏱️ Timer (Taimeris / Pulkstenis)</option>
                  <option value="BUZZER_RACE">Buzzer Race (Ātrā pults)</option>
                  <option value="ORDERING">Ordering (Secības kārtošana)</option>
                  <option value="MAJORITY">Majority Rules (Vairākums)</option>
                  <option value="LEADERBOARD">Leaderboard (Līderu tabula)</option>
                  <option value="BILLBOARD">Billboard (Informatīvs ekrāns)</option>
                </select>

                {activeSlide.type === 'LEADERBOARD' && (
                  <div style={{ background: '#1c2833', border: '1px solid #ffc107', borderRadius: '6px', padding: '8px', margin: '8px 0' }}>
                    <label style={{ ...labelStyle, color: '#ffc107', fontWeight: 'bold' }}>Līderu tabulas veids:</label>
                    <select
                      style={{ ...selectStyle, borderColor: '#ffc107', marginTop: '4px' }}
                      value={activeSlide.config.lbType || 'TOTAL'}
                      onChange={(e) => updateActiveSlide((s) => (s.config.lbType = e.target.value as any))}
                    >
                      <option value="TOTAL">⭐ Kopvērtējums (Visi punkti kopā)</option>
                      <option value="ROUND">🏆 Kārtas rezultāti (Tikai šīs kārtas punkti)</option>
                      <option value="FINAL">🥇 Fināla apbalvošana (Podijs Top 3 + Saraksts)</option>
                    </select>
                  </div>
                )}

                <div style={{ background: '#1c2833', border: '1px solid #00e5ff', borderRadius: '6px', padding: '8px', margin: '8px 0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#00e5ff', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!activeSlide.config.autoStart}
                      onChange={(e) => updateActiveSlide((s) => (s.config.autoStart = e.target.checked))}
                    />
                    ⚡ Automātiskais starts (Auto-Start)
                  </label>
                </div>

                <label style={labelStyle}>📝 Piezīmes vadītājam (Host Notes):</label>
                <textarea
                  style={{ ...inputStyle, minHeight: '50px', resize: 'vertical', fontSize: '0.85rem' }}
                  value={activeSlide.config.notes || ''}
                  onChange={(e) => updateActiveSlide((s) => (s.config.notes = e.target.value))}
                  placeholder="Ieraksti skaidrojumu vadītājam..."
                />
              </div>
            )}
          </div>

          {/* ⏱️ TAIMERA SLAIDA IESTATĪJUMI */}
          {activeSlide.type === 'TIMER' && (
            <div style={accordionCard}>
              <div style={accordionHeader} onClick={() => toggleSection('timer')}>
                <span>⏱️ TAIMERA / PULKSTEŅA IESTATĪJUMI</span>
                <span>{sections.timer ? '▲' : '▼'}</span>
              </div>

              {sections.timer && (
                <div style={{ marginTop: '10px' }}>
                  <label style={labelStyle}>Taimera režīms:</label>
                  <select
                    style={selectStyle}
                    value={activeSlide.config.timerType || 'COUNTDOWN'}
                    onChange={(e) => updateActiveSlide((s) => (s.config.timerType = e.target.value as any))}
                  >
                    <option value="COUNTDOWN">⏳ Atpakaļskaitīšanas taimeris (Pārtraukums)</option>
                    <option value="CLOCK">🕒 Reālā laika pulkstenis (HH:MM:SS)</option>
                  </select>

                  <label style={labelStyle}>Izvietojums ekrānā:</label>
                  <select
                    style={selectStyle}
                    value={activeSlide.config.timerPlacement || 'CENTER'}
                    onChange={(e) => updateActiveSlide((s) => (s.config.timerPlacement = e.target.value as any))}
                  >
                    <option value="CENTER">🎯 Liels tieši pa centru</option>
                    <option value="TOP_RIGHT">↗️ Mazāks augšā labajā stūrī</option>
                  </select>

                  <label style={labelStyle}>Virsraksts / Norāde virs laika:</label>
                  <input
                    style={inputStyle}
                    value={activeSlide.config.timerLabel || ''}
                    onChange={(e) => updateActiveSlide((s) => (s.config.timerLabel = e.target.value))}
                    placeholder="Piemēram: Pārtraukums līdz 15:30"
                  />

                  {activeSlide.config.timerType !== 'CLOCK' && (
                    <>
                      <label style={labelStyle}>Ilgums sekundēs (piem., 300 = 5 min):</label>
                      <input
                        type="number"
                        style={inputStyle}
                        value={activeSlide.config.timerDuration ?? 300}
                        onChange={(e) => updateActiveSlide((s) => (s.config.timerDuration = Number(e.target.value)))}
                      />
                    </>
                  )}

                  <label style={labelStyle}>Cilpas video fons (Video loop):</label>
                  <select
                    style={selectStyle}
                    value={activeSlide.config.timerBgVideo || ''}
                    onChange={(e) => updateActiveSlide((s) => (s.config.timerBgVideo = e.target.value))}
                  >
                    <option value="">(Bez video fona)</option>
                    {mediaList.filter((f) => /\.(mp4|mov|webm)$/i.test(f)).map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* 🎯 VARIANTI & SPĒLES LOĢIKA */}
          {(activeSlide.type === 'QUESTION' || activeSlide.type === 'MAJORITY' || activeSlide.type === 'ORDERING' || activeSlide.type === 'BUZZER_RACE') && (
            <div style={accordionCard}>
              <div style={accordionHeader} onClick={() => toggleSection('options')}>
                <span>🎯 VARIANTI & SPĒLES LOĢIKA</span>
                <span>{sections.options ? '▲' : '▼'}</span>
              </div>

              {sections.options && (
                <div style={{ marginTop: '10px' }}>
                  {activeSlide.type === 'QUESTION' && (
                    <div style={{ background: '#17222d', border: '1px solid #00e5ff', borderRadius: '6px', padding: '8px', marginBottom: '10px' }}>
                      <label style={{ ...labelStyle, color: '#00e5ff', fontWeight: 'bold' }}>📱 Pults izskats telefonā (Šim slaidam):</label>
                      <select
                        style={{ ...selectStyle, borderColor: '#00e5ff', marginTop: '4px' }}
                        value={activeSlide.config.playerUIMode || 'AUTO'}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          updateActiveSlide((s) => {
                            s.config.playerUIMode = val;
                            if (val === 'MUSIC_DUAL') {
                              s.config.optionsCount = 6;
                              const cur = s.config.options || [];
                              const updated = [...cur];
                              while (updated.length < 6) updated.push(`Variants ${String.fromCharCode(65 + updated.length)}`);
                              s.config.options = updated.slice(0, 6);
                              s.config.requiredCount = 2;
                            }
                          });
                        }}
                      >
                        <option value="AUTO">✨ Auto (Pēc teksta satura)</option>
                        <option value="CLASSIC_GRID">🔲 Fiksētas 2 rindas (A-C / D-F)</option>
                        <option value="TEXT_CARDS">📝 Kartītes ar tekstu</option>
                        <option value="MUSIC_DUAL">🎵 Muzikālā spēle (Izpildītājs + Dziesma)</option>
                      </select>

                      {activeSlide.config.playerUIMode === 'MUSIC_DUAL' && (
                        <div style={{ marginTop: '6px', borderTop: '1px dashed #00e5ff', paddingTop: '6px' }}>
                          <label style={labelStyle}>Augšējā rinda (A, B, C):</label>
                          <input
                            style={inputStyle}
                            value={activeSlide.config.musicCategoryTop || '🎤 Izpildītājs'}
                            onChange={(e) => updateActiveSlide((s) => (s.config.musicCategoryTop = e.target.value))}
                            placeholder="Piemēram: Izpildītājs"
                          />

                          <label style={{ ...labelStyle, marginTop: '6px' }}>Apakšējā rinda (D, E, F):</label>
                          <input
                            style={inputStyle}
                            value={activeSlide.config.musicCategoryBottom || '🎵 Dziesmas nosaukums'}
                            onChange={(e) => updateActiveSlide((s) => (s.config.musicCategoryBottom = e.target.value))}
                            placeholder="Piemēram: Dziesmas nosaukums"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {activeSlide.type === 'BUZZER_RACE' && (
                    <div style={{ background: '#261c02', border: '1px solid #ffc107', borderRadius: '6px', padding: '8px', marginBottom: '10px' }}>
                      <label style={{ ...labelStyle, color: '#ffc107', fontWeight: 'bold' }}>Ātrās pults atbildēšanas veids:</label>
                      <select
                        style={{ ...selectStyle, borderColor: '#ffc107', marginTop: '4px' }}
                        value={activeSlide.config.buzzerRaceType || 'WITH_OPTIONS'}
                        onChange={(e) => updateActiveSlide((s) => (s.config.buzzerRaceType = e.target.value as any))}
                      >
                        <option value="WITH_OPTIONS">🅰️ Ar variantiem (Pirmais atbild telefonā)</option>
                        <option value="ORAL">🗣️ Mutisks (Pirmais runā ar balsi)</option>
                      </select>

                      <label style={labelStyle}>Vērtēšanas režīms:</label>
                      <select
                        style={selectStyle}
                        value={activeSlide.config.buzzerEvaluationMode || 'AUTO'}
                        onChange={(e) => updateActiveSlide((s) => (s.config.buzzerEvaluationMode = e.target.value as any))}
                      >
                        <option value="AUTO">🤖 Automātisks (Pārbauda sistēma ar Space)</option>
                        <option value="MANUAL">👨‍💼 Manuāls (Vadītājs vērtē Pareizi/Nepareizi)</option>
                      </select>

                      <label style={labelStyle}>Cik ātrākos fiksēt rindā:</label>
                      <select
                        style={selectStyle}
                        value={activeSlide.config.buzzerMaxQueue || 5}
                        onChange={(e) => updateActiveSlide((s) => (s.config.buzzerMaxQueue = Number(e.target.value)))}
                      >
                        <option value="1">Tikai #1</option>
                        <option value="3">Top 3 rindā</option>
                        <option value="5">Top 5 rindā</option>
                        <option value="999">Visus, kas nospiež</option>
                      </select>
                    </div>
                  )}

                  {activeSlide.type === 'ORDERING' && (
                    <div style={{ background: '#15222e', border: '1px solid #00e5ff', borderRadius: '6px', padding: '8px', marginBottom: '10px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#00e5ff', marginBottom: '6px' }}>
                        PAREIZĀ SECĪBA (NO AUGŠAS UZ LEJU):
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {(activeSlide.config.options || []).map((opt, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#0a1520', padding: '3px 6px', borderRadius: '4px' }}>
                            <span style={{ color: '#00e5ff', fontWeight: 'bold', fontSize: '0.8rem' }}>#{idx + 1}</span>
                            <input
                              style={{ ...inputStyle, flex: 1, padding: '2px 4px', fontSize: '0.8rem' }}
                              value={opt}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateActiveSlide((s) => {
                                  s.config.options[idx] = val;
                                  s.config.correctOrder = [...s.config.options];
                                });
                              }}
                            />
                            <button onClick={() => moveOrderingItem(idx, 'UP')} disabled={idx === 0} style={iconBtnSmall}>▲</button>
                            <button onClick={() => moveOrderingItem(idx, 'DOWN')} disabled={idx === (activeSlide.config.options || []).length - 1} style={iconBtnSmall}>▼</button>
                            <button onClick={() => removeOrderingItem(idx)} style={{ ...iconBtnSmall, color: '#ff4d4d' }}>×</button>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                        <input
                          style={{ ...inputStyle, flex: 1, fontSize: '0.8rem' }}
                          placeholder="Jauns elements..."
                          value={newOrderingItemInput}
                          onChange={(e) => setNewOrderingItemInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addOrderingItem()}
                        />
                        <button onClick={addOrderingItem} style={{ ...btnSmallAction, width: 'auto', background: '#007bff', margin: 0 }}>
                          ➕
                        </button>
                      </div>
                    </div>
                  )}

                  {(activeSlide.type === 'QUESTION' || activeSlide.type === 'MAJORITY' || (activeSlide.type === 'BUZZER_RACE' && activeSlide.config.buzzerRaceType === 'WITH_OPTIONS')) && (
                    <>
                      <label style={labelStyle}>Iesniegšanas veids telefonā:</label>
                      <select
                        style={selectStyle}
                        value={activeSlide.config.submitMode || 'INSTANT'}
                        onChange={(e) => updateActiveSlide((s) => (s.config.submitMode = e.target.value as any))}
                      >
                        <option value="INSTANT">⚡ Tūlītējs (Katrs klikšķis fiksējas savā laikā)</option>
                        <option value="CONFIRM">🔒 Ar apstiprinājumu (Spiež "Iesniegt")</option>
                      </select>

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

                      <div style={{ display: 'flex', gap: '8px', margin: '6px 0' }}>
                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>Izvēles režīms:</label>
                          <select
                            style={selectStyle}
                            value={activeSlide.config.selectionMode || 'ALL'}
                            onChange={(e) => updateActiveSlide((s) => (s.config.selectionMode = e.target.value as any))}
                          >
                            <option value="ALL">☑️ Visas pareizās</option>
                            <option value="ANY_ONE">☝️ Jebkura viena pareizā</option>
                          </select>
                        </div>
                        {activeSlide.config.selectionMode === 'ALL' && (
                          <div style={{ width: '90px' }}>
                            <label style={labelStyle}>Jāizvēlas:</label>
                            <input
                              type="number"
                              min="1"
                              max={activeSlide.config.optionsCount || 4}
                              value={activeSlide.config.requiredCount || activeSlide.config.correctAnswers.length || 1}
                              onChange={(e) => {
                                const val = Math.max(1, Number(e.target.value));
                                updateActiveSlide((s) => (s.config.requiredCount = val));
                              }}
                              style={inputStyle}
                            />
                          </div>
                        )}
                      </div>

                      <label style={labelStyle}>Izkārtojums (Layout):</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginTop: '4px' }}>
                        <button
                          type="button"
                          onClick={() => updateActiveSlide((s) => (s.config.optionsLayout = 'INDIVIDUAL'))}
                          style={{
                            padding: '6px 2px',
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
                            padding: '6px 2px',
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
                            padding: '6px 2px',
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
                    </>
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
            </div>
          )}

          {/* 🎨 DIZAINS, KRĀSAS & FONTI */}
          <div style={accordionCard}>
            <div style={accordionHeader} onClick={() => toggleSection('style')}>
              <span>🎨 DIZAINS, KRĀSAS & FONTI</span>
              <span>{sections.style ? '▲' : '▼'}</span>
            </div>

            {sections.style && (
              <div style={{ marginTop: '10px' }}>
                <label style={labelStyle}>Slaida fona attēls:</label>
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

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0' }}>
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
            )}
          </div>
        </div>
      </div>

      {/* 🏆 DIPLOMU DIZAINA & PRIEKŠSKATĪJUMA MODĀLAIS LOGS */}
      {showDiplomaModal && (
        <div
          style={modalOverlayStyle}
          onClick={() => setShowDiplomaModal(false)}
        >
          <div style={diplomaModalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
              <h2 style={{ margin: 0, color: '#d63384' }}>🏆 Diplomus Dizains & Priekšskatījums</h2>
              <button
                onClick={() => setShowDiplomaModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#ff4d4d', fontSize: '1.5rem', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>

            {/* Priekšskatījuma rāmis */}
            <div style={{
              margin: '15px auto',
              width: '100%',
              maxWidth: '550px',
              height: '350px',
              background: diplomaCfg.theme === 'GOLD_WHITE_PRINT' ? '#ffffff' : (diplomaCfg.bgColor || '#111111'),
              border: `10px solid ${diplomaCfg.borderColor || '#ffc107'}`,
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              color: diplomaCfg.theme === 'GOLD_WHITE_PRINT' ? '#111' : '#fff',
              textAlign: 'center',
              boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
              padding: '20px',
              boxSizing: 'border-box'
            }}>
              <h1 style={{ fontSize: '1.8rem', color: diplomaCfg.theme === 'GOLD_WHITE_PRINT' ? '#111' : (diplomaCfg.titleColor || '#fff'), margin: 0 }}>
                {diplomaCfg.customTitle || '🏆 DIPLOMS 🏆'}
              </h1>
              <h3 style={{ fontSize: '1.1rem', color: diplomaCfg.borderColor || '#ffc107', margin: '6px 0' }}>
                {diplomaCfg.customSubtitle || 'Par iegūto 1. vietu spēlē'}
              </h3>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: diplomaCfg.winnerColor || (diplomaCfg.theme === 'GOLD_WHITE_PRINT' ? '#007bff' : '#ffd700'), margin: '12px 0' }}>
                ČEMPIONU KOMANDA
              </div>
              <div style={{ fontSize: '1.1rem' }}>Iegūtie punkti: <strong>150 pt</strong></div>
              <div style={{ marginTop: '20px', fontSize: '0.8rem', color: '#888' }}>
                {diplomaCfg.footerText || 'Event Studio'} • Spēles PIN: 1234 • {new Date().toLocaleDateString('lv-LV')}
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <button
                onClick={() => setShowDiplomaModal(false)}
                style={{ padding: '8px 24px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Gatavs [✕]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📊 EXCEL / CSV IMPORTA DIALOGLOGS */}
      {showImportModal && (
        <div
          style={modalOverlayStyle}
          onClick={() => setShowImportModal(false)}
        >
          <div style={diplomaModalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
              <h2 style={{ margin: 0, color: '#00ff00' }}>📊 Jautājumu imports no Excel / CSV</h2>
              <button
                onClick={() => setShowImportModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#ff4d4d', fontSize: '1.5rem', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '0.85rem', color: '#ccc', lineHeight: 1.4, background: '#121212', padding: '10px', borderRadius: '8px', border: '1px solid #333' }}>
              <strong>💡 Kā sagatavot datus:</strong>
              <div>Excel tabulā kolonnas jākārto šādi: <code>Jautājums | Variants A | Variants B | Variants C | Variants D | Pareizā (A/B/C/D vai teksts) | [Laiks sek] | [Punkti]</code></div>
            </div>

            <textarea
              style={{
                width: '100%',
                minHeight: '120px',
                background: '#0a0a0a',
                border: '1px solid #444',
                color: '#fff',
                padding: '10px',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                boxSizing: 'border-box',
                resize: 'vertical'
              }}
              placeholder="Iekopē datus šeit no Excel..."
              value={importRawText}
              onChange={(e) => processImportText(e.target.value)}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #333', paddingTop: '10px' }}>
              <button
                onClick={() => setShowImportModal(false)}
                style={{ padding: '8px 18px', background: '#333', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Atcelt
              </button>
              <button
                onClick={executeImportToProject}
                disabled={importedQuestions.length === 0}
                style={{
                  padding: '8px 24px',
                  background: importedQuestions.length > 0 ? '#28a745' : '#555',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: importedQuestions.length > 0 ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold'
                }}
              >
                🚀 Importēt {importedQuestions.length > 0 ? `(${importedQuestions.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
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

const selectedBoxTop: React.CSSProperties = {
  background: '#1a2215',
  border: '2px solid #00ff00',
  padding: '10px',
  borderRadius: '8px',
  marginBottom: '10px',
  boxShadow: '0 0 15px rgba(0,255,0,0.25)'
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

const accordionCard: React.CSSProperties = {
  background: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: '8px',
  padding: '10px',
  marginBottom: '8px'
};

const accordionHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '0.85rem',
  color: '#00e5ff'
};

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  background: 'rgba(0,0,0,0.85)',
  backdropFilter: 'blur(12px)',
  zIndex: 99999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  boxSizing: 'border-box'
};

const diplomaModalCard: React.CSSProperties = {
  background: '#1a1a1a',
  border: '2px solid #d63384',
  borderRadius: '16px',
  padding: '25px',
  width: '800px',
  maxWidth: '95vw',
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.95)',
  color: '#fff',
  display: 'flex',
  flexDirection: 'column',
  gap: '15px'
};