import React, { useState, useEffect, useRef } from 'react';
import { BACKEND_URL, getAdminHeaders } from './config';
import { Slide, CanvasElement, MobileBranding, DiplomaConfig, ContactField } from './types';
import { getStudioFontSize, getOptionFontSize, hexToRgba } from './utils/formatting';

const MEDIA_BASE_URL = `${BACKEND_URL}/project-media`;

interface ImportedQuestionPreview {
  title: string;
  options: string[];
  correctAnswers: string[];
  duration: number;
  points: number;
  pointsMax: number;
  pointsMin: number;
  scoringMode: 'FIXED' | 'DECREASING';
  notes?: string;
  playerUIMode?: 'AUTO' | 'CLASSIC_GRID' | 'TEXT_CARDS' | 'MUSIC_DUAL';
}

const defaultContactFieldsList: ContactField[] = [
  { id: 'fullname', label: 'Vārds, Uzvārds', placeholder: 'Jānis Bērziņš', required: true, type: 'text' },
  { id: 'email', label: 'E-pasts', placeholder: 'janis@piemers.lv', required: true, type: 'email' },
  { id: 'phone', label: 'Tālrunis', placeholder: '+371 20000000', required: false, type: 'tel' },
  { id: 'company', label: 'Uzņēmums / Amats', placeholder: 'SIA Uzņēmums, Vadītājs', required: false, type: 'text' }
];

const DEFAULT_SECTION_ORDER = [
  'info',
  'options',
  'style',
  'media',
  'branding',
  'diploma',
  'contacts',
  'timer'
];

export default function Studio() {
  const [activeFolder, setActiveFolder] = useState<string>(
    localStorage.getItem('event_studio_folder') || ''
  );
  const [projectFile, setProjectFile] = useState('mans_quiz.json');
  const [availableProjects, setAvailableProjects] = useState<string[]>([]);
  const [mediaList, setMediaList] = useState<string[]>([]);
  const [mediaSearchQuery, setMediaSearchQuery] = useState('');
  const [isSnapToGrid, setIsSnapToGrid] = useState(true);
  const [showTopBarGuide, setShowTopBarGuide] = useState(true);

  // 📊 Excel / CSV Importa logs
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRawText, setImportRawText] = useState('');
  const [importedQuestions, setImportedQuestions] = useState<ImportedQuestionPreview[]>([]);
  const [importMode, setImportMode] = useState<'APPEND' | 'REPLACE'>('APPEND');

  // 🏆 Diplomu dizaina priekšskatījuma logs
  const [showDiplomaModal, setShowDiplomaModal] = useState(false);

  // 🌟 Jauna kontaktu lauka ievades stāvoklis
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'email' | 'tel'>('text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);

  // Akordeona sadaļu atvēršana / aizvēršana
  const [sections, setSections] = useState({
    branding: true,
    diploma: false,
    media: true,
    info: true,
    options: true,
    timer: true,
    contacts: true,
    style: true
  });

  // 🌟 PĀRVIETOJAMĀ SADAĻU SECĪBA
  const [sectionOrder, setSectionOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('event_studio_sidebar_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return [
            ...parsed.filter((k) => DEFAULT_SECTION_ORDER.includes(k)),
            ...DEFAULT_SECTION_ORDER.filter((k) => !parsed.includes(k))
          ];
        }
      }
    } catch {}
    return DEFAULT_SECTION_ORDER;
  });

  const moveSection = (key: string, direction: 'UP' | 'DOWN', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSectionOrder((prev) => {
      const idx = prev.indexOf(key);
      if (idx === -1) return prev;
      const targetIdx = direction === 'UP' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, moved);
      localStorage.setItem('event_studio_sidebar_order', JSON.stringify(copy));
      return copy;
    });
  };

  const handleSectionDragStart = (e: React.DragEvent, key: string) => {
    e.dataTransfer.setData('text/section-key', key);
  };

  const handleSectionDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    const draggedKey = e.dataTransfer.getData('text/section-key');
    if (!draggedKey || draggedKey === targetKey) return;
    setSectionOrder((prev) => {
      const fromIdx = prev.indexOf(draggedKey);
      const toIdx = prev.indexOf(targetKey);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      localStorage.setItem('event_studio_sidebar_order', JSON.stringify(copy));
      return copy;
    });
  };

  const toggleSection = (key: keyof typeof sections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // 🌟 BRANDING AR SĀKUMA EKRĀNA (LOBBY) FONU, TEKSTIEM UN INTENSITĀTI
  const [mobileBranding, setMobileBranding] = useState<MobileBranding & {
    presentationTheme?: 'NEON' | 'TV_SHOW' | 'ARENA' | 'MINIMAL';
    lobbyBgImage?: string;
    lobbyBgColor?: string;
    lobbyTitleText?: string;
    lobbySubtitleText?: string;
    lobbyQrTitle?: string;
    lobbyQrSubtitle?: string;
    lobbyTitleColor?: string;
    lobbySubtitleColor?: string;
    lobbyBoxBgColor?: string;
    lobbyBoxBgOpacity?: number;
    lobbyBoxBorderColor?: string;
  }>({
    appTitle: 'EVENT BUZZER',
    appLogo: '',
    appBgImage: '',
    welcomeImage: '',
    appBgColor: '#121212',
    lobbyMode: 'INTERACTIVE_DOTS',
    optionsRevealTiming: 'ON_ACTIVE',
    presentationTheme: 'TV_SHOW',
    timerMode: 'ALL_VOTED',
    teamModeEnabled: false,
    teamScoringMode: 'AVG',
    predefinedTeams: ['1. Galdiņš', '2. Galdiņš', '3. Galdiņš', 'VIP Komanda'],
    maxMissedQuestions: 5,
    gameLogoPosition: 'NONE',
    lobbyBgImage: '',
    lobbyBgColor: '#0a0a0a',
    lobbyTitleText: '🎮 PIESLĒGUŠIES DALĪBNIEKI ({count}):',
    lobbySubtitleText: 'Spiediet telefonā "Pārbaudīt pulti", lai bumbiņa pulsētu! 💥',
    lobbyQrTitle: 'Skenē kamerā!',
    lobbyQrSubtitle: 'Pieslēdzies spēlei',
    lobbyTitleColor: '#ffc107',
    lobbySubtitleColor: '#aaaaaa',
    lobbyBoxBgColor: '#000000',
    lobbyBoxBgOpacity: 85,
    lobbyBoxBorderColor: '#00ff00',
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
      logoPosition: 'TOP',
      showTitle: true,
      showSubtitle: true,
      showWinner: true,
      showScore: true,
      showFooter: true
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
        allowOptionTranslation: false,
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
        contactFields: defaultContactFieldsList,
        contactsTitle: 'DALĪBNIEKU ANKETA',
        contactsDescription: 'Lūdzu, ievadiet savus datus. Šī informācija netiks rādīta uz lielā ekrāna.',
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
            borderRadius: 16,
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

  const slidesRef = useRef<Slide[]>(slides);
  useEffect(() => {
    slidesRef.current = slides;
  }, [slides]);

  const [dragState, setDragState] = useState<{
    mode: 'MOVE' | 'RESIZE_RIGHT' | 'RESIZE_LEFT';
    primaryId: string;
    startX: number;
    startY: number;
    elementsSnapshot: { id: string; target: 'LAYOUT' | 'OPTION'; origX: number; origY: number; origW: number; origH: number }[];
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const previewMediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const sidebarRightRef = useRef<HTMLDivElement | null>(null);

  const activeSlide = slides[activeSlideIdx] || slides[0];

  useEffect(() => {
    if (selectedElementIds.length > 0 && sidebarRightRef.current) {
      sidebarRightRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedElementIds]);

  const selectedElements = (activeSlide?.config?.layout || []).filter((el) =>
    selectedElementIds.includes(el.id)
  );
  const primarySelectedElement = selectedElements[selectedElements.length - 1] || null;

  const selectedOptionId = selectedElementIds.find((id) => id.startsWith('opt-index-'));
  const selectedOptionIdx = selectedOptionId !== undefined ? Number(selectedOptionId.replace('opt-index-', '')) : null;

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

  const updateActiveSlide = (updater: (draft: Slide) => void, recordHistory: boolean = true) => {
    setSlides((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      if (!copy[activeSlideIdx]) return prev;
      updater(copy[activeSlideIdx]);
      if (recordHistory) {
        pushToHistory(copy);
      }
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
    }, true);
  };

  const deleteSelectedElements = () => {
    if (selectedElementIds.length === 0) return;
    updateActiveSlide((s) => {
      s.config.layout = s.config.layout.filter((x) => !selectedElementIds.includes(x.id));
    }, true);
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
    }, true);
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
    }, true);
  };

  const sendSelectedToBack = () => {
    if (selectedElementIds.length === 0) return;
    updateActiveSlide((s) => {
      const selected = s.config.layout.filter((el) => selectedElementIds.includes(el.id));
      const unselected = s.config.layout.filter((el) => !selectedElementIds.includes(el.id));
      s.config.layout = [...selected, ...unselected];
    }, true);
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

  const parsePointsString = (val?: string) => {
    if (!val) {
      return { scoringMode: 'FIXED' as const, points: 10, pointsMax: 10, pointsMin: 1 };
    }
    const raw = String(val).trim().toLowerCase();
    const rangeMatch = raw.match(/(\d+)\s*[-–—/.]+\s*(\d+)/);
    if (rangeMatch) {
      const num1 = Number(rangeMatch[1]);
      const num2 = Number(rangeMatch[2]);
      return {
        scoringMode: 'DECREASING' as const,
        points: Math.max(num1, num2),
        pointsMax: Math.max(num1, num2),
        pointsMin: Math.min(num1, num2)
      };
    }
    const numMatch = raw.match(/\d+/);
    const pts = numMatch ? Number(numMatch[0]) : 10;
    return {
      scoringMode: 'FIXED' as const,
      points: pts,
      pointsMax: pts,
      pointsMin: 1
    };
  };

  const parseDelimitedText = (text: string): string[][] => {
    const lines = text.trim().split(/\r\n|\n|\r/);
    return lines.map((line) => {
      const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === delimiter && !inQuotes) {
          result.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else current += char;
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
      firstRowStr.includes('pareizā');

    const dataRows = hasHeader ? rows.slice(1) : rows;
    const parsed: ImportedQuestionPreview[] = [];

    dataRows.forEach((cols) => {
      if (cols.length < 2 || !cols[0] || cols[0].trim() === '') return;
      const title = cols[0].trim();
      let rawOptions: string[] = [cols[1], cols[2], cols[3], cols[4]].filter(Boolean);
      let correctIndicator = cols[5] ? cols[5].trim() : 'A';
      let duration = cols[6] && !isNaN(Number(cols[6])) ? Number(cols[6]) : 30;
      let pointsInfo = cols[7] ? parsePointsString(cols[7]) : { scoringMode: 'FIXED' as const, points: 10, pointsMax: 10, pointsMin: 1 };
      let notes = cols[8] ? cols[8].trim() : '';

      let correctAnswers: string[] = [];
      const letterMatch = correctIndicator.toUpperCase().match(/^[A-F]$/);
      if (letterMatch) {
        const letterIdx = letterMatch[0].charCodeAt(0) - 65;
        correctAnswers = rawOptions[letterIdx] ? [rawOptions[letterIdx]] : [letterMatch[0]];
      } else {
        correctAnswers = [correctIndicator];
      }

      parsed.push({
        title,
        options: rawOptions.length > 0 ? rawOptions : ['A', 'B', 'C', 'D'],
        correctAnswers,
        duration,
        points: pointsInfo.points,
        pointsMax: pointsInfo.pointsMax,
        pointsMin: pointsInfo.pointsMin,
        scoringMode: pointsInfo.scoringMode,
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
      if (content) processImportText(content);
    };
    reader.readAsText(file, 'utf-8');
  };

  const executeImportToProject = () => {
    if (importedQuestions.length === 0) return alert('Nav atrasts neviens jautājums ko importēt!');

    const generatedSlides: Slide[] = importedQuestions.map((q, idx) => {
      const correctnessMap: Record<string, number> = {};
      q.correctAnswers.forEach((ans) => { correctnessMap[ans] = 100; });

      return {
        id: `slide-${Date.now()}-${idx}`,
        title: `${idx + 1}. ${q.title.slice(0, 24)}...`,
        type: 'QUESTION',
        config: {
          duration: q.duration || 30,
          points: q.points || q.pointsMax || 10,
          pointsMin: q.pointsMin ?? (q.scoringMode === 'DECREASING' ? 1 : (q.points || 10)),
          pointsMax: q.pointsMax || q.points || 10,
          scoringMode: q.scoringMode || 'FIXED',
          speedBonusEnabled: false,
          selectionMode: 'ALL',
          requiredCount: q.correctAnswers.length || 1,
          submitMode: 'INSTANT',
          autoStart: false,
          allowOptionTranslation: false,
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
          contactFields: defaultContactFieldsList,
          contactsTitle: 'DALĪBNIEKU ANKETA',
          contactsDescription: 'Lūdzu, ievadiet savus datus. Šī informācija netiks rādīta uz lielā ekrāna.',
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
              borderRadius: 16,
              bold: true,
              visibility: 'ALWAYS'
            }
          ]
        }
      };
    });

    const newSlideList = importMode === 'REPLACE' ? generatedSlides : [...slides, ...generatedSlides];
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

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedElementIds.length > 0) {
        e.preventDefault();
        const step = e.shiftKey ? 2 : 0.5;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;

        updateActiveSlide((s) => {
          if (!s.config.optionsPositions) s.config.optionsPositions = {};
          selectedElementIds.forEach((id) => {
            if (id.startsWith('opt-index-')) {
              const optIdx = Number(id.replace('opt-index-', ''));
              const cur = s.config.optionsPositions[optIdx] || { x: 10, y: 58, w: 38, h: 10 };
              s.config.optionsPositions[optIdx] = {
                ...cur,
                x: Math.max(0, Math.min(95, Number((cur.x + dx).toFixed(2)))),
                y: Math.max(0, Math.min(95, Number((cur.y + dy).toFixed(2))))
              };
            } else {
              const el = s.config.layout.find((x) => x.id === id);
              if (el) {
                el.x = Math.max(0, Math.min(95, Number((el.x + dx).toFixed(2))));
                el.y = Math.max(0, Math.min(95, Number((el.y + dy).toFixed(2))));
              }
            }
          });
        }, true);
        return;
      }

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
            .map((idx) => JSON.parse(JSON.stringify(slidesRef.current[idx])));
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
            return cloned;
          });

          const updated = [...slidesRef.current];
          updated.splice(insertIdx, 0, ...newPasted);
          setSlides(updated);
          pushToHistory(updated);
          setSelectedSlideIndices(newPasted.map((_, i) => insertIdx + i));
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
  }, [historyIdx, history, activeSlideIdx, selectedSlideIndices, copiedSlides, selectedElementIds, projectFile, availableProjects, mobileBranding]);

  const syncWorkingFolder = async (folderToSet?: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/set-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify({ path: folderToSet || activeFolder })
      });
      const data = await res.json();
      if (data.success) {
        setActiveFolder(data.currentPath);
        localStorage.setItem('event_studio_folder', data.currentPath);
        if (Array.isArray(data.projects)) setAvailableProjects(data.projects);
        if (Array.isArray(data.media)) setMediaList(data.media);
      }
    } catch {}
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
        allowOptionTranslation: false,
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
        contactFields: defaultContactFieldsList,
        contactsTitle: 'DALĪBNIEKU ANKETA',
        contactsDescription: 'Lūdzu, ievadiet savus datus. Šī informācija netiks rādīta uz lielā ekrāna.',
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
            borderRadius: 16,
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

  const handleElementMouseDown = (
    e: React.MouseEvent,
    mode: 'MOVE' | 'RESIZE_RIGHT' | 'RESIZE_LEFT',
    id: string
  ) => {
    if (editingElementId === id) return;
    e.stopPropagation();

    let newSelection = [...selectedElementIds];
    if (e.ctrlKey || e.metaKey) {
      if (newSelection.includes(id)) {
        newSelection = newSelection.filter((item) => item !== id);
      } else {
        newSelection.push(id);
      }
    } else {
      if (!newSelection.includes(id)) {
        newSelection = [id];
      }
    }
    setSelectedElementIds(newSelection);

    if (!newSelection.includes(id)) return;

    const snapshot: { id: string; target: 'LAYOUT' | 'OPTION'; origX: number; origY: number; origW: number; origH: number }[] = [];

    newSelection.forEach((selectedId) => {
      if (selectedId.startsWith('opt-index-')) {
        const idx = Number(selectedId.replace('opt-index-', ''));
        const totalOpt = activeSlide.config.options?.length || 4;
        const pos = activeSlide.config.optionsPositions?.[idx] || {
          x: 10 + (idx % 2) * 42,
          y: totalOpt > 4 ? 52 + Math.floor(idx / 2) * 12 : 58 + Math.floor(idx / 2) * 13,
          w: 38,
          h: totalOpt > 4 ? 9 : 10
        };
        snapshot.push({ id: selectedId, target: 'OPTION', origX: pos.x, origY: pos.y, origW: pos.w, origH: pos.h });
      } else {
        const el = activeSlide.config.layout.find((x) => x.id === selectedId);
        if (el) snapshot.push({ id: el.id, target: 'LAYOUT', origX: el.x, origY: el.y, origW: el.w, origH: el.h });
      }
    });

    setDragState({
      mode,
      primaryId: id,
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
          newX = Math.max(0, Math.min(newX, 95));
          newY = Math.max(0, Math.min(newY, 95));

          if (item.target === 'LAYOUT') {
            const el = s.config.layout.find((x) => x.id === item.id);
            if (el) {
              el.x = newX;
              el.y = newY;
            }
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
          newW = Math.max(4, Math.min(newW, 100));
          newH = Math.max(3, Math.min(newH, 100));

          if (item.target === 'LAYOUT') {
            const el = s.config.layout.find((x) => x.id === item.id);
            if (el) {
              el.w = newW;
              el.h = newH;
            }
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
          newW = Math.max(4, Math.min(newW, 100));
          newH = Math.max(3, Math.min(newH, 100));
          newX = Math.max(0, Math.min(newX, 95));

          if (item.target === 'LAYOUT') {
            const el = s.config.layout.find((x) => x.id === item.id);
            if (el) {
              el.x = newX;
              el.w = newW;
              el.h = newH;
            }
          } else if (optionIdx !== null) {
            const curPos = s.config.optionsPositions[optionIdx] || { x: 10, y: 58, w: 38, h: 10 };
            s.config.optionsPositions[optionIdx] = { ...curPos, x: newX, w: newW, h: newH };
          }
        }
      });
    }, false);
  };

  const handleMouseUp = () => {
    if (dragState) pushToHistory(slidesRef.current);

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
      uploadAndAddMedia(e.dataTransfer.files[0]);
    }
  };

  const addMediaElement = (fileName: string) => {
    const isVideo = /\.(mp4|mov|webm)$/i.test(fileName);
    const isAudio = /\.(mp3|wav|ogg)$/i.test(fileName);
    const isCurrentBillboard = activeSlide?.type === 'BILLBOARD';

    const newElement: CanvasElement = {
      id: `media-${Date.now()}`,
      type: isVideo ? 'VIDEO' : isAudio ? 'AUDIO' : 'IMAGE',
      content: fileName,
      x: 25,
      y: 20,
      w: 50,
      h: isAudio ? 12 : 50,
      volume: 100,
      trimStart: 0,
      trimEnd: 30,
      loop: false,
      isTrimEndCustom: false,
      visibility: isCurrentBillboard ? 'ALWAYS' : 'DURING_QUESTION',
      blurMode: 'NONE',
      blurAmount: 12,
      fitMode: 'COVER',
      borderRadius: 16
    };

    updateActiveSlide((s) => s.config.layout.push(newElement), true);
    setSelectedElementIds([newElement.id]);
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

  const handleAddContactField = () => {
    if (!newFieldLabel.trim()) return;
    const newField: ContactField = {
      id: `field_${Date.now()}`,
      label: newFieldLabel.trim(),
      placeholder: newFieldPlaceholder.trim(),
      type: newFieldType,
      required: newFieldRequired
    };

    updateActiveSlide((s) => {
      const current = s.config.contactFields || defaultContactFieldsList;
      s.config.contactFields = [...current, newField];
    }, true);

    setNewFieldLabel('');
    setNewFieldPlaceholder('');
    setNewFieldRequired(false);
  };

  const handleRemoveContactField = (idToRemove: string) => {
    updateActiveSlide((s) => {
      const current = s.config.contactFields || defaultContactFieldsList;
      s.config.contactFields = current.filter((f) => f.id !== idToRemove);
    }, true);
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
    }, true);
  };

  const addOrderingItem = () => {
    if (!newOrderingItemInput.trim()) return;
    const opts = [...(activeSlide.config.options || []), newOrderingItemInput.trim()];
    updateActiveSlide((s) => {
      s.config.options = opts;
      s.config.correctOrder = opts;
      s.config.optionsCount = opts.length;
    }, true);
    setNewOrderingItemInput('');
  };

  const removeOrderingItem = (index: number) => {
    const opts = (activeSlide.config.options || []).filter((_, idx) => idx !== index);
    updateActiveSlide((s) => {
      s.config.options = opts;
      s.config.correctOrder = opts;
      s.config.optionsCount = opts.length;
    }, true);
  };

  const hasMultipleSelection = selectedElements.length > 1;
  const filteredMediaList = mediaList.filter((m) =>
    m.toLowerCase().includes(mediaSearchQuery.toLowerCase())
  );

  const diplomaCfg: DiplomaConfig = mobileBranding.diplomaConfig || {};

  const getCanvasPreviewBg = () => {
    if (activeSlide?.config?.backgroundUrl) {
      return `url(${MEDIA_BASE_URL}/${activeSlide.config.backgroundUrl})`;
    }
    const theme = (mobileBranding as any).presentationTheme || 'TV_SHOW';
    if (theme === 'TV_SHOW') return 'radial-gradient(ellipse at 50% 30%, #0d1b33 0%, #030712 100%)';
    if (theme === 'ARENA') return 'linear-gradient(135deg, #120207 0%, #050505 60%, #150009 100%)';
    if (theme === 'MINIMAL') return 'linear-gradient(180deg, #18181b 0%, #09090b 100%)';
    return '#181818';
  };

  const getObjectFitCss = (mode?: 'CONTAIN' | 'COVER' | 'FILL'): React.CSSProperties['objectFit'] => {
    if (mode === 'FILL') return 'fill';
    if (mode === 'CONTAIN') return 'contain';
    return 'cover';
  };

  return (
    <div style={studioLayout} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      {/* 1. AUGŠĒJĀ RIBBON JOSLA */}
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
                      allowOptionTranslation: false,
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
                      contactFields: defaultContactFieldsList,
                      contactsTitle: 'DALĪBNIEKU ANKETA',
                      contactsDescription: 'Lūdzu, ievadiet savus datus. Šī informācija netiks rādīta uz lielā ekrāna.',
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

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
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
                borderRadius: 12,
                bold: true,
                visibility: 'ALWAYS'
              };
              updateActiveSlide((s) => s.config.layout.push(newText), true);
              setSelectedElementIds([newText.id]);
            }}
          >
            🔤 Pievienot tekstu
          </button>

          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', color: '#ccc', cursor: 'pointer' }}>
            <input type="checkbox" checked={isSnapToGrid} onChange={(e) => setIsSnapToGrid(e.target.checked)} />
            Snap Grid
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', color: '#00e5ff', cursor: 'pointer' }} title="Rādīt TopBar zonu uz kanvas">
            <input type="checkbox" checked={showTopBarGuide} onChange={(e) => setShowTopBarGuide(e.target.checked)} />
            TopBar gids
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

      {/* 3. GALVENĀ DARBA ZONA */}
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
                      {s.type === 'CONTACTS' && <span title="Dalībnieku anketa" style={{ color: '#00e5ff', marginRight: '4px' }}>📋</span>}
                      {s.config?.playerUIMode === 'MUSIC_DUAL' && <span title="Muzikālā spēle" style={{ color: '#ff007f', marginRight: '4px' }}>🎵</span>}
                      {s.type === 'BILLBOARD' && <span title="Informatīvais ekrāns" style={{ color: '#28a745', marginRight: '4px' }}>📢</span>}
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
              background: getCanvasPreviewBg(),
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
            {/* 🌟 15.55% precīzi atbilst prezentācijas 84px augšējai joslai 16:9 proporcijā */}
            {showTopBarGuide && activeSlide?.type !== 'BILLBOARD' && activeSlide?.type !== 'LEADERBOARD' && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '15.55%',
                  background: 'rgba(0, 123, 255, 0.08)',
                  borderBottom: '1.5px dashed rgba(0, 229, 255, 0.45)',
                  pointerEvents: 'none',
                  zIndex: 90,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: '15px',
                  color: 'rgba(0, 229, 255, 0.75)',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  letterSpacing: '1px'
                }}
              >
                📌 TOPBAR ZONA EKRĀNĀ (PIN, Pulkstenis, Punkti)
              </div>
            )}

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
              const isMediaBox = el.type === 'IMAGE' || el.type === 'VIDEO';

              const objFit = getObjectFitCss(el.fitMode);
              const bRadius = `${el.borderRadius !== undefined ? el.borderRadius : (isMediaBox ? 16 : 12)}px`;

              return (
                <div
                  key={el.id}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.dataset.role === 'resize-handle') return;
                    handleElementMouseDown(e, 'MOVE', el.id);
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
                    height: isMediaBox ? `${el.h}%` : 'auto',
                    minHeight: `${el.h}%`,
                    border: isSelected ? '2.5px dashed #00ff00' : 'none',
                    boxShadow: isSelected ? '0 0 15px rgba(0,255,0,0.5)' : 'none',
                    cursor: isEditing ? 'text' : 'move',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: el.type === 'QUESTION' || el.type === 'TEXT' ? bgRgba : 'transparent',
                    backdropFilter: el.type === 'QUESTION' || el.type === 'TEXT' ? 'blur(8px)' : 'none',
                    borderRadius: bRadius,
                    padding: el.type === 'QUESTION' ? '12px 18px' : el.type === 'TEXT' ? '8px 12px' : '0',
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
                          }, true);
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
                      src={`${MEDIA_BASE_URL}/${encodeURIComponent(el.content).replace(/%2F/g, '/')}`}
                      alt="img"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: objFit,
                        borderRadius: bRadius,
                        pointerEvents: 'none',
                        filter: blurVal !== 'none' ? `blur(${blurVal})` : 'none',
                        transition: 'filter 0.3s ease',
                        display: 'block'
                      }}
                    />
                  ) : el.type === 'VIDEO' ? (
                    <video
                      ref={(r) => {
                        if (isSelected) previewMediaRef.current = r;
                      }}
                      src={`${MEDIA_BASE_URL}/${encodeURIComponent(el.content).replace(/%2F/g, '/')}`}
                      loop={!!el.loop}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: objFit,
                        borderRadius: bRadius,
                        pointerEvents: 'none',
                        filter: blurVal !== 'none' ? `blur(${blurVal})` : 'none',
                        transition: 'filter 0.3s ease',
                        display: 'block'
                      }}
                    />
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <audio
                        ref={(r) => {
                          if (isSelected) previewMediaRef.current = r;
                        }}
                        src={`${MEDIA_BASE_URL}/${encodeURIComponent(el.content).replace(/%2F/g, '/')}`}
                        loop={!!el.loop}
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
                        handleElementMouseDown(e, 'RESIZE_RIGHT', el.id);
                      }}
                      style={resizeHandleRight}
                      title="Mainīt izmēru (Turi Shift, lai saglabātu proporcijas)"
                    />
                  )}
                </div>
              );
            })}

            {/* KONTAKTI ANKETA */}
            {activeSlide?.type === 'CONTACTS' && (
              <div
                style={{
                  position: 'absolute',
                  left: '12%',
                  top: '18%',
                  width: '76%',
                  background: 'rgba(10, 15, 25, 0.94)',
                  border: '2px solid #00e5ff',
                  borderRadius: '16px',
                  padding: '20px 25px',
                  textAlign: 'center',
                  boxShadow: '0 10px 40px rgba(0, 229, 255, 0.25)',
                  zIndex: 15,
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '4px' }}>📋</div>
                <div style={{ fontSize: '1.4rem', color: '#00e5ff', fontWeight: '900', letterSpacing: '1px' }}>
                  {activeSlide.config.contactsTitle || 'DALĪBNIEKU ANKETA'}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#ccc', marginTop: '4px', marginBottom: '14px' }}>
                  {activeSlide.config.contactsDescription || 'Lūdzu, atveriet savu tālruni un aizpildiet dalībnieka anketu!'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', textAlign: 'left' }}>
                  {((activeSlide.config.contactFields && activeSlide.config.contactFields.length > 0)
                    ? activeSlide.config.contactFields
                    : defaultContactFieldsList).map((f) => (
                    <div key={f.id} style={{ background: '#181818', border: '1px solid #333', padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem' }}>
                      <span style={{ color: '#ffc107', fontWeight: 'bold' }}>{f.label}</span> {f.required && <span style={{ color: '#ff4d4d' }}>*</span>}
                      <div style={{ color: '#777', fontSize: '0.72rem', marginTop: '2px' }}>
                        Tips: {f.type || 'text'} {f.placeholder && `| Piemērs: "${f.placeholder}"`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAIMERIS */}
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

            {/* ĀTRĀ PULTS */}
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

            {/* SECĪBAS KĀRTOŠANA */}
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

            {/* ATBILŽU POGAS — 🌟 100% SAKRĪT AR PREZENTĀCIJAS VIZUĀLO STILU */}
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

                // 🌟 Studijas atbilžu fona krāsa tagad sakrīt ar prezentācijas sapludināšanas efektu:
                const cardBg = isZeroOpacity || isOnlyLetter
                  ? 'transparent'
                  : isCorrect
                  ? `linear-gradient(135deg, ${hexToRgba(optCorrectColor, 65)}, ${hexToRgba(optBg, Math.min(100, optOpacity + 10))})`
                  : hexToRgba(optBg, optOpacity);

                return (
                  <div
                    key={`opt-box-${i}`}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.dataset.role === 'resize-handle' || target.tagName === 'INPUT') return;
                      if (isIndividual) handleElementMouseDown(e, 'MOVE', optionId);
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
                      background: cardBg,
                      backdropFilter: isZeroOpacity || isOnlyLetter ? 'none' : 'blur(6px)',
                      boxShadow: isZeroOpacity || isOnlyLetter
                        ? 'none'
                        : isCorrect
                        ? `0 0 15px ${optCorrectColor}, 0 4px 15px rgba(0,0,0,0.5)`
                        : '0 4px 15px rgba(0,0,0,0.5)',
                      border: isSelected
                        ? '2.5px dashed #ffc107'
                        : isCorrect
                        ? `2.5px solid ${optCorrectColor}`
                        : isMusicTop
                        ? '2px solid #00e5ff'
                        : isMusicBottom
                        ? '2px solid #ff007f'
                        : '1px solid rgba(255,255,255,0.15)',
                      borderRadius: isOnlyLetter && !isEditing ? '50%' : '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isOnlyLetter && !isEditing ? 'center' : 'space-between',
                      padding: isOnlyLetter && !isEditing ? '0' : isZeroOpacity ? '0 6px' : '0 12px',
                      boxSizing: 'border-box',
                      cursor: isIndividual ? 'move' : 'default',
                      zIndex: isSelected ? 20 : 10,
                      overflow: 'visible'
                    }}
                  >
                    {isIndividual && isSelected && (
                      <div
                        data-role="resize-handle"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleElementMouseDown(e, 'RESIZE_LEFT', optionId);
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
                          }, true);
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
                            color: isCorrect ? '#ffffff' : optColor,
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
                            }, true);
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
                                }, true);
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
                          handleElementMouseDown(e, 'RESIZE_RIGHT', optionId);
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

        {/* 🌟 2. DAĻAS SĀKUMS: LABĀ PUSE, MODĀLIE LOGI & STILI */}
        <div ref={sidebarRightRef} style={sidebarRight}>
          {/* 🌟 1. ATLASĪTO KANVAS ELEMENTU KOPĪGAIS INSPEKTORS */}
          {selectedElements.length > 0 && primarySelectedElement && (
            <div style={selectedBoxTop}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', color: '#00ff00', fontSize: '0.85rem' }}>
                  {hasMultipleSelection ? `👥 ATLASĪTI: ${selectedElements.length} ELEMENTI` : `🔍 IZVĒLĒTS: ${primarySelectedElement.type}`}
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

              {/* TEKSTA & JAUTĀJUMA KRĀSAS, FONTI, FONA INTENSITĀTE UN NOAPAĻOJUMS */}
              {selectedElements.some((el) => el.type === 'QUESTION' || el.type === 'TEXT') && (
                <div style={{ borderTop: '1px solid #444', paddingTop: '8px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                    <select
                      style={{ ...selectStyle, flex: 1.4, margin: 0 }}
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

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.78rem', color: '#aaa' }}>Teksts:</span>
                      <input
                        type="color"
                        value={primarySelectedElement.color || '#ffffff'}
                        onChange={(e) => updateSelectedElements((el) => { el.color = e.target.value; })}
                        style={colorPicker}
                        title="Mainīt teksta krāsu"
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.78rem', color: '#aaa' }}>Fons:</span>
                      <input
                        type="color"
                        value={primarySelectedElement.bgColor || '#000000'}
                        onChange={(e) => updateSelectedElements((el) => { el.bgColor = e.target.value; })}
                        style={colorPicker}
                        title="Mainīt fona krāsu"
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Loga fona intensitāte:</span>
                      <span style={{ fontSize: '0.8rem', color: '#00ff00', fontWeight: 'bold' }}>
                        {primarySelectedElement.bgOpacity ?? 85}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={primarySelectedElement.bgOpacity ?? 85}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateSelectedElements((el) => { el.bgOpacity = val; });
                      }}
                      style={{ width: '100%', accentColor: '#00ff00', cursor: 'pointer' }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Malu noapaļojums:</span>
                      <span style={{ fontSize: '0.8rem', color: '#00e5ff', fontWeight: 'bold' }}>
                        {primarySelectedElement.borderRadius ?? 16}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="40"
                      step="2"
                      value={primarySelectedElement.borderRadius ?? 16}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateSelectedElements((el) => { el.borderRadius = val; });
                      }}
                      style={{ width: '100%', accentColor: '#00e5ff', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              )}

              {/* Mediju aizpildījums & noapaļojums */}
              {selectedElements.some((el) => el.type === 'IMAGE' || el.type === 'VIDEO') && (
                <div style={{ borderTop: '1px solid #444', paddingTop: '6px', marginBottom: '8px' }}>
                  <label style={labelStyle}>Mediju aizpildījums (Fit Mode):</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() => updateSelectedElements((el) => { el.fitMode = 'COVER'; })}
                      style={{
                        padding: '6px 2px',
                        color: '#fff',
                        fontSize: '0.72rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        background: (primarySelectedElement.fitMode || 'COVER') === 'COVER' ? '#007bff' : '#222',
                        border: (primarySelectedElement.fitMode || 'COVER') === 'COVER' ? '1.5px solid #00e5ff' : '1px solid #444'
                      }}
                    >
                      🖼️ Cover
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedElements((el) => { el.fitMode = 'FILL'; })}
                      style={{
                        padding: '6px 2px',
                        color: '#fff',
                        fontSize: '0.72rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        background: primarySelectedElement.fitMode === 'FILL' ? '#007bff' : '#222',
                        border: primarySelectedElement.fitMode === 'FILL' ? '1.5px solid #00e5ff' : '1px solid #444'
                      }}
                    >
                      🔲 Iestiept
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedElements((el) => { el.fitMode = 'CONTAIN'; })}
                      style={{
                        padding: '6px 2px',
                        color: '#fff',
                        fontSize: '0.72rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        background: primarySelectedElement.fitMode === 'CONTAIN' ? '#007bff' : '#222',
                        border: primarySelectedElement.fitMode === 'CONTAIN' ? '1.5px solid #00e5ff' : '1px solid #444'
                      }}
                    >
                      🔍 Ar malām
                    </button>
                  </div>

                  <div style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Malu noapaļojums:</span>
                      <span style={{ fontSize: '0.8rem', color: '#00e5ff', fontWeight: 'bold' }}>
                        {primarySelectedElement.borderRadius !== undefined ? primarySelectedElement.borderRadius : 16}px
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="range"
                        min="0"
                        max="60"
                        step="2"
                        value={primarySelectedElement.borderRadius !== undefined ? primarySelectedElement.borderRadius : 16}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateSelectedElements((el) => { el.borderRadius = val; });
                        }}
                        style={{ flex: 1, accentColor: '#00e5ff', cursor: 'pointer' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 🌟 2. ATLASĪTĀ ATBILDES VARIANTA ĀTRAIS INSPEKTORS (AR ĀTRAJĀM KRĀSU POGĀM) */}
          {selectedOptionIdx !== null && activeSlide?.config?.options?.[selectedOptionIdx] !== undefined && (
            <div style={{ ...selectedBoxTop, border: '2px solid #ffc107', background: '#1c1c14' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 'bold', color: '#ffc107', fontSize: '0.85rem' }}>
                  🎯 ATLASĪTS VARIANTS: {String.fromCharCode(65 + selectedOptionIdx)}
                </span>
                <button onClick={() => setSelectedElementIds([])} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
              </div>

              <label style={labelStyle}>Varianta teksts:</label>
              <input
                style={{ ...inputStyle, marginBottom: '8px', color: '#ffc107', fontWeight: 'bold' }}
                value={activeSlide.config.options[selectedOptionIdx] || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  updateActiveSlide((s) => {
                    const oldVal = s.config.options[selectedOptionIdx];
                    const letter = String.fromCharCode(65 + selectedOptionIdx);
                    const oldKey = (oldVal && oldVal.trim() !== '') ? oldVal : letter;
                    s.config.options[selectedOptionIdx] = val;
                    const newKey = (val && val.trim() !== '') ? val : letter;

                    s.config.correctAnswers = s.config.correctAnswers.map((a) => (a === oldKey || a === oldVal ? newKey : a));
                    if (s.config.answerCorrectness && s.config.answerCorrectness[oldKey]) {
                      s.config.answerCorrectness[newKey] = s.config.answerCorrectness[oldKey];
                      if (oldKey !== newKey) delete s.config.answerCorrectness[oldKey];
                    }
                  }, true);
                }}
              />

              {/* Ātrās atbilžu lodziņu krāsas tieši no varianta inspektora */}
              <div style={{ borderTop: '1px solid #333', paddingTop: '6px', marginTop: '6px' }}>
                <span style={{ fontSize: '0.72rem', color: '#888', display: 'block', marginBottom: '4px' }}>Ātrā atbilžu stila maiņa:</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Fons:</span>
                    <input
                      type="color"
                      value={activeSlide.config.optionsBgColor || '#000000'}
                      onChange={(e) => updateActiveSlide((s) => (s.config.optionsBgColor = e.target.value), true)}
                      style={colorPicker}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Teksts:</span>
                    <input
                      type="color"
                      value={activeSlide.config.optionsColor || '#ffffff'}
                      onChange={(e) => updateActiveSlide((s) => (s.config.optionsColor = e.target.value), true)}
                      style={colorPicker}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#00ff00', fontWeight: 'bold' }}>Pareizā:</span>
                    <input
                      type="color"
                      value={activeSlide.config.optionsCorrectColor || '#00ff00'}
                      onChange={(e) => updateActiveSlide((s) => (s.config.optionsCorrectColor = e.target.value), true)}
                      style={colorPicker}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 🌟 3. PĀRVIETOJAMIE SADAĻU LOGI */}
          {sectionOrder.map((secKey) => {
            // INFO
            if (secKey === 'info') {
              return (
                <div key="info" draggable onDragStart={(e) => handleSectionDragStart(e, 'info')} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleSectionDrop(e, 'info')} style={accordionCard}>
                  <div style={accordionHeader} onClick={() => toggleSection('info')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={dragHandleGrip} title="Pārvelc, lai mainītu secību">⋮⋮</span>
                      📋 SLAIDA TIPS & PIEZĪMES
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button onClick={(e) => moveSection('info', 'UP', e)} style={btnReorderSmall}>▲</button>
                      <button onClick={(e) => moveSection('info', 'DOWN', e)} style={btnReorderSmall}>▼</button>
                      <span>{sections.info ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {sections.info && (
                    <div style={{ marginTop: '10px' }}>
                      <label style={labelStyle}>Slaida tips:</label>
                      <select style={selectStyle} value={activeSlide.type} onChange={(e) => updateActiveSlide((s) => { s.type = e.target.value as any; }, true)}>
                        <option value="QUESTION">Question (Jautājums)</option>
                        <option value="CONTACTS">📋 Contacts (Anketa)</option>
                        <option value="BILLBOARD">📢 Billboard (Informatīvs ekrāns)</option>
                        <option value="TIMER">⏱️ Timer (Taimeris)</option>
                        <option value="BUZZER_RACE">⚡ Buzzer Race (Ātrā pults)</option>
                        <option value="ORDERING">🔢 Ordering (Secība)</option>
                        <option value="LEADERBOARD">🏆 Leaderboard (Līderu tabula)</option>
                      </select>

                      <div style={{ background: '#1c2833', border: '1px solid #00e5ff', borderRadius: '6px', padding: '8px', margin: '8px 0' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#00e5ff', fontSize: '0.85rem', cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!activeSlide.config.autoStart} onChange={(e) => updateActiveSlide((s) => (s.config.autoStart = e.target.checked), true)} />
                          ⚡ Automātiskais starts (Auto-Start)
                        </label>
                      </div>

                      <label style={labelStyle}>📝 Vadītāja piezīmes:</label>
                      <textarea style={{ ...inputStyle, minHeight: '50px' }} value={activeSlide.config.notes || ''} onChange={(e) => updateActiveSlide((s) => { s.config.notes = e.target.value; }, true)} />
                    </div>
                  )}
                </div>
              );
            }

            // VARIANTI UN SPĒLES LOĢIKA
            if (secKey === 'options' && (activeSlide.type === 'QUESTION' || activeSlide.type === 'MAJORITY' || activeSlide.type === 'ORDERING' || activeSlide.type === 'BUZZER_RACE')) {
              return (
                <div key="options" draggable onDragStart={(e) => handleSectionDragStart(e, 'options')} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleSectionDrop(e, 'options')} style={accordionCard}>
                  <div style={accordionHeader} onClick={() => toggleSection('options')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={dragHandleGrip} title="Pārvelc, lai mainītu secību">⋮⋮</span>
                      🎯 VARIANTI & SPĒLES LOĢIKA
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button onClick={(e) => moveSection('options', 'UP', e)} style={btnReorderSmall}>▲</button>
                      <button onClick={(e) => moveSection('options', 'DOWN', e)} style={btnReorderSmall}>▼</button>
                      <span>{sections.options ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {sections.options && (
                    <div style={{ marginTop: '10px' }}>
                      {/* ĀTRĀS PULTS REŽĪMS */}
                      {activeSlide.type === 'BUZZER_RACE' && (
                        <div style={{ background: '#251010', border: '1px solid #ff4d4d', borderRadius: '6px', padding: '8px', marginBottom: '10px' }}>
                          <label style={{ ...labelStyle, color: '#ff4d4d', fontWeight: 'bold' }}>⚡ Ātrās pults tips:</label>
                          <select
                            style={{ ...selectStyle, borderColor: '#ff4d4d', marginTop: '4px' }}
                            value={activeSlide.config.buzzerRaceType || 'WITH_OPTIONS'}
                            onChange={(e) => updateActiveSlide((s) => (s.config.buzzerRaceType = e.target.value as any), true)}
                          >
                            <option value="WITH_OPTIONS">🎯 Pirmais atbild ar variantiem</option>
                            <option value="ORAL">🗣️ Mutiska atbilde vadītājam</option>
                          </select>
                        </div>
                      )}

                      {/* SECĪBAS KĀRTOŠANAS SARAKSTS */}
                      {activeSlide.type === 'ORDERING' && (
                        <div style={{ background: '#122026', border: '1px solid #00e5ff', borderRadius: '6px', padding: '8px', marginBottom: '10px' }}>
                          <label style={{ ...labelStyle, color: '#00e5ff', fontWeight: 'bold' }}>🔢 Pareizā secība (no augšas uz leju):</label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '6px 0', maxHeight: '160px', overflowY: 'auto' }}>
                            {(activeSlide.config.options || []).map((item, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1c1c1c', padding: '4px 8px', borderRadius: '4px', border: '1px solid #333' }}>
                                <span style={{ color: '#00e5ff', fontWeight: 'bold', fontSize: '0.85rem' }}>#{idx + 1}</span>
                                <span style={{ flex: 1, fontSize: '0.8rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item}</span>
                                <button onClick={() => moveOrderingItem(idx, 'UP')} disabled={idx === 0} style={btnReorderSmall}>▲</button>
                                <button onClick={() => moveOrderingItem(idx, 'DOWN')} disabled={idx === (activeSlide.config.options || []).length - 1} style={btnReorderSmall}>▼</button>
                                <button onClick={() => removeOrderingItem(idx)} style={{ ...btnReorderSmall, color: '#ff4d4d' }}>×</button>
                              </div>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                            <input
                              style={{ ...inputStyle, flex: 1 }}
                              placeholder="Jauns secības elements..."
                              value={newOrderingItemInput}
                              onChange={(e) => setNewOrderingItemInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && addOrderingItem()}
                            />
                            <button onClick={addOrderingItem} style={{ ...btnAction, padding: '4px 10px', background: '#007bff' }}>➕</button>
                          </div>
                        </div>
                      )}

                      {/* TĀLRUŅA PULTS IZSKATS */}
                      {activeSlide.type === 'QUESTION' && (
                        <div style={{ background: '#17222d', border: '1px solid #00e5ff', borderRadius: '6px', padding: '8px', marginBottom: '10px' }}>
                          <label style={{ ...labelStyle, color: '#00e5ff', fontWeight: 'bold' }}>📱 Pults izskats telefonā:</label>
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
                              }, true);
                            }}
                          >
                            <option value="AUTO">✨ Auto (Pēc satura)</option>
                            <option value="CLASSIC_GRID">🔲 Fiksētas 2 rindas (A-C / D-F)</option>
                            <option value="TEXT_CARDS">📝 Kartītes ar tekstu</option>
                            <option value="MUSIC_DUAL">🎵 Muzikālā spēle (Izpildītājs + Dziesma)</option>
                          </select>

                          {activeSlide.config.playerUIMode === 'MUSIC_DUAL' && (
                            <div style={{ marginTop: '6px', borderTop: '1px solid #333', paddingTop: '6px' }}>
                              <label style={labelStyle}>Augšējā kategorija (A, B, C):</label>
                              <input
                                style={{ ...inputStyle, marginBottom: '4px' }}
                                value={activeSlide.config.musicCategoryTop || '🎤 Izpildītājs'}
                                onChange={(e) => updateActiveSlide((s) => (s.config.musicCategoryTop = e.target.value), true)}
                              />
                              <label style={labelStyle}>Apakšējā kategorija (D, E, F):</label>
                              <input
                                style={inputStyle}
                                value={activeSlide.config.musicCategoryBottom || '🎵 Dziesmas nosaukums'}
                                onChange={(e) => updateActiveSlide((s) => (s.config.musicCategoryBottom = e.target.value), true)}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ background: '#1c2833', border: '1px solid #00e5ff', borderRadius: '6px', padding: '8px', marginBottom: '10px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00e5ff', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!activeSlide.config.allowOptionTranslation} onChange={(e) => updateActiveSlide((s) => (s.config.allowOptionTranslation = e.target.checked), true)} />
                          🌐 Ļaut tulkot atbilžu variantus tālrunī
                        </label>
                      </div>

                      <label style={labelStyle}>Punktu režīms:</label>
                      <select style={selectStyle} value={activeSlide.config.scoringMode || 'FIXED'} onChange={(e) => updateActiveSlide((s) => (s.config.scoringMode = e.target.value as any), true)}>
                        <option value="FIXED">Fiksēti punkti</option>
                        <option value="DECREASING">Dilstoši punkti</option>
                      </select>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>Max punkti:</label>
                          <input type="number" style={inputStyle} value={activeSlide.config.pointsMax ?? activeSlide.config.points} onChange={(e) => updateActiveSlide((s) => { const val = Number(e.target.value); s.config.points = val; s.config.pointsMax = val; }, true)} />
                        </div>
                        {activeSlide.config.scoringMode === 'DECREASING' && (
                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Min punkti:</label>
                            <input type="number" style={inputStyle} value={activeSlide.config.pointsMin ?? 1} onChange={(e) => updateActiveSlide((s) => (s.config.pointsMin = Number(e.target.value)), true)} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // STILS UN KRĀSAS
            if (secKey === 'style') {
              return (
                <div key="style" draggable onDragStart={(e) => handleSectionDragStart(e, 'style')} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleSectionDrop(e, 'style')} style={accordionCard}>
                  <div style={accordionHeader} onClick={() => toggleSection('style')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={dragHandleGrip} title="Pārvelc, lai mainītu secību">⋮⋮</span>
                      🎨 DIZAINS, KRĀSAS & FONTI
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button onClick={(e) => moveSection('style', 'UP', e)} style={btnReorderSmall}>▲</button>
                      <button onClick={(e) => moveSection('style', 'DOWN', e)} style={btnReorderSmall}>▼</button>
                      <span>{sections.style ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {sections.style && (
                    <div style={{ marginTop: '10px' }}>
                      <label style={labelStyle}>Slaida fona attēls:</label>
                      <select style={selectStyle} value={activeSlide.config.backgroundUrl || ''} onChange={(e) => updateActiveSlide((s) => (s.config.backgroundUrl = e.target.value), true)}>
                        <option value="">(Tēmas fons)</option>
                        {mediaList.filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f)).map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Teksts:</span>
                          <input type="color" value={activeSlide.config.optionsColor || '#ffffff'} onChange={(e) => updateActiveSlide((s) => (s.config.optionsColor = e.target.value), true)} style={colorPicker} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Fons:</span>
                          <input type="color" value={activeSlide.config.optionsBgColor || '#000000'} onChange={(e) => updateActiveSlide((s) => (s.config.optionsBgColor = e.target.value), true)} style={colorPicker} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#00ff00', fontWeight: 'bold' }}>Pareizā:</span>
                          <input type="color" value={activeSlide.config.optionsCorrectColor || '#00ff00'} onChange={(e) => updateActiveSlide((s) => (s.config.optionsCorrectColor = e.target.value), true)} style={colorPicker} />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Loga fona intensitāte:</span>
                          <span style={{ fontSize: '0.8rem', color: '#00ff00', fontWeight: 'bold' }}>{activeSlide.config.optionsBgOpacity ?? 85}%</span>
                        </div>
                        <input type="range" min="0" max="100" step="5" value={activeSlide.config.optionsBgOpacity ?? 85} onChange={(e) => updateActiveSlide((s) => (s.config.optionsBgOpacity = Number(e.target.value)), true)} style={{ width: '100%', accentColor: '#00ff00', cursor: 'pointer' }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // MEDIJI
            if (secKey === 'media') {
              return (
                <div key="media" draggable onDragStart={(e) => handleSectionDragStart(e, 'media')} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleSectionDrop(e, 'media')} style={accordionCard}>
                  <div style={accordionHeader} onClick={() => toggleSection('media')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={dragHandleGrip} title="Pārvelc, lai mainītu secību">⋮⋮</span>
                      📁 MEDIJU MAPE ({filteredMediaList.length})
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button onClick={(e) => moveSection('media', 'UP', e)} style={btnReorderSmall}>▲</button>
                      <button onClick={(e) => moveSection('media', 'DOWN', e)} style={btnReorderSmall}>▼</button>
                      <span>{sections.media ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {sections.media && (
                    <div style={{ marginTop: '10px' }}>
                      <input style={{ ...inputStyle, marginBottom: '8px', fontSize: '0.85rem', borderColor: '#00e5ff' }} placeholder="🔍 Meklēt mediju..." value={mediaSearchQuery} onChange={(e) => setMediaSearchQuery(e.target.value)} />
                      <div style={{ maxHeight: '140px', overflowY: 'auto' }}>
                        {filteredMediaList.length === 0 ? (
                          <div style={{ fontSize: '0.75rem', color: '#888', fontStyle: 'italic', padding: '4px' }}>Nav atbilstošu failu</div>
                        ) : (
                          filteredMediaList.map((m) => (
                            <div key={m} style={mediaItem} onClick={() => addMediaElement(m)} title="Klikšķini, lai pievienotu slaidam">📄 {m}</div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // BRANDING
            if (secKey === 'branding') {
              return (
                <div key="branding" draggable onDragStart={(e) => handleSectionDragStart(e, 'branding')} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleSectionDrop(e, 'branding')} style={accordionCard}>
                  <div style={accordionHeader} onClick={() => toggleSection('branding')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={dragHandleGrip} title="Pārvelc, lai mainītu secību">⋮⋮</span>
                      📱 SPĒLES & LOBBY IESTATĪJUMI
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button onClick={(e) => moveSection('branding', 'UP', e)} style={btnReorderSmall}>▲</button>
                      <button onClick={(e) => moveSection('branding', 'DOWN', e)} style={btnReorderSmall}>▼</button>
                      <span>{sections.branding ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {sections.branding && (
                    <div style={{ marginTop: '10px' }}>
                      <label style={{ ...labelStyle, color: '#00e5ff', fontWeight: 'bold' }}>🎮 Sākuma ekrāna (Lobby) stils:</label>
                      <select style={{ ...selectStyle, borderColor: '#00e5ff', fontWeight: 'bold', background: '#0a1d2e' }} value={mobileBranding.lobbyMode || 'INTERACTIVE_DOTS'} onChange={(e) => setMobileBranding({ ...mobileBranding, lobbyMode: e.target.value as any })}>
                        <option value="INTERACTIVE_DOTS">💥 Interaktīvās bumbiņas ar pults testu (Noklusējums)</option>
                        <option value="CIRCLE">⭕ Klasiskais (Lielais PIN & Dalībnieku aplis)</option>
                      </select>

                      <div style={{ background: '#112233', border: '1.5px solid #00e5ff', borderRadius: '8px', padding: '10px', margin: '10px 0' }}>
                        <div style={{ fontSize: '0.85rem', color: '#00e5ff', fontWeight: 'bold', marginBottom: '8px' }}>
                          🖼️ SĀKUMA EKRĀNA (LOBBY) DIZAINS:
                        </div>

                        <label style={labelStyle}>Sākuma ekrāna fona attēls:</label>
                        <select
                          style={selectStyle}
                          value={mobileBranding.lobbyBgImage || ''}
                          onChange={(e) => setMobileBranding({ ...mobileBranding, lobbyBgImage: e.target.value })}
                        >
                          <option value="">(Bez attēla - izmantot krāsu)</option>
                          {mediaList.filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f)).map((f) => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Lobby fona pamatkrāsa:</span>
                          <input
                            type="color"
                            value={mobileBranding.lobbyBgColor || '#0a0a0a'}
                            onChange={(e) => setMobileBranding({ ...mobileBranding, lobbyBgColor: e.target.value })}
                            style={colorPicker}
                          />
                        </div>

                        <label style={labelStyle}>Galvenais virsraksts (ar dalībnieku skaitu):</label>
                        <input
                          style={inputStyle}
                          value={mobileBranding.lobbyTitleText || ''}
                          placeholder="🎮 PIESLĒGUŠIES DALĪBNIEKI ({count}):"
                          onChange={(e) => setMobileBranding({ ...mobileBranding, lobbyTitleText: e.target.value })}
                        />
                        <span style={{ fontSize: '0.7rem', color: '#888', display: 'block', marginTop: '2px', marginBottom: '6px' }}>
                          💡 <code>{'{count}'}</code> tiks automātiski aizvietots ar spēlētāju skaitu.
                        </span>

                        <label style={labelStyle}>Apakšvirsraksts / aicinājums testēt:</label>
                        <input
                          style={inputStyle}
                          value={mobileBranding.lobbySubtitleText || ''}
                          placeholder='Spiediet telefonā "Pārbaudīt pulti", lai bumbiņa pulsētu! 💥'
                          onChange={(e) => setMobileBranding({ ...mobileBranding, lobbySubtitleText: e.target.value })}
                        />

                        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>QR virsraksts:</label>
                            <input
                              style={inputStyle}
                              value={mobileBranding.lobbyQrTitle || ''}
                              placeholder="Skenē kamerā!"
                              onChange={(e) => setMobileBranding({ ...mobileBranding, lobbyQrTitle: e.target.value })}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>QR apakšteksts:</label>
                            <input
                              style={inputStyle}
                              value={mobileBranding.lobbyQrSubtitle || ''}
                              placeholder="Pieslēdzies spēlei"
                              onChange={(e) => setMobileBranding({ ...mobileBranding, lobbyQrSubtitle: e.target.value })}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Virsraksta krāsa:</span>
                            <input
                              type="color"
                              value={mobileBranding.lobbyTitleColor || '#ffc107'}
                              onChange={(e) => setMobileBranding({ ...mobileBranding, lobbyTitleColor: e.target.value })}
                              style={colorPicker}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Apakšteksta krāsa:</span>
                            <input
                              type="color"
                              value={mobileBranding.lobbySubtitleColor || '#aaaaaa'}
                              onChange={(e) => setMobileBranding({ ...mobileBranding, lobbySubtitleColor: e.target.value })}
                              style={colorPicker}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Lodziņu fons:</span>
                            <input
                              type="color"
                              value={mobileBranding.lobbyBoxBgColor || '#000000'}
                              onChange={(e) => setMobileBranding({ ...mobileBranding, lobbyBoxBgColor: e.target.value })}
                              style={colorPicker}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Lodziņu rāmis:</span>
                            <input
                              type="color"
                              value={mobileBranding.lobbyBoxBorderColor || '#00ff00'}
                              onChange={(e) => setMobileBranding({ ...mobileBranding, lobbyBoxBorderColor: e.target.value })}
                              style={colorPicker}
                            />
                          </div>
                        </div>

                        <div style={{ marginTop: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                            <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Lodziņu fona intensitāte:</span>
                            <span style={{ fontSize: '0.8rem', color: '#00ff00', fontWeight: 'bold' }}>
                              {mobileBranding.lobbyBoxBgOpacity ?? 85}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={mobileBranding.lobbyBoxBgOpacity ?? 85}
                            onChange={(e) => setMobileBranding({ ...mobileBranding, lobbyBoxBgOpacity: Number(e.target.value) })}
                            style={{ width: '100%', accentColor: '#00ff00', cursor: 'pointer' }}
                          />
                        </div>
                      </div>

                      <label style={labelStyle}>👑 TV ekrāna tēma:</label>
                      <select style={selectStyle} value={mobileBranding.presentationTheme || 'TV_SHOW'} onChange={(e) => setMobileBranding({ ...mobileBranding, presentationTheme: e.target.value as any })}>
                        <option value="TV_SHOW">🏆 TV Prime-Time Show</option>
                        <option value="ARENA">⚡ Arena & Esports</option>
                        <option value="MINIMAL">🍏 Modern Minimal</option>
                        <option value="NEON">🟢 Cyber Neon</option>
                      </select>

                      <label style={labelStyle}>Lietotnes nosaukums telefonā:</label>
                      <input style={inputStyle} value={mobileBranding.appTitle || 'EVENT BUZZER'} onChange={(e) => setMobileBranding({ ...mobileBranding, appTitle: e.target.value })} />

                      <label style={labelStyle}>Sākuma Logo (PNG/SVG):</label>
                      <select style={selectStyle} value={mobileBranding.appLogo || ''} onChange={(e) => setMobileBranding({ ...mobileBranding, appLogo: e.target.value })}>
                        <option value="">(Noklusējuma ikona 🎮)</option>
                        {mediaList.filter((f) => /\.(png|webp|svg)$/i.test(f)).map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              );
            }

            // DIPLOMI
            if (secKey === 'diploma') {
              return (
                <div key="diploma" draggable onDragStart={(e) => handleSectionDragStart(e, 'diploma')} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleSectionDrop(e, 'diploma')} style={accordionCard}>
                  <div style={accordionHeader} onClick={() => toggleSection('diploma')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={dragHandleGrip} title="Pārvelc, lai mainītu secību">⋮⋮</span>
                      🏆 DIPLOMU DIZAINS UN TEKSTI
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button onClick={(e) => moveSection('diploma', 'UP', e)} style={btnReorderSmall}>▲</button>
                      <button onClick={(e) => moveSection('diploma', 'DOWN', e)} style={btnReorderSmall}>▼</button>
                      <span>{sections.diploma ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {sections.diploma && (
                    <div style={{ marginTop: '10px' }}>
                      <button onClick={() => setShowDiplomaModal(true)} style={{ ...btnSmallAction, background: '#d63384', color: '#fff', fontWeight: 'bold', marginBottom: '10px' }}>
                        👁️ Atvērt diplomu priekšskatījumu & laukus
                      </button>

                      <label style={labelStyle}>Drukas tēma:</label>
                      <select style={selectStyle} value={diplomaCfg.theme || 'GOLD_DARK'} onChange={(e) => setMobileBranding({ ...mobileBranding, diplomaConfig: { ...diplomaCfg, theme: e.target.value as any } })}>
                        <option value="GOLD_DARK">🌙 Zelta & Tumšs</option>
                        <option value="GOLD_WHITE_PRINT">🖨️ Balts & Tinti taupošs</option>
                      </select>

                      <label style={labelStyle}>Diplomu galvenais virsraksts:</label>
                      <input style={inputStyle} value={diplomaCfg.customTitle || ''} placeholder="🏆 DIPLOMS 🏆" onChange={(e) => setMobileBranding({ ...mobileBranding, diplomaConfig: { ...diplomaCfg, customTitle: e.target.value } })} />

                      <label style={labelStyle}>Apakšvirsraksts (godalga / vieta):</label>
                      <input style={inputStyle} value={diplomaCfg.customSubtitle || ''} placeholder="Par iegūto 1. vietu spēlē" onChange={(e) => setMobileBranding({ ...mobileBranding, diplomaConfig: { ...diplomaCfg, customSubtitle: e.target.value } })} />

                      <label style={labelStyle}>Kājenes teksts (organizators, autortiesības):</label>
                      <input style={inputStyle} value={diplomaCfg.footerText || ''} placeholder="Event Studio" onChange={(e) => setMobileBranding({ ...mobileBranding, diplomaConfig: { ...diplomaCfg, footerText: e.target.value } })} />

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px', background: '#1c1c1c', padding: '8px', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Virsraksts:</span>
                          <input type="color" value={diplomaCfg.titleColor || '#ffffff'} onChange={(e) => setMobileBranding({ ...mobileBranding, diplomaConfig: { ...diplomaCfg, titleColor: e.target.value } })} style={colorPicker} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Uzvarētājs:</span>
                          <input type="color" value={diplomaCfg.winnerColor || '#ffd700'} onChange={(e) => setMobileBranding({ ...mobileBranding, diplomaConfig: { ...diplomaCfg, winnerColor: e.target.value } })} style={colorPicker} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Rāmis:</span>
                          <input type="color" value={diplomaCfg.borderColor || '#ffc107'} onChange={(e) => setMobileBranding({ ...mobileBranding, diplomaConfig: { ...diplomaCfg, borderColor: e.target.value } })} style={colorPicker} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Fons:</span>
                          <input type="color" value={diplomaCfg.bgColor || '#111111'} onChange={(e) => setMobileBranding({ ...mobileBranding, diplomaConfig: { ...diplomaCfg, bgColor: e.target.value } })} style={colorPicker} />
                        </div>
                      </div>

                      <div style={{ marginTop: '10px', borderTop: '1px solid #333', paddingTop: '8px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#00e5ff', fontWeight: 'bold', marginBottom: '6px' }}>
                          Rādīt / paslēpt blokus diplomā:
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#ccc', cursor: 'pointer' }}>
                            <input type="checkbox" checked={diplomaCfg.showLogo !== false} onChange={(e) => setMobileBranding({ ...mobileBranding, diplomaConfig: { ...diplomaCfg, showLogo: e.target.checked } })} />
                            🖼️ Logo
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#ccc', cursor: 'pointer' }}>
                            <input type="checkbox" checked={diplomaCfg.showTitle !== false} onChange={(e) => setMobileBranding({ ...mobileBranding, diplomaConfig: { ...diplomaCfg, showTitle: e.target.checked } })} />
                            👑 Virsraksts
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#ccc', cursor: 'pointer' }}>
                            <input type="checkbox" checked={diplomaCfg.showSubtitle !== false} onChange={(e) => setMobileBranding({ ...mobileBranding, diplomaConfig: { ...diplomaCfg, showSubtitle: e.target.checked } })} />
                            📜 Godalga
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#ccc', cursor: 'pointer' }}>
                            <input type="checkbox" checked={diplomaCfg.showWinner !== false} onChange={(e) => setMobileBranding({ ...mobileBranding, diplomaConfig: { ...diplomaCfg, showWinner: e.target.checked } })} />
                            👤 Uzvarētājs
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#ccc', cursor: 'pointer' }}>
                            <input type="checkbox" checked={diplomaCfg.showScore !== false} onChange={(e) => setMobileBranding({ ...mobileBranding, diplomaConfig: { ...diplomaCfg, showScore: e.target.checked } })} />
                            ⭐ Punkti
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#ccc', cursor: 'pointer' }}>
                            <input type="checkbox" checked={diplomaCfg.showFooter !== false} onChange={(e) => setMobileBranding({ ...mobileBranding, diplomaConfig: { ...diplomaCfg, showFooter: e.target.checked } })} />
                            📌 Kājene
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // ANKETA
            if (secKey === 'contacts' && activeSlide.type === 'CONTACTS') {
              return (
                <div key="contacts" draggable onDragStart={(e) => handleSectionDragStart(e, 'contacts')} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleSectionDrop(e, 'contacts')} style={accordionCard}>
                  <div style={accordionHeader} onClick={() => toggleSection('contacts')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={dragHandleGrip} title="Pārvelc, lai mainītu secību">⋮⋮</span>
                      📋 ANKETAS LAUKI & IESTATĪJUMI
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button onClick={(e) => moveSection('contacts', 'UP', e)} style={btnReorderSmall}>▲</button>
                      <button onClick={(e) => moveSection('contacts', 'DOWN', e)} style={btnReorderSmall}>▼</button>
                      <span>{sections.contacts ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {sections.contacts && (
                    <div style={{ marginTop: '10px' }}>
                      <label style={labelStyle}>Anketas virsraksts:</label>
                      <input style={inputStyle} value={activeSlide.config.contactsTitle || 'DALĪBNIEKU ANKETA'} onChange={(e) => updateActiveSlide((s) => { s.config.contactsTitle = e.target.value; }, true)} />

                      <label style={labelStyle}>Aicinājuma teksts (Apraksts):</label>
                      <textarea style={{ ...inputStyle, minHeight: '40px', resize: 'vertical' }} value={activeSlide.config.contactsDescription || ''} onChange={(e) => updateActiveSlide((s) => (s.config.contactsDescription = e.target.value), true)} />

                      <div style={{ borderTop: '1px solid #333', marginTop: '10px', paddingTop: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '180px', overflowY: 'auto' }}>
                          {((activeSlide.config.contactFields && activeSlide.config.contactFields.length > 0) ? activeSlide.config.contactFields : defaultContactFieldsList).map((f) => (
                            <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1c1c1c', border: '1px solid #333', padding: '5px 8px', borderRadius: '5px' }}>
                              <div style={{ flex: 1 }}>
                                <span style={{ fontSize: '0.85rem', color: '#ffc107', fontWeight: 'bold' }}>{f.label}</span>
                                {f.required && <span style={{ color: '#ff4d4d', marginLeft: '4px', fontWeight: 'bold' }}>* (Obligāts)</span>}
                                <div style={{ fontSize: '0.72rem', color: '#777' }}>Tips: {f.type || 'text'}</div>
                              </div>
                              <button onClick={() => handleRemoveContactField(f.id)} style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}>×</button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ background: '#111', border: '1px dashed #555', padding: '10px', borderRadius: '8px', marginTop: '10px' }}>
                        <input style={{ ...inputStyle, marginBottom: '6px', fontSize: '0.85rem' }} placeholder="Lauka nosaukums..." value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} />
                        <input style={{ ...inputStyle, marginBottom: '6px', fontSize: '0.85rem' }} placeholder="Placeholder..." value={newFieldPlaceholder} onChange={(e) => setNewFieldPlaceholder(e.target.value)} />
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                          <select style={{ ...selectStyle, flex: 1, margin: 0, fontSize: '0.8rem' }} value={newFieldType} onChange={(e) => setNewFieldType(e.target.value as any)}>
                            <option value="text">🔤 Teksts</option>
                            <option value="email">📧 E-pasts</option>
                            <option value="tel">📞 Tālrunis</option>
                          </select>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#ffc107', cursor: 'pointer' }}>
                            <input type="checkbox" checked={newFieldRequired} onChange={(e) => setNewFieldRequired(e.target.checked)} /> Obligāts
                          </label>
                        </div>
                        <button onClick={handleAddContactField} style={{ ...btnSmallAction, background: '#007bff', color: '#fff', fontWeight: 'bold', margin: 0 }}>➕ Pievienot lauku anketai</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // TAIMERIS
            if (secKey === 'timer' && activeSlide.type === 'TIMER') {
              return (
                <div key="timer" draggable onDragStart={(e) => handleSectionDragStart(e, 'timer')} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleSectionDrop(e, 'timer')} style={accordionCard}>
                  <div style={accordionHeader} onClick={() => toggleSection('timer')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={dragHandleGrip} title="Pārvelc, lai mainītu secību">⋮⋮</span>
                      ⏱️ TAIMERA IESTATĪJUMI
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button onClick={(e) => moveSection('timer', 'UP', e)} style={btnReorderSmall}>▲</button>
                      <button onClick={(e) => moveSection('timer', 'DOWN', e)} style={btnReorderSmall}>▼</button>
                      <span>{sections.timer ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {sections.timer && (
                    <div style={{ marginTop: '10px' }}>
                      <label style={labelStyle}>Taimera režīms:</label>
                      <select style={selectStyle} value={activeSlide.config.timerType || 'COUNTDOWN'} onChange={(e) => updateActiveSlide((s) => { s.config.timerType = e.target.value as any; }, true)}>
                        <option value="COUNTDOWN">⏳ Atpakaļskaitīšana</option>
                        <option value="CLOCK">🕒 Reālā laika pulkstenis</option>
                      </select>

                      <label style={labelStyle}>Izvietojums ekrānā:</label>
                      <select style={selectStyle} value={activeSlide.config.timerPlacement || 'CENTER'} onChange={(e) => updateActiveSlide((s) => (s.config.timerPlacement = e.target.value as any), true)}>
                        <option value="CENTER">🎯 Liels tieši pa centru</option>
                        <option value="TOP_RIGHT">↗️ Mazāks augšā labajā stūrī</option>
                      </select>

                      <label style={labelStyle}>Virsraksts virs laika:</label>
                      <input style={inputStyle} value={activeSlide.config.timerLabel || ''} onChange={(e) => updateActiveSlide((s) => (s.config.timerLabel = e.target.value), true)} placeholder="Piem., Pārtraukums līdz 15:30" />

                      {activeSlide.config.timerType !== 'CLOCK' && (
                        <>
                          <label style={labelStyle}>Ilgums sekundēs (piem., 300 = 5 min):</label>
                          <input type="number" style={inputStyle} value={activeSlide.config.timerDuration ?? 300} onChange={(e) => updateActiveSlide((s) => (s.config.timerDuration = Number(e.target.value)), true)} />
                        </>
                      )}

                      <label style={labelStyle}>Cilpas video fons (Video loop):</label>
                      <select style={selectStyle} value={activeSlide.config.timerBgVideo || ''} onChange={(e) => updateActiveSlide((s) => (s.config.timerBgVideo = e.target.value), true)}>
                        <option value="">(Bez video fona)</option>
                        {mediaList.filter((f) => /\.(mp4|mov|webm)$/i.test(f)).map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>

      {/* 🌟 3. DIPLOMU DIZAINA & REĀLĀ PREVIEW MODĀLAIS LOGS */}
      {showDiplomaModal && (
        <div style={modalOverlayStyle} onClick={() => setShowDiplomaModal(false)}>
          <div style={diplomaModalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
              <h2 style={{ margin: 0, color: '#d63384' }}>🏆 Diplomu dizains, lauku slēdži & reālais izskats</h2>
              <button onClick={() => setShowDiplomaModal(false)} style={{ background: 'transparent', border: 'none', color: '#ff4d4d', fontSize: '1.5rem', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', background: '#1c1c1c', padding: '12px', borderRadius: '8px', margin: '12px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#fff', cursor: 'pointer' }}>
                <input type="checkbox" checked={diplomaCfg.showLogo !== false} onChange={(e) => setMobileBranding({ ...mobileBranding, diplomaConfig: { ...diplomaCfg, showLogo: e.target.checked } })} />
                🖼️ Rādīt Logo
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#fff', cursor: 'pointer' }}>
                <input type="checkbox" checked={diplomaCfg.showTitle !== false} onChange={(e) => setMobileBranding({ ...mobileBranding, diplomaConfig: { ...diplomaCfg, showTitle: e.target.checked } })} />
                👑 Virsraksts ("DIPLOMS")
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#fff', cursor: 'pointer' }}>
                <input type="checkbox" checked={diplomaCfg.showSubtitle !== false} onChange={(e) => setMobileBranding({ ...mobileBranding, diplomaConfig: { ...diplomaCfg, showSubtitle: e.target.checked } })} />
                📜 Apakšvirsraksts
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#fff', cursor: 'pointer' }}>
                <input type="checkbox" checked={diplomaCfg.showWinner !== false} onChange={(e) => setMobileBranding({ ...mobileBranding, diplomaConfig: { ...diplomaCfg, showWinner: e.target.checked } })} />
                👤 Uzvarētāja vārds
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#fff', cursor: 'pointer' }}>
                <input type="checkbox" checked={diplomaCfg.showScore !== false} onChange={(e) => setMobileBranding({ ...mobileBranding, diplomaConfig: { ...diplomaCfg, showScore: e.target.checked } })} />
                ⭐ Iegūtie punkti
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#fff', cursor: 'pointer' }}>
                <input type="checkbox" checked={diplomaCfg.showFooter !== false} onChange={(e) => setMobileBranding({ ...mobileBranding, diplomaConfig: { ...diplomaCfg, showFooter: e.target.checked } })} />
                📌 Kājene (Datums & PIN)
              </label>
            </div>

            <div style={{
              margin: '15px auto',
              width: '100%',
              maxWidth: '620px',
              height: '380px',
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
              {diplomaCfg.showLogo !== false && mobileBranding.appLogo && (
                <div style={{ marginBottom: '8px' }}>
                  <img
                    src={`${MEDIA_BASE_URL}/${encodeURIComponent(mobileBranding.appLogo).replace(/%2F/g, '/')}`}
                    alt="Diploma Logo"
                    style={{ maxHeight: '65px', maxWidth: '240px', objectFit: 'contain' }}
                  />
                </div>
              )}

              {diplomaCfg.showTitle !== false && (
                <h1 style={{ fontSize: '1.8rem', color: diplomaCfg.theme === 'GOLD_WHITE_PRINT' ? '#111' : (diplomaCfg.titleColor || '#fff'), margin: 0 }}>
                  {diplomaCfg.customTitle || '🏆 DIPLOMS 🏆'}
                </h1>
              )}

              {diplomaCfg.showSubtitle !== false && (
                <h3 style={{ fontSize: '1.05rem', color: diplomaCfg.borderColor || '#ffc107', margin: '4px 0' }}>
                  {diplomaCfg.customSubtitle || 'Par iegūto 1. vietu spēlē'}
                </h3>
              )}

              {diplomaCfg.showWinner !== false && (
                <div style={{ fontSize: '1.8rem', fontWeight: '900', color: diplomaCfg.winnerColor || '#ffd700', margin: '8px 0' }}>
                  ČEMPIONU VĀRDS VAI KOMANDA
                </div>
              )}

              {diplomaCfg.showScore !== false && (
                <div style={{ fontSize: '1.1rem' }}>Iegūtie punkti: <strong>150 pt</strong></div>
              )}

              {diplomaCfg.showFooter !== false && (
                <div style={{ marginTop: '16px', fontSize: '0.8rem', color: '#888' }}>
                  {diplomaCfg.footerText || 'Event Studio'} • Spēles PIN: 1234 • {new Date().toLocaleDateString('lv-LV')}
                </div>
              )}
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

      {/* EXCEL / CSV IMPORTA DIALOGLOGS */}
      {showImportModal && (
        <div style={modalOverlayStyle} onClick={() => setShowImportModal(false)}>
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

            <div style={{ fontSize: '0.85rem', color: '#ccc', lineHeight: 1.5, background: '#121212', padding: '12px', borderRadius: '8px', border: '1px solid #333' }}>
              <strong>💡 Kā sagatavot datus:</strong>
              <div>Excel tabulā kolonnas jākārto šādi: <code>Jautājums | Variants A | Variants B | Variants C | Variants D | Pareizā | [Laiks sek] | [Punkti] | [Piezīmes]</code></div>
              <div style={{ marginTop: '6px', color: '#ffc107' }}>
                🎯 <strong>Punktu norādīšana:</strong><br/>
                • Ja norāda diapazonu, piem., <code>100-50</code>, punkti kļūst <strong>dilstoši</strong> no 100 līdz 50!<br/>
                • Ja norāda vienu skaitli, piem., <code>10</code> vai <code>100</code>, punkti būs <strong>fiksēti</strong>.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px' }}>
              <input type="file" accept=".csv,.txt" onChange={handleFileUpload} style={{ color: '#aaa', fontSize: '0.85rem' }} />
              <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: '#ccc' }}>
                  <input type="radio" name="impMode" checked={importMode === 'APPEND'} onChange={() => setImportMode('APPEND')} />
                  Pievienot beigās
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: '#ccc' }}>
                  <input type="radio" name="impMode" checked={importMode === 'REPLACE'} onChange={() => setImportMode('REPLACE')} />
                  Aizstāt visus
                </label>
              </div>
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
                resize: 'vertical',
                marginTop: '10px'
              }}
              placeholder="Iekopē datus šeit no Excel (ar Tab atdalītājiem)..."
              value={importRawText}
              onChange={(e) => processImportText(e.target.value)}
            />

            {importedQuestions.length > 0 && (
              <div style={{ maxHeight: '180px', overflowY: 'auto', background: '#0d0d0d', border: '1px solid #222', borderRadius: '8px', padding: '8px', marginTop: '10px' }}>
                <div style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '6px', fontWeight: 'bold' }}>
                  Atrasti {importedQuestions.length} jautājumi importam:
                </div>
                {importedQuestions.map((q, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderBottom: '1px solid #1a1a1a', fontSize: '0.8rem' }}>
                    <span style={{ color: '#fff', maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {i + 1}. {q.title}
                    </span>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span style={{ color: '#00ff00', fontWeight: 'bold' }}>✓ {q.correctAnswers.join(', ')}</span>
                      <span style={{ color: '#00e5ff' }}>⏱️ {q.duration}s</span>
                      <span style={{
                        color: q.scoringMode === 'DECREASING' ? '#ffd700' : '#28a745',
                        background: q.scoringMode === 'DECREASING' ? 'rgba(255,215,0,0.15)' : 'rgba(40,167,69,0.15)',
                        border: `1px solid ${q.scoringMode === 'DECREASING' ? '#ffd700' : '#28a745'}`,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        fontSize: '0.75rem'
                      }}>
                        {q.scoringMode === 'DECREASING' ? `⭐ ${q.pointsMax} ➔ ${q.pointsMin} (Dilstoši)` : `⭐ ${q.points} pt (Fiksēti)`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #333', paddingTop: '10px', marginTop: '10px' }}>
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
  background: '#00ff00',
  border: '2px solid #ffffff',
  cursor: 'nwse-resize',
  borderRadius: '3px',
  zIndex: 100,
  boxShadow: '0 0 6px rgba(0,255,0,0.9)'
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

const dragHandleGrip: React.CSSProperties = {
  cursor: 'grab',
  color: '#888',
  fontSize: '0.9rem',
  marginRight: '2px'
};

const btnReorderSmall: React.CSSProperties = {
  background: '#252525',
  color: '#ccc',
  border: '1px solid #444',
  borderRadius: '3px',
  cursor: 'pointer',
  padding: '1px 5px',
  fontSize: '0.7rem'
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