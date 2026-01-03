
import React, { useState, useEffect, useRef } from 'react';
import { NeuCard, NeuButton, NeuInput, NeuSelect, NeuModal, NeuFileUpload, NeuRange } from './components/NeumorphicComponents';
import { processImageToPattern } from './services/imageProcessor';
import { analyzeBeadPattern } from './services/gemini';
import { ExportController } from './services/ExportController';
import { PatternData, AIAnalysis, BeadColor } from './types';

import { translations, Language } from './translations';
import { usePalette } from './context/PaletteContext';
import { parsePaletteCSV } from './services/csvUtils';
import { ImageCropper } from './components/ImageCropper';
import { FreeDrawEditor } from './components/FreeDrawEditor';
import { Icon } from '@iconify/react';
import { Logger } from './services/logger';

const App = () => {
  const [language, setLanguage] = useState<Language>('zh'); // Default to Chinese
  const t = translations[language];
  const siteLabel = (typeof window !== 'undefined' && window.location.hostname) ? window.location.hostname : t.appTitle;
  
  // Context
  const { allPalettes, selectedPaletteId, activePalette, setSelectedPaletteId, addCustomPalette, removeCustomPalette } = usePalette();

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  
  // Grid Dimensions State
  const [gridWidth, setGridWidth] = useState<number>(29);
  const [gridHeight, setGridHeight] = useState<number>(29);
  const [lockRatio, setLockRatio] = useState<boolean>(true);
  const [imgAspectRatio, setImgAspectRatio] = useState<number>(1);

  // Palette State - MOVED TO CONTEXT
  // const [selectedPaletteId, setSelectedPaletteId] = useState<string>(AVAILABLE_PALETTES[0].id);

  const [patternData, setPatternData] = useState<PatternData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [beadShape, setBeadShape] = useState<'round' | 'square'>('square');
  const [denoiseLevel, setDenoiseLevel] = useState<number>(0);
  const [appliedDenoiseLevel, setAppliedDenoiseLevel] = useState<number>(0);

  // Debounce Denoise Level
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedDenoiseLevel(denoiseLevel);
    }, 500);
    return () => clearTimeout(timer);
  }, [denoiseLevel]);

  // CSV Import State
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvName, setCsvName] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // Canvas Interaction State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  // Material State
  const [hiddenBeadIds, setHiddenBeadIds] = useState<Set<string>>(new Set());

  // Edit Mode State
  const [pickingColorFor, setPickingColorFor] = useState<{ 
    type: 'global' | 'single', 
    targetId?: string, // for global replace
    x?: number, // for single replace
    y?: number,
    currentBead?: BeadColor
  } | null>(null);
  const [colorSearch, setColorSearch] = useState('');

  // Split Export State
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitConfig, setSplitConfig] = useState({ width: 29, height: 29 });
  const [isExporting, setIsExporting] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState(false);
  
  // Dual Export State
  const [isDualExport, setIsDualExport] = useState(false);

  // Material Export State
  const [showMaterialExportModal, setShowMaterialExportModal] = useState(false);
  const [excludeHiddenMaterials, setExcludeHiddenMaterials] = useState(true);

  // Info Modal State
  const [infoModal, setInfoModal] = useState<{ isOpen: boolean, title: string, content: string }>({
    isOpen: false,
    title: '',
    content: ''
  });
  const closeInfoModal = () => setInfoModal(prev => ({ ...prev, isOpen: false }));

  // Free Draw State
  const [isFreeDrawMode, setIsFreeDrawMode] = useState(false);

  // Initialize Logger
  useEffect(() => {
    Logger.log('page_view', '请求了页面');
  }, []);

  // HandlersDerived state for active palette - MOVED TO CONTEXT
  // const activePalette = AVAILABLE_PALETTES.find(p => p.id === selectedPaletteId) || AVAILABLE_PALETTES[0];

  // File Upload Handler
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setOriginalImageSrc(result);
        setIsCropping(true); // Trigger crop flow
        
        // Reset states
        setPatternData(null); 
        setAiAnalysis(null);
        setHiddenBeadIds(new Set()); 
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setImageSrc(null); // Clear current processed image until crop is done
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        setCsvFile(file);
        // Default name to filename without extension
        if (!csvName) {
            setCsvName(file.name.replace(/\.[^/.]+$/, ""));
        }
    }
  };

  const handleImportCsv = () => {
      if (!csvFile || !csvName) return;
      const reader = new FileReader();
      reader.onload = (e) => {
          const content = e.target?.result as string;
          const colors = parsePaletteCSV(content);
          if (colors.length > 0) {
              addCustomPalette(csvName, colors);
              setShowCsvModal(false);
              setCsvFile(null);
              setCsvName('');
              alert(`Imported ${colors.length} colors successfully!`);
          } else {
              alert('Failed to parse CSV. Please check the format.');
          }
      };
      reader.readAsText(csvFile);
  };

  const handleCropConfirm = (croppedSrc: string) => {
    setImageSrc(croppedSrc);
    setIsCropping(false);
  };

  const handleCropCancel = () => {
    if (originalImageSrc) {
        setImageSrc(originalImageSrc);
    }
    setIsCropping(false);
  };

  // When image loads, calculate aspect ratio and reset height
  useEffect(() => {
    if (imageSrc) {
      const img = new Image();
      img.onload = () => {
        const ratio = img.width / img.height;
        setImgAspectRatio(ratio);
        if (lockRatio) {
            setGridHeight(Math.max(1, Math.round(gridWidth / ratio)));
        }
      };
      img.src = imageSrc;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSrc]);

  // Handle Dimension Changes
  const handleWidthChange = (val: string) => {
    const w = parseInt(val) || 0;
    setGridWidth(w);
    if (lockRatio && imgAspectRatio > 0 && w > 0) {
        setGridHeight(Math.max(1, Math.round(w / imgAspectRatio)));
    }
  };

  const handleHeightChange = (val: string) => {
    const h = parseInt(val) || 0;
    setGridHeight(h);
    if (lockRatio && imgAspectRatio > 0 && h > 0) {
        setGridWidth(Math.max(1, Math.round(h * imgAspectRatio)));
    }
  };

  // Toggle Bead Visibility
  const toggleBeadVisibility = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering row click
    setHiddenBeadIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Generate Pattern Effect (Only runs when image/dimensions change, not when editing pixels)
  useEffect(() => {
    if (imageSrc && gridWidth > 0 && gridHeight > 0) {
      setIsProcessing(true);
      const timer = setTimeout(() => {
        processImageToPattern(imageSrc, gridWidth, gridHeight, activePalette.colors, appliedDenoiseLevel)
          .then((data) => {
            setPatternData(data);
            setIsProcessing(false);
          })
          .catch((err) => {
            console.error(err);
            setIsProcessing(false);
          });
      }, 100); // Small delay to allow UI to update
      return () => clearTimeout(timer);
    }
  }, [imageSrc, gridWidth, gridHeight, activePalette, appliedDenoiseLevel]); // Use appliedDenoiseLevel

  const handleMaterialExport = async () => {
    if (!patternData) return;
    
    await ExportController.exportMaterialList({
        siteLabel,
        translations: t
    }, {
        patternData,
        activePaletteColors: activePalette.colors,
        hiddenBeadIds,
        excludeHiddenMaterials
    });

    setShowMaterialExportModal(false);
  };

  // Helper to recalculate counts after edits
  const recalculateCounts = (grid: BeadColor[][]): Record<string, number> => {
    const newCounts: Record<string, number> = {};
    grid.forEach(row => {
      row.forEach(bead => {
        newCounts[bead.id] = (newCounts[bead.id] || 0) + 1;
      });
    });
    return newCounts;
  };

  // Replace Logic
  const handleColorReplace = (newBead: BeadColor) => {
    if (!patternData || !pickingColorFor) return;

    const newGrid = patternData.grid.map(row => [...row]); // Deep copy grid structure

    if (pickingColorFor.type === 'global' && pickingColorFor.targetId) {
      // Replace all instances
      for (let y = 0; y < newGrid.length; y++) {
        for (let x = 0; x < newGrid[y].length; x++) {
          if (newGrid[y][x].id === pickingColorFor.targetId) {
            newGrid[y][x] = newBead;
          }
        }
      }
    } else if (pickingColorFor.type === 'single' && pickingColorFor.x !== undefined && pickingColorFor.y !== undefined) {
      // Replace single pixel
      newGrid[pickingColorFor.y][pickingColorFor.x] = newBead;
    }

    const newCounts = recalculateCounts(newGrid);
    setPatternData({
      ...patternData,
      grid: newGrid,
      counts: newCounts
    });
    
    setPickingColorFor(null);
    setColorSearch('');
  };

  const handleFreeDrawSave = (newGrid: BeadColor[][]) => {
    if (!patternData) return;
    const newCounts = recalculateCounts(newGrid);
    const newHeight = newGrid.length;
    const newWidth = newGrid.length > 0 ? newGrid[0].length : 0;
    
    setPatternData({
      ...patternData,
      grid: newGrid,
      width: newWidth,
      height: newHeight,
      counts: newCounts
    });
    // Update gridWidth/gridHeight state as well to stay in sync
    setGridWidth(newWidth);
    setGridHeight(newHeight);
    
    setIsFreeDrawMode(false);
  };

  // Mirror Flip Handler
  const handleMirrorFlip = () => {
    if (!patternData) return;
    
    // Deep clone the grid and reverse each row
    const newGrid = patternData.grid.map(row => [...row].reverse());
    
    setPatternData({
        ...patternData,
        grid: newGrid
        // Width, Height, and Counts remain the same
    });
  };

  // AI Analysis Handler
  const handleAnalyze = async () => {
    if (!imageSrc) return;
    setIsAnalyzing(true);
    const analysis = await analyzeBeadPattern(imageSrc, language);
    setAiAnalysis(analysis);
    setIsAnalyzing(false);
  };

  // Canvas Drawing
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (patternData && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const cellSize = 12; 
      
      canvas.width = patternData.width * cellSize;
      canvas.height = patternData.height * cellSize;

      // Clear entire canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      patternData.grid.forEach((row, y) => {
        row.forEach((bead, x) => {
          // Skip if hidden
          if (hiddenBeadIds.has(bead.id)) return;

          ctx.fillStyle = bead.hex;
          if (beadShape === 'round') {
             ctx.beginPath();
             ctx.arc(
               x * cellSize + cellSize / 2, 
               y * cellSize + cellSize / 2, 
               (cellSize / 2) - 0.5, 
               0, 
               2 * Math.PI
             );
             ctx.fill();
          } else {
             ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          }
        });
      });

      // Overlay Grid (Inverted) - Match Export Style
      ctx.save();
      ctx.globalCompositeOperation = 'difference';
      ctx.strokeStyle = '#FFFFFF';

      // Vertical
      for (let x = 0; x <= patternData.width; x++) {
        let lineWidth = 0;
        if (x % 10 === 0) lineWidth = 1.5; // Slightly thinner for screen
        else if (x % 5 === 0) lineWidth = 0.5;
        
        if (lineWidth > 0) {
           ctx.lineWidth = lineWidth;
           ctx.beginPath();
           ctx.moveTo(x * cellSize, 0);
           ctx.lineTo(x * cellSize, canvas.height);
           ctx.stroke();
        }
      }

      // Horizontal
      for (let y = 0; y <= patternData.height; y++) {
        let lineWidth = 0;
        if (y % 10 === 0) lineWidth = 1.5;
        else if (y % 5 === 0) lineWidth = 0.5;
        
        if (lineWidth > 0) {
           ctx.lineWidth = lineWidth;
           ctx.beginPath();
           ctx.moveTo(0, y * cellSize);
           ctx.lineTo(canvas.width, y * cellSize);
           ctx.stroke();
        }
      }
      ctx.restore();
    }
  }, [patternData, beadShape, hiddenBeadIds]);

  // Zoom and Pan Handlers
  // Use ref to attach non-passive listener to prevent default scroll behavior
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      if (!patternData) return;
      e.preventDefault();
      const zoomSensitivity = 0.001;
      setZoom(prev => Math.min(Math.max(0.1, prev - e.deltaY * zoomSensitivity), 5));
    };

    // Passive: false is required to be able to call preventDefault()
    container.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', onWheel);
    };
  }, [patternData]); // Re-bind when patternData changes

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!patternData) return;
    setIsDragging(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - lastMousePos.x;
    const deltaY = e.clientY - lastMousePos.y;
    setPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch Handlers for Mobile
  const lastTouchDistance = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!patternData) return;
    
    if (e.touches.length === 1) {
        setIsDragging(true);
        setLastMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else if (e.touches.length === 2) {
        const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        lastTouchDistance.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!patternData) return;
    // Prevent default to stop scrolling/zooming the page
    // e.preventDefault(); // Note: React might complain about non-passive event, but in App.tsx it's often fine or handled via CSS touch-action

    if (e.touches.length === 1 && isDragging) {
        const deltaX = e.touches[0].clientX - lastMousePos.x;
        const deltaY = e.touches[0].clientY - lastMousePos.y;
        setPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
        setLastMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else if (e.touches.length === 2) {
        const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );

        if (lastTouchDistance.current !== null) {
            const delta = dist - lastTouchDistance.current;
            const zoomSensitivity = 0.005;
            const newZoom = Math.min(Math.max(0.1, zoom + delta * zoomSensitivity), 5);
            setZoom(newZoom);
        }
        lastTouchDistance.current = dist;
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    lastTouchDistance.current = null;
  };

  // Canvas Click for Pixel Editing
  const handleCanvasClick = (e: React.MouseEvent) => {
    // Only register click if we didn't drag
    if (isDragging) return; 
    // Small threshold to distinguish click from micro-drag
    const dist = Math.sqrt(Math.pow(e.clientX - lastMousePos.x, 2) + Math.pow(e.clientY - lastMousePos.y, 2));
    if (dist > 5) return;

    if (!patternData || !containerRef.current) return;

    // Calculate grid coordinates
    const rect = containerRef.current.getBoundingClientRect();
    const cellSize = 12;
    
    // Mouse relative to container center (since transformOrigin is center)
    // Actually simpler: mouse relative to container top-left
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Let's use the simpler approach: The visual offset is Pan + (GridSize * CellSize * Zoom / 2) logic.
    // Easiest way: The inner div center is at outer div center + pan.
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Coordinate relative to the center of the viewport
    const relX = mouseX - centerX;
    const relY = mouseY - centerY;
    
    // Subtract pan
    const unpannedX = relX - pan.x;
    const unpannedY = relY - pan.y;
    
    // Divide by zoom
    const unzoomedX = unpannedX / zoom;
    const unzoomedY = unpannedY / zoom;
    
    // Add back the half-size of the grid to get 0,0 at top left
    const gridPixelWidth = patternData.width * cellSize;
    const gridPixelHeight = patternData.height * cellSize;
    
    const canvasX = unzoomedX + (gridPixelWidth / 2);
    const canvasY = unzoomedY + (gridPixelHeight / 2);
    
    const gridX = Math.floor(canvasX / cellSize);
    const gridY = Math.floor(canvasY / cellSize);

    // Validate bounds
    if (gridX >= 0 && gridX < patternData.width && gridY >= 0 && gridY < patternData.height) {
      const bead = patternData.grid[gridY][gridX];
      setPickingColorFor({
        type: 'single',
        x: gridX,
        y: gridY,
        currentBead: bead
      });
    }
  };

  // Export with coordinates
  const handleDownload = async () => {
    if (!patternData) return;
    setIsExporting(true);
    
    try {
        await ExportController.handleDownload({
            siteLabel,
            translations: t
        }, {
            patternData,
            beadShape,
            hiddenBeadIds,
            isDualExport
        });
    } catch (error) {
        console.error("Export failed", error);
        alert("Export failed");
    } finally {
        setIsExporting(false);
    }
  };

  const handleSplitDownload = async () => {
    if (!patternData) return;
    setIsExporting(true);

    try {
      await ExportController.exportSplitPattern({
        siteLabel,
        translations: t
      }, {
        patternData,
        beadShape,
        hiddenBeadIds,
        splitConfig,
        isDualExport
      });
      
      setShowSplitModal(false);
    } catch (error) {
      console.error("Export failed", error);
      alert("Export failed");
    } finally {
      setIsExporting(false);
    }
  };



  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center gap-6 bg-[#e0e5ec]">
      {/* Header & Language Toggle */}
      <div className="w-full max-w-7xl flex flex-col md:flex-row justify-between items-center mb-2 gap-4">
        <div className="text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-700 tracking-tight">{t.appTitle}</h1>
            <p className="text-slate-500 font-medium text-sm md:text-base">{t.subtitle}</p>
        </div>
        
        {/* Language Toggle */}
        <div className="bg-[#e0e5ec] p-1.5 rounded-full shadow-[inset_4px_4px_8px_0_rgba(163,177,198,0.7),inset_-4px_-4px_8px_0_rgba(255,255,255,0.8)] flex">
           <button 
              onClick={() => setLanguage('zh')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${language === 'zh' ? 'bg-[#e0e5ec] shadow-[4px_4px_8px_0_rgba(163,177,198,0.7),-4px_-4px_8px_0_rgba(255,255,255,0.8)] text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
           >
              中文
           </button>
           <button 
              onClick={() => setLanguage('en')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${language === 'en' ? 'bg-[#e0e5ec] shadow-[4px_4px_8px_0_rgba(163,177,198,0.7),-4px_-4px_8px_0_rgba(255,255,255,0.8)] text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
           >
              EN
           </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Controls & Material List */}
        <div className="lg:col-span-4 flex flex-col gap-6 order-2 lg:order-1">
          
          {/* Controls */}
          <NeuCard className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-700">{t.config}</h2>
            
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-400 ml-2 uppercase">{t.uploadImage}</label>
              <NeuFileUpload accept="image/*" onChange={handleFileUpload}>
                {t.uploadImage}
              </NeuFileUpload>
            </div>

            {imageSrc && (
              <>
                <div className="flex flex-col gap-1">
                   <label className="text-xs font-bold text-slate-400 ml-2 uppercase">{t.palette}</label>
                   <div className="flex gap-2 items-center">
                     <NeuSelect 
                        value={selectedPaletteId} 
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'import_new') {
                                setShowCsvModal(true);
                            } else {
                                setSelectedPaletteId(val);
                            }
                        }}
                        className="flex-1"
                     >
                        {allPalettes.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.id.startsWith('custom_') ? `(${t.custom})` : ''}
                          </option>
                        ))}
                        <option value="import_new" className="font-bold text-blue-600">
                          + {t.importPalette}
                        </option>
                     </NeuSelect>
                     
                     {selectedPaletteId.startsWith('custom_') && (
                       <button
                         onClick={() => {
                           if (window.confirm(t.deletePaletteConfirm)) {
                             removeCustomPalette(selectedPaletteId);
                           }
                         }}
                         className="p-2 text-red-400 hover:text-red-600 transition-colors"
                         title={t.deletePalette}
                       >
                         <Icon icon="lucide:trash-2" className="w-5 h-5" />
                       </button>
                     )}
                   </div>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-end px-1">
                       <label className="text-xs font-bold text-slate-400 uppercase ml-1">{t.gridSize}</label>
                       <button 
                            onClick={() => setLockRatio(!lockRatio)}
                            className={`p-1.5 rounded-lg transition-all text-xs flex items-center gap-1 ${lockRatio ? 'bg-slate-300 text-slate-700 shadow-inner' : 'text-slate-400 hover:text-slate-600'}`}
                            title={lockRatio ? t.ratioLocked : t.ratioUnlocked}
                        >
                            {lockRatio ? (
                                <><Icon icon="lucide:lock" className="w-3 h-3" /> {t.ratioLocked}</>
                            ) : (
                                <><Icon icon="lucide:unlock" className="w-3 h-3" /> {t.ratioUnlocked}</>
                            )}
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex-1 relative">
                             <NeuInput 
                                type="number" 
                                value={gridWidth} 
                                onChange={(e) => handleWidthChange(e.target.value)}
                                min="1"
                                className="text-center font-mono w-full pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold pointer-events-none">{t.width}</span>
                        </div>
                        <span className="text-slate-400 font-bold text-sm">×</span>
                        <div className="flex-1 relative">
                            <NeuInput 
                                type="number" 
                                value={gridHeight} 
                                onChange={(e) => handleHeightChange(e.target.value)}
                                min="1"
                                className="text-center font-mono w-full pr-8"
                            />
                             <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold pointer-events-none">{t.height}</span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center px-2 py-1">
                   <label className="text-sm font-bold text-slate-500">{t.beadShape}</label>
                   <div className="flex bg-slate-200 rounded-lg p-1 shadow-inner">
                        <button 
                            onClick={() => setBeadShape('square')}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${beadShape === 'square' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {t.shapeSquare}
                        </button>
                        <button 
                            onClick={() => setBeadShape('round')}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${beadShape === 'round' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {t.shapeRound}
                        </button>
                   </div>
                </div>

                {/* Pattern Options: Mirror & Dual Export */}
                <div className="flex flex-col gap-3 px-1 py-2 border-t border-slate-300/50 border-b border-slate-300/50">
                   {/* Mirror Flip */}
                   <div className="flex items-center justify-between" title={t.mirrorFlipTooltip}>
                      <div 
                        className="flex items-center gap-1 cursor-help"
                        onClick={() => setInfoModal({
                            isOpen: true,
                            title: t.mirrorFlip,
                            content: t.mirrorFlipTooltip
                        })}
                      >
                         <label className="text-sm font-bold text-slate-600 shrink-0">{t.mirrorFlip}</label>
                         <Icon icon="lucide:info" className="w-4 h-4 text-slate-400" />
                      </div>
                      <NeuButton 
                         onClick={handleMirrorFlip}
                         className="!py-1.5 !px-3 text-xs flex items-center gap-1"
                      >
                         <Icon icon="lucide:flip-horizontal" className="w-4 h-4" />
                      </NeuButton>
                   </div>

                   {/* Dual Export */}
                   <div className="flex items-center justify-between" title={t.dualExportTooltip}>
                      <div className="flex items-center gap-1 cursor-help">
                         <label htmlFor="dualExportConfig" className="text-sm font-bold text-slate-600 shrink-0 cursor-pointer">{t.dualExport}</label>
                         <Icon 
                            icon="lucide:info" 
                            className="w-4 h-4 text-slate-400" 
                            onClick={(e) => {
                                e.preventDefault();
                                setInfoModal({
                                    isOpen: true,
                                    title: t.dualExport,
                                    content: t.dualExportTooltip
                                });
                            }}
                         />
                      </div>
                      <input 
                        type="checkbox" 
                        id="dualExportConfig"
                        checked={isDualExport} 
                        onChange={(e) => setIsDualExport(e.target.checked)}
                        className="w-5 h-5 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer shadow-sm bg-slate-100"
                      />
                   </div>
                </div>

                <div className="flex flex-col gap-1 px-1">
                   <NeuRange
                      label={t.denoiseLevel}
                      min="0"
                      max="10"
                      step="1"
                      value={denoiseLevel}
                      onChange={(e) => setDenoiseLevel(parseInt(e.target.value))}
                      valueDisplay={
                          denoiseLevel === 0 ? t.denoiseNone :
                          denoiseLevel <= 3 ? t.denoiseLow :
                          denoiseLevel <= 7 ? t.denoiseMed : t.denoiseHigh
                      }
                   />
                </div>

                <div className="pt-2">
                  <NeuButton 
                    onClick={handleAnalyze} 
                    disabled={isAnalyzing} 
                    className="w-full flex justify-center items-center gap-2 text-sm"
                  >
                    {isAnalyzing ? (
                      <span className="animate-pulse">{t.analyzing}</span>
                    ) : (
                      <>
                        <Icon icon="lucide:zap" className="w-4 h-4" />
                        {t.analyzeBtn}
                      </>
                    )}
                  </NeuButton>
                </div>
              </>
            )}
          </NeuCard>

          {/* AI Insights Panel */}
          {aiAnalysis && (
            <NeuCard className="bg-slate-200 border border-white/50">
               <div className="flex flex-col gap-2">
                  <h3 className="text-base font-bold text-slate-700">{aiAnalysis.title}</h3>
                  <p className="text-sm text-slate-600 italic">"{aiAnalysis.description}"</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                        aiAnalysis.difficulty.toLowerCase().includes('hard') ? 'bg-red-200 text-red-700' :
                        aiAnalysis.difficulty.toLowerCase().includes('medium') ? 'bg-yellow-200 text-yellow-700' :
                        'bg-green-200 text-green-700'
                    }`}>{aiAnalysis.difficulty}</span>
                     <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-700">
                        {aiAnalysis.suggestedUsage}
                     </span>
                  </div>
               </div>
            </NeuCard>
          )}

          {/* Materials List */}
          {patternData && (
            <NeuCard className="flex flex-col gap-4 max-h-[400px] overflow-hidden flex-1">
              <div className="flex justify-between items-end pb-2 border-b border-slate-300">
                <h2 className="text-lg font-bold text-slate-700">{t.materials}</h2>
                <span className="text-xs font-bold text-slate-400">
                  {t.visible}: {Object.entries(patternData.counts)
                    .filter(([id]) => !hiddenBeadIds.has(id))
                    .reduce((sum, [, count]) => sum + (count as number), 0)}
                </span>
              </div>
              
              <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-2 -mr-2">
                {activePalette.colors
                  .filter(b => patternData.counts[b.id])
                  .sort((a,b) => (patternData.counts[b.id] || 0) - (patternData.counts[a.id] || 0))
                  .map((bead) => {
                    const isHidden = hiddenBeadIds.has(bead.id);
                    return (
                      <div 
                        key={bead.id} 
                        className={`flex items-center justify-between p-2 rounded-lg transition-all border border-transparent hover:border-slate-300 cursor-pointer group ${isHidden ? 'bg-transparent opacity-50' : 'bg-slate-200/50 hover:bg-slate-200'}`}
                        onClick={() => {
                            setPickingColorFor({
                                type: 'global',
                                targetId: bead.id,
                                currentBead: bead
                            });
                        }}
                        title={t.clickToReplace}
                      >
                        <div className="flex items-center gap-3">
                           {/* Visibility Toggle */}
                          <button 
                             onClick={(e) => toggleBeadVisibility(bead.id, e)}
                             className="text-slate-400 hover:text-slate-600 focus:outline-none transition-colors p-1"
                             title={isHidden ? t.showBeads : t.hideBeads}
                          >
                             {isHidden ? (
                               <Icon icon="lucide:eye-off" className="w-4 h-4" />
                             ) : (
                               <Icon icon="lucide:eye" className="w-4 h-4" />
                             )}
                          </button>
                          
                          <div className="w-6 h-6 rounded-full border border-slate-300 shadow-sm relative group-hover:scale-110 transition-transform" style={{ backgroundColor: bead.hex }}>
                             {/* Edit Icon Overlay */}
                             <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 rounded-full transition-opacity">
                                <Icon icon="lucide:pencil" className="w-3 h-3 text-white" />
                             </div>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-700 leading-tight">{bead.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono leading-tight">{bead.id}</span>
                          </div>
                        </div>
                        <span className="font-bold text-slate-600 bg-slate-200/80 px-2 py-1 rounded-md min-w-[3rem] text-center text-xs">
                          {patternData.counts[bead.id]}
                        </span>
                      </div>
                    );
                })}
              </div>
            </NeuCard>
          )}
        </div>

        {/* Right Column: Canvas Preview */}
        <div className="lg:col-span-8 flex flex-col gap-6 order-1 lg:order-2 h-full">
          <NeuCard className="flex-1 min-h-[500px] flex items-center justify-center relative overflow-hidden p-0 bg-slate-200/50" >
            {!imageSrc ? (
               <div className="flex flex-col items-center gap-4 text-slate-400 p-8">
                 <Icon icon="lucide:image" className="w-24 h-24 opacity-20" />
                 <p className="font-bold text-lg opacity-50">{t.noImage}</p>
               </div>
            ) : (
              <div 
                ref={containerRef}
                className="w-full h-full absolute inset-0 overflow-hidden cursor-crosshair bg-[#e0e5ec] shadow-inner touch-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={handleCanvasClick}
              >
                 {/* Instructions overlay */}
                 <div className="absolute top-4 left-4 z-10 pointer-events-none opacity-40 hover:opacity-100 transition-opacity">
                    <div className="bg-slate-800/10 text-slate-500 text-[10px] px-2 py-1 rounded backdrop-blur-sm">
                        {t.zoomInstruction}
                    </div>
                 </div>

                 {/* Canvas Container with Transform */}
                 <div 
                    className="w-full h-full flex items-center justify-center transition-transform duration-75 ease-out"
                    style={{ 
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: 'center'
                    }}
                 >
                    <div className="relative shadow-xl shadow-slate-400/20">
                        {/* Processing Overlay */}
                        {isProcessing && (
                            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-200/50 backdrop-blur-sm rounded-lg animate-in fade-in duration-200">
                                <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin shadow-lg"></div>
                                <span className="mt-4 font-bold text-slate-600 animate-pulse">{t.processing}</span>
                            </div>
                        )}
                        {/* Checkerboard background for transparency */}
                        <div className="absolute inset-0 z-0 opacity-20" style={{ 
                            backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                            backgroundSize: '20px 20px',
                            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
                        }}></div>
                        <canvas ref={canvasRef} className="relative z-10 rounded-sm" />
                    </div>
                 </div>
                 
                 {/* Original Image Thumbnail */}
                 <div className="absolute bottom-4 right-4 w-20 h-20 p-1 bg-white/50 backdrop-blur-sm rounded-lg shadow-lg transform hover:scale-110 transition-transform duration-300 z-20 pointer-events-none">
                    <img src={imageSrc} className="w-full h-full object-cover rounded" alt="Original" />
                 </div>
                 
                 {/* Reset View Button */}
                 {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
                     <button 
                        onClick={(e) => { e.stopPropagation(); setZoom(1); setPan({x:0, y:0}); }}
                        className="absolute bottom-4 left-4 p-2 bg-white/80 rounded-full shadow-lg text-slate-600 hover:text-blue-500 z-20"
                        title={t.resetView}
                     >
                         <Icon icon="lucide:maximize" className="w-5 h-5" />
                     </button>
                 )}
              </div>
            )}
          </NeuCard>

          {/* Action Footer */}
          {patternData && (
             <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-4">
               <NeuButton 
                  onClick={() => setShowMaterialExportModal(true)}
                  className="flex items-center justify-center gap-2 shadow-lg bg-slate-100 text-slate-600 hover:text-slate-800 text-xs md:text-base px-2 md:px-6 py-3 md:py-2 w-full md:w-auto"
               >
                 <Icon icon="lucide:clipboard-list" className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                 <span className="truncate">{t.exportMaterials}</span>
               </NeuButton>

               <NeuButton 
                  onClick={() => setShowSplitModal(true)}
                  className="flex items-center justify-center gap-2 shadow-lg bg-slate-100 text-slate-600 hover:text-slate-800 text-xs md:text-base px-2 md:px-6 py-3 md:py-2 w-full md:w-auto"
               >
                 <Icon icon="lucide:grid" className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                 <span className="truncate">{t.downloadSplit}</span>
               </NeuButton>

               <NeuButton 
                  onClick={() => setIsFreeDrawMode(true)}
                  className="flex items-center justify-center gap-2 shadow-lg bg-blue-100 text-blue-700 hover:text-blue-900 text-xs md:text-base px-2 md:px-6 py-3 md:py-2 w-full md:w-auto"
               >
                 <Icon icon="lucide:palette" className="w-5 h-5 flex-shrink-0" />
                 <span className="truncate">{t.freeDrawBtn}</span>
               </NeuButton>

               <NeuButton 
                  onClick={handleDownload}
                  className="flex items-center justify-center gap-2 shadow-lg text-xs md:text-base px-2 md:px-6 py-3 md:py-2 w-full md:w-auto"
               >
                 <Icon icon="lucide:download" className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                 <span className="truncate">{t.download}</span>
               </NeuButton>
             </div>
          )}
        </div>
      </div>

      {/* Color Picker Modal */}
      <NeuModal
        isOpen={!!pickingColorFor}
        onClose={() => { setPickingColorFor(null); setColorSearch(''); }}
        title={pickingColorFor?.type === 'global' ? t.replaceGlobalTitle : t.editBeadTitle}
      >
        <div className="flex flex-col gap-4">
            
            {/* Mode Switcher (If in Single Mode, allow switching to global) */}
            {pickingColorFor?.type === 'single' && (
                <div className="flex p-1 bg-slate-200/50 rounded-xl">
                    <button 
                        className="flex-1 py-2 text-xs font-bold rounded-lg bg-white shadow-sm text-slate-700 transition-all"
                    >
                        {t.changeThisBtn}
                    </button>
                    <button 
                        className="flex-1 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-all"
                        onClick={() => setPickingColorFor(prev => prev ? { ...prev, type: 'global', targetId: prev.currentBead?.id } : null)}
                    >
                        {t.changeAllBtn} '{pickingColorFor.currentBead?.name}'
                    </button>
                </div>
            )}

            {/* Current Color Display */}
            <div className="flex items-center gap-3 p-3 bg-slate-200/50 rounded-xl border border-white/50">
                <div className="w-10 h-10 rounded-full border border-slate-300 shadow-sm" style={{ backgroundColor: pickingColorFor?.currentBead?.hex }}></div>
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-500 uppercase">{t.currentColor}</span>
                    <span className="font-bold text-slate-700">{pickingColorFor?.currentBead?.name} ({pickingColorFor?.currentBead?.id})</span>
                </div>
            </div>

            {/* Search */}
            <NeuInput 
                placeholder={t.searchPlaceholder}
                value={colorSearch}
                onChange={(e) => setColorSearch(e.target.value)}
                autoFocus
                className="text-sm"
            />

            {/* Color Grid */}
            <div className="grid grid-cols-4 gap-2 max-h-[300px] overflow-y-auto p-1">
                {activePalette.colors
                    .filter(c => 
                        c.name.toLowerCase().includes(colorSearch.toLowerCase()) || 
                        c.id.toLowerCase().includes(colorSearch.toLowerCase())
                    )
                    .map(color => (
                    <button
                        key={color.id}
                        onClick={() => handleColorReplace(color)}
                        className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-white/50 hover:shadow-md transition-all group"
                    >
                        <div className="w-8 h-8 rounded-full border border-slate-300 shadow-sm group-hover:scale-110 transition-transform" style={{ backgroundColor: color.hex }}></div>
                        <span className="text-[10px] font-bold text-slate-500 truncate w-full text-center">{color.name}</span>
                        <span className="text-[9px] text-slate-400 font-mono">{color.id}</span>
                    </button>
                ))}
            </div>
        </div>
      </NeuModal>

      {/* Split Download Modal */}
      <NeuModal
        isOpen={showSplitModal}
        onClose={() => setShowSplitModal(false)}
        title={t.splitTitle}
      >
        <div className="flex flex-col gap-6">
          <p className="text-sm text-slate-600">
            {patternData ? t.splitInfo
                .replace('{rows}', Math.ceil(patternData.height / splitConfig.height).toString())
                .replace('{cols}', Math.ceil(patternData.width / splitConfig.width).toString())
                .replace('{total}', (Math.ceil(patternData.height / splitConfig.height) * Math.ceil(patternData.width / splitConfig.width)).toString())
              : ''}
          </p>
          
          <div className="flex items-center gap-4">
             <div className="flex-1 min-w-0">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block truncate">{t.splitWidth}</label>
                <NeuInput 
                    type="number"
                    value={splitConfig.width}
                    onChange={(e) => setSplitConfig(prev => ({...prev, width: Number(e.target.value)}))}
                    min="10"
                    className="text-center w-full"
                />
             </div>
             <span className="text-slate-400 font-bold pt-6">×</span>
             <div className="flex-1 min-w-0">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block truncate">{t.splitHeight}</label>
                <NeuInput 
                    type="number"
                    value={splitConfig.height}
                    onChange={(e) => setSplitConfig(prev => ({...prev, height: Number(e.target.value)}))}
                    min="10"
                    className="text-center w-full"
                />
             </div>
          </div>

          <div className="flex justify-end pt-2">
             <NeuButton 
                onClick={handleSplitDownload}
                disabled={isExporting}
                className="flex items-center gap-2 w-full justify-center"
             >
                {isExporting ? (
                   <span className="animate-pulse">{t.processing}...</span>
                ) : (
                   <>
                     <Icon icon="lucide:file-archive" className="w-5 h-5" />
                     {t.exportZip}
                   </>
                )}
             </NeuButton>
          </div>
        </div>
      </NeuModal>

      {/* Info Modal */}
      <NeuModal
        isOpen={infoModal.isOpen}
        onClose={closeInfoModal}
        title={infoModal.title}
      >
        <div className="flex flex-col gap-4">
          <p className="text-slate-600 leading-relaxed text-sm md:text-base">
            {infoModal.content}
          </p>
          <div className="flex justify-end pt-2">
            <NeuButton onClick={closeInfoModal} className="w-full md:w-auto">
              OK
            </NeuButton>
          </div>
        </div>
      </NeuModal>

      {/* CSV Import Modal */}
      <NeuModal
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        title={t.importPalette}
      >
        <div className="flex flex-col gap-4">
          <NeuInput 
            value={csvName} 
            onChange={(e) => setCsvName(e.target.value)} 
            placeholder={t.paletteName} 
          />
          <div className="flex flex-col gap-1">
             <label className="text-xs font-bold text-slate-400 ml-1">{t.uploadCsv}</label>
             <NeuFileUpload onChange={handleCsvUpload} accept=".csv">
               {csvFile ? csvFile.name : t.uploadCsv}
             </NeuFileUpload>
          </div>
          <p className="text-xs text-slate-400">
            {t.csvFormatInfo}
          </p>
          <NeuButton onClick={handleImportCsv} disabled={!csvFile || !csvName}>
            {t.addPalette}
          </NeuButton>
        </div>
      </NeuModal>

      {/* Material Export Modal */}
      <NeuModal
        isOpen={showMaterialExportModal}
        onClose={() => setShowMaterialExportModal(false)}
        title={t.exportMaterials}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">{t.exportMaterialsDesc}</p>
          <div className="flex items-center gap-2 p-3 bg-slate-200/50 rounded-xl">
            <input 
              type="checkbox" 
              id="excludeHidden"
              checked={excludeHiddenMaterials} 
              onChange={(e) => setExcludeHiddenMaterials(e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="excludeHidden" className="text-sm font-bold text-slate-700 cursor-pointer select-none flex-1">
              {t.excludeHidden}
            </label>
          </div>
          <div className="flex justify-end pt-2">
            <NeuButton onClick={handleMaterialExport} className="w-full justify-center">
              {t.exportMaterials}
            </NeuButton>
          </div>
        </div>
      </NeuModal>

      {/* Image Cropper */}
      {isCropping && originalImageSrc && (
        <ImageCropper
          imageSrc={originalImageSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
          t={t}
        />
      )}

      {/* Free Draw Editor */}
      {isFreeDrawMode && patternData && (
        <FreeDrawEditor
          patternData={patternData}
          palette={activePalette.colors}
          onSave={handleFreeDrawSave}
          onCancel={() => setIsFreeDrawMode(false)}
          t={t}
        />
      )}

      {/* Donation Modal */}
      <NeuModal
        isOpen={showDonationModal}
        onClose={() => setShowDonationModal(false)}
        title={t.donationModalTitle}
      >
        <div className="flex flex-col items-center justify-center gap-4 p-4">
          <div className="w-64 h-64 bg-white p-2 rounded-xl shadow-inner flex items-center justify-center">
             <img src="/alipay.jpg" alt="Alipay QR Code" className="w-full h-full object-contain" />
          </div>
          <p className="text-slate-500 text-center text-sm font-medium flex items-center justify-center gap-2">
            {t.footerBuyMeCoffee} <Icon icon="lucide:heart" className="w-4 h-4 text-red-500 fill-current" />
          </p>
        </div>
      </NeuModal>

      {/* Footer */}
      <footer className="w-full max-w-7xl flex flex-col md:flex-row justify-between items-center gap-4 mt-12 pb-8 text-slate-500 border-t border-slate-300/50 pt-8">
        <div className="flex items-center gap-4 text-sm font-medium">
          <a href="https://blog.str1ct.top/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-700 flex items-center gap-2 transition-colors">
             <Icon icon="lucide:book-open" className="w-5 h-5" />
             <span>{t.footerBlog}</span>
          </a>
          <span className="text-slate-300">•</span>
          <a href="https://github.com/pengGgxp/PerlerGen" target="_blank" rel="noopener noreferrer" className="hover:text-slate-700 flex items-center gap-2 transition-colors">
            <Icon icon="lucide:github" className="w-5 h-5" />
            <span>{t.footerOpenSource}</span>
          </a>
          <span className="text-slate-300">•</span>
          <a href="https://github.com/pengGgxp/PerlerGen" target="_blank" rel="noopener noreferrer" className="hover:text-yellow-500 flex items-center gap-1 transition-colors">
             <Icon icon="lucide:star" className="w-4 h-4" />
             {t.footerStar}
          </a>
        </div>
        
        <NeuButton 
          onClick={() => setShowDonationModal(true)}
          className="!px-5 !py-2 text-sm flex items-center gap-2 font-bold text-slate-600 hover:text-pink-500"
        >
          <Icon icon="lucide:coffee" className="w-4 h-4" /> {t.footerBuyMeCoffee}
        </NeuButton>
      </footer>

    </div>
  );
};

export default App;
