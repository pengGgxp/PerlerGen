
import React, { useState, useEffect, useRef } from 'react';
import { NeuCard, NeuButton, NeuInput, NeuSelect, NeuModal, NeuFileUpload, NeuRange } from './components/NeumorphicComponents';
import { processImageToPattern } from './services/imageProcessor';
import { analyzeBeadPattern } from './services/gemini';
import { drawPatternToCanvas, drawMaterialListToCanvas } from './services/exportUtils';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { PatternData, AIAnalysis, BeadColor } from './types';

import { translations, Language } from './translations';
import { usePalette } from './context/PaletteContext';
import { parsePaletteCSV } from './services/csvUtils';
import { ImageCropper } from './components/ImageCropper';
import { FreeDrawEditor } from './components/FreeDrawEditor';

const App = () => {
  const [language, setLanguage] = useState<Language>('zh'); // Default to Chinese
  const t = translations[language];
  
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
  const [beadShape, setBeadShape] = useState<'round' | 'square'>('round');
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

  // Free Draw State
  const [isFreeDrawMode, setIsFreeDrawMode] = useState(false);

  // Derived state for active palette - MOVED TO CONTEXT
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

  const handleMaterialExport = () => {
    if (!patternData) return;
    
    const canvas = drawMaterialListToCanvas(
        patternData,
        activePalette.colors,
        hiddenBeadIds,
        excludeHiddenMaterials,
        `${t.appTitle} - ${t.materials}`
    );

    if (canvas) {
        canvas.toBlob((blob) => {
            if (blob) {
                saveAs(blob, `perler-materials-${patternData.width}x${patternData.height}.png`);
                setShowMaterialExportModal(false);
            }
        });
    }
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
  const handleDownload = () => {
    if (!patternData) return;

    if (isDualExport) {
        handleDualExport();
        return;
    }

    const canvas = drawPatternToCanvas(patternData, {
      startX: 0,
      startY: 0,
      width: patternData.width,
      height: patternData.height,
      beadShape,
      hiddenBeadIds,
      title: `${t.appTitle} - ${patternData.width}x${patternData.height}`
    });

    if (!canvas) return;

    // Trigger Download
    const link = document.createElement('a');
    link.download = `perler-pattern-w${patternData.width}-h${patternData.height}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleSplitDownload = async () => {
    if (!patternData) return;
    setIsExporting(true);

    try {
      const zip = new JSZip();
      const { width: chunkW, height: chunkH } = splitConfig;
      
      const rows = Math.ceil(patternData.height / chunkH);
      const cols = Math.ceil(patternData.width / chunkW);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
           const startX = c * chunkW;
           const startY = r * chunkH;
           const currentWidth = Math.min(chunkW, patternData.width - startX);
           const currentHeight = Math.min(chunkH, patternData.height - startY);

           const canvas = drawPatternToCanvas(patternData, {
             startX,
             startY,
             width: currentWidth,
             height: currentHeight,
             beadShape,
             hiddenBeadIds,
             title: isDualExport 
                ? `P1 - ${t.appTitle} (${r + 1}-${c + 1})`
                : `${t.appTitle} - ${r + 1}-${c + 1}`
           });

           if (canvas) {
             const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve));
             if (blob) {
               zip.file(isDualExport ? `P1_row${r+1}_col${c+1}.png` : `pattern_row${r+1}_col${c+1}.png`, blob);
             }
           }

           // If Dual Export is enabled, generate P2 chunk (Rotated Text)
           if (isDualExport) {
             const canvasP2 = drawPatternToCanvas(patternData, {
                startX,
                startY,
                width: currentWidth,
                height: currentHeight,
                beadShape,
                hiddenBeadIds,
                title: `P2 - ${t.appTitle} (${r + 1}-${c + 1})`,
                rotation: 180
             });

             if (canvasP2) {
                const blobP2 = await new Promise<Blob | null>(resolve => canvasP2.toBlob(resolve));
                if (blobP2) {
                    zip.file(`P2_row${r+1}_col${c+1}.png`, blobP2);
                }
             }
           }
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "perler-pattern-split.zip");
      setShowSplitModal(false);
    } catch (error) {
      console.error("Export failed", error);
      alert("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDualExport = async () => {
    if (!patternData) return;
    setIsExporting(true);

    try {
      const zip = new JSZip();

      // 1. Normal View (Player 1)
      const canvas1 = drawPatternToCanvas(patternData, {
        startX: 0,
        startY: 0,
        width: patternData.width,
        height: patternData.height,
        beadShape,
        hiddenBeadIds,
        title: `${t.appTitle} - P1 (Normal)`
      });

      if (canvas1) {
        const blob1 = await new Promise<Blob | null>(resolve => canvas1.toBlob(resolve));
        if (blob1) zip.file(`pattern_p1_normal.png`, blob1);
      }

      // 2. Rotated View (Player 2)
      // Pattern is Unchanged (Original Grid)
      // Text is Rotated 180 (So P2 can read it when sitting opposite)
      // When P2 reads the text correctly, the paper is effectively upside down relative to P1.
      // And the Pattern appears rotated 180 to P1 (which is correct for P2's view).
      
      const canvas2 = drawPatternToCanvas(patternData, {
        startX: 0,
        startY: 0,
        width: patternData.width,
        height: patternData.height,
        beadShape,
        hiddenBeadIds,
        title: `${t.appTitle} - P2 (Face-to-Face 180°)`,
        rotation: 180
      });

      if (canvas2) {
        const blob2 = await new Promise<Blob | null>(resolve => canvas2.toBlob(resolve));
        if (blob2) zip.file(`pattern_p2_rotated_text.png`, blob2);
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "perler-pattern-dual-coop.zip");

    } catch (error) {
      console.error("Dual export failed", error);
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
                           if (window.confirm('Are you sure you want to delete this palette?')) {
                             removeCustomPalette(selectedPaletteId);
                           }
                         }}
                         className="p-2 text-red-400 hover:text-red-600 transition-colors"
                         title={t.deletePalette}
                       >
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
                                <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> {t.ratioLocked}</>
                            ) : (
                                <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg> {t.ratioUnlocked}</>
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
                      <div className="flex items-center gap-1 cursor-help">
                         <label className="text-sm font-bold text-slate-500">{t.mirrorFlip}</label>
                         <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <NeuButton 
                         onClick={handleMirrorFlip}
                         className="!py-1.5 !px-3 text-xs flex items-center gap-1"
                      >
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                      </NeuButton>
                   </div>

                   {/* Dual Export */}
                   <div className="flex items-center justify-between" title={t.dualExportTooltip}>
                      <div className="flex items-center gap-1 cursor-help">
                         <label htmlFor="dualExportConfig" className="text-sm font-bold text-slate-500 cursor-pointer">{t.dualExport}</label>
                         <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
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
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
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
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                             ) : (
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                             )}
                          </button>
                          
                          <div className="w-6 h-6 rounded-full border border-slate-300 shadow-sm relative group-hover:scale-110 transition-transform" style={{ backgroundColor: bead.hex }}>
                             {/* Edit Icon Overlay */}
                             <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 rounded-full transition-opacity">
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
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
                 <svg className="w-24 h-24 opacity-20" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
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
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                     </button>
                 )}
              </div>
            )}
          </NeuCard>

          {/* Action Footer */}
          {patternData && (
             <div className="flex justify-end gap-4">
               <NeuButton 
                  onClick={() => setShowMaterialExportModal(true)}
                  className="flex items-center gap-2 shadow-lg bg-slate-100 text-slate-600 hover:text-slate-800"
               >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                 {t.exportMaterials}
               </NeuButton>

               <NeuButton 
                  onClick={() => setShowSplitModal(true)}
                  className="flex items-center gap-2 shadow-lg bg-slate-100 text-slate-600 hover:text-slate-800"
               >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                 {t.downloadSplit}
               </NeuButton>

               <NeuButton 
                  onClick={() => setIsFreeDrawMode(true)}
                  className="flex items-center gap-2 shadow-lg bg-blue-100 text-blue-700 hover:text-blue-900"
               >
                 <span className="text-lg">🎨</span>
                 {t.freeDrawBtn}
               </NeuButton>

               <NeuButton 
                  onClick={handleDownload}
                  className="flex items-center gap-2 shadow-lg"
               >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                 {t.download}
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
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                     {t.exportZip}
                   </>
                )}
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
          <p className="text-slate-500 text-center text-sm font-medium">
            {t.footerBuyMeCoffee} ❤️
          </p>
        </div>
      </NeuModal>

      {/* Footer */}
      <footer className="w-full max-w-7xl flex flex-col md:flex-row justify-between items-center gap-4 mt-12 pb-8 text-slate-500 border-t border-slate-300/50 pt-8">
        <div className="flex items-center gap-4 text-sm font-medium">
          <a href="https://blog.str1ct.top/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-700 flex items-center gap-2 transition-colors">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
             <span>{t.footerBlog}</span>
          </a>
          <span className="text-slate-300">•</span>
          <a href="https://github.com/pengGgxp/PerlerGen" target="_blank" rel="noopener noreferrer" className="hover:text-slate-700 flex items-center gap-2 transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
            <span>{t.footerOpenSource}</span>
          </a>
          <span className="text-slate-300">•</span>
          <a href="https://github.com/pengGgxp/PerlerGen" target="_blank" rel="noopener noreferrer" className="hover:text-yellow-500 flex items-center gap-1 transition-colors">
             <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
             {t.footerStar}
          </a>
        </div>
        
        <NeuButton 
          onClick={() => setShowDonationModal(true)}
          className="!px-5 !py-2 text-sm flex items-center gap-2 font-bold text-slate-600 hover:text-pink-500"
        >
          <span>🧋</span> {t.footerBuyMeCoffee}
        </NeuButton>
      </footer>

    </div>
  );
};

export default App;
