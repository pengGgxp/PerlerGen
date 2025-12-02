import React, { useState, useEffect, useRef } from 'react';
import { NeuCard, NeuButton, NeuInput, NeuSelect, NeuModal } from './components/NeumorphicComponents';
import { processImageToPattern } from './services/imageProcessor';
import { analyzeBeadPattern } from './services/gemini';
import { PatternData, AIAnalysis, BeadColor } from './types';
import { AVAILABLE_PALETTES } from './constants';

const App = () => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  
  // Grid Dimensions State
  const [gridWidth, setGridWidth] = useState<number>(29);
  const [gridHeight, setGridHeight] = useState<number>(29);
  const [lockRatio, setLockRatio] = useState<boolean>(true);
  const [imgAspectRatio, setImgAspectRatio] = useState<number>(1);

  // Palette State
  const [selectedPaletteId, setSelectedPaletteId] = useState<string>(AVAILABLE_PALETTES[0].id);

  const [patternData, setPatternData] = useState<PatternData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showGridLines, setShowGridLines] = useState(true);

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

  // Derived state for active palette
  const activePalette = AVAILABLE_PALETTES.find(p => p.id === selectedPaletteId) || AVAILABLE_PALETTES[0];

  // File Upload Handler
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setImageSrc(result);
        setPatternData(null); 
        setAiAnalysis(null);
        setHiddenBeadIds(new Set()); 
        setZoom(1);
        setPan({ x: 0, y: 0 });
      };
      reader.readAsDataURL(file);
    }
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
        processImageToPattern(imageSrc, gridWidth, gridHeight, activePalette.colors)
          .then((data) => {
            setPatternData(data);
            setIsProcessing(false);
          })
          .catch((err) => {
            console.error(err);
            setIsProcessing(false);
          });
      }, 500); // Debounce
      return () => clearTimeout(timer);
    }
  }, [imageSrc, gridWidth, gridHeight, activePalette]); // Removed patternData dependency to avoid loops

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

  // AI Analysis Handler
  const handleAnalyze = async () => {
    if (!imageSrc) return;
    setIsAnalyzing(true);
    const analysis = await analyzeBeadPattern(imageSrc);
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
          if (showGridLines) {
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
    }
  }, [patternData, showGridLines, hiddenBeadIds]);

  // Zoom and Pan Handlers
  const handleWheel = (e: React.WheelEvent) => {
    if (!patternData) return;
    e.preventDefault();
    const zoomSensitivity = 0.001;
    const newZoom = Math.min(Math.max(0.1, zoom - e.deltaY * zoomSensitivity), 5);
    setZoom(newZoom);
  };

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

    // Apply inverse transforms
    // Note: The container 'div' holding the canvas has the transform.
    // The rect is the *viewport* of that container.
    // We need the offset relative to the center of the container if origin is center, 
    // BUT we set transform on the inner div.
    
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

    // Settings for the export image
    const cellSize = 20; // Larger than screen for better quality
    const margin = 35; // Space for labels
    const width = patternData.width * cellSize + margin;
    const height = patternData.height * cellSize + margin;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Setup Text
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#64748b'; // Slate-500

    // Draw Top Numbers (Columns)
    for (let x = 0; x < patternData.width; x++) {
        // Label every 5th, plus the 1st
        if ((x + 1) === 1 || (x + 1) % 5 === 0) {
            ctx.fillText(`${x + 1}`, margin + x * cellSize + cellSize / 2, margin / 2);
        }
    }

    // Draw Left Numbers (Rows)
    for (let y = 0; y < patternData.height; y++) {
        if ((y + 1) === 1 || (y + 1) % 5 === 0) {
            ctx.fillText(`${y + 1}`, margin / 2, margin + y * cellSize + cellSize / 2);
        }
    }

    // Move to grid area
    ctx.translate(margin, margin);

    // Draw Grid
    patternData.grid.forEach((row, y) => {
        row.forEach((bead, x) => {
            // Background grid cell border
            ctx.strokeStyle = '#e2e8f0'; // Light grey
            ctx.lineWidth = 1;
            ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);

            if (!hiddenBeadIds.has(bead.id)) {
                ctx.fillStyle = bead.hex;
                // Draw Bead
                if (showGridLines) {
                    ctx.beginPath();
                    ctx.arc(
                        x * cellSize + cellSize / 2, 
                        y * cellSize + cellSize / 2, 
                        (cellSize / 2) - 1.5, 
                        0, 
                        2 * Math.PI
                    );
                    ctx.fill();
                } else {
                    ctx.fillRect(x * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2);
                }
            } else {
                // If hidden, maybe just a cross or empty? Leaving empty.
            }
        });
    });

    // Add darker lines every 10 cells for easy counting
    ctx.strokeStyle = '#94a3b8'; // Slate-400
    ctx.lineWidth = 2;
    // Verticals
    for (let i = 0; i <= patternData.width; i += 10) {
         ctx.beginPath();
         ctx.moveTo(i * cellSize, 0);
         ctx.lineTo(i * cellSize, patternData.height * cellSize);
         ctx.stroke();
    }
    // Horizontals
    for (let i = 0; i <= patternData.height; i += 10) {
         ctx.beginPath();
         ctx.moveTo(0, i * cellSize);
         ctx.lineTo(patternData.width * cellSize, i * cellSize);
         ctx.stroke();
    }

    // Border around the whole grid
    ctx.strokeRect(0, 0, patternData.width * cellSize, patternData.height * cellSize);

    // Trigger Download
    const link = document.createElement('a');
    link.download = `perler-pattern-w${patternData.width}-h${patternData.height}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center gap-6 bg-[#e0e5ec]">
      {/* Header */}
      <div className="text-center mb-2">
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-700 tracking-tight">PerlerGen AI</h1>
        <p className="text-slate-500 font-medium text-sm md:text-base">Magic Pixel Art Generator</p>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Controls & Material List */}
        <div className="lg:col-span-4 flex flex-col gap-6 order-2 lg:order-1">
          
          {/* Controls */}
          <NeuCard className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-700">Config</h2>
            
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-400 ml-2 uppercase">Image Source</label>
              <NeuInput type="file" accept="image/*" onChange={handleFileUpload} className="text-sm" />
            </div>

            {imageSrc && (
              <>
                <div className="flex flex-col gap-1">
                   <label className="text-xs font-bold text-slate-400 ml-2 uppercase">Bead Palette</label>
                   <NeuSelect 
                      value={selectedPaletteId} 
                      onChange={(e) => setSelectedPaletteId(e.target.value)}
                   >
                      {AVAILABLE_PALETTES.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                   </NeuSelect>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-end px-1">
                       <label className="text-xs font-bold text-slate-400 uppercase ml-1">Grid Size</label>
                       <button 
                            onClick={() => setLockRatio(!lockRatio)}
                            className={`p-1.5 rounded-lg transition-all text-xs flex items-center gap-1 ${lockRatio ? 'bg-slate-300 text-slate-700 shadow-inner' : 'text-slate-400 hover:text-slate-600'}`}
                            title={lockRatio ? "Ratio Locked" : "Ratio Unlocked"}
                        >
                            {lockRatio ? (
                                <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> Locked</>
                            ) : (
                                <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg> Unlocked</>
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
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold pointer-events-none">W</span>
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
                             <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold pointer-events-none">H</span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center px-2 py-1">
                   <label className="text-sm font-bold text-slate-500">Circular Beads</label>
                   <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                        <input 
                            type="checkbox" 
                            name="toggle" 
                            id="toggle" 
                            checked={showGridLines}
                            onChange={(e) => setShowGridLines(e.target.checked)}
                            className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 right-5 transition-all duration-300 shadow-sm"
                        />
                        <label htmlFor="toggle" className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer shadow-inner ${showGridLines ? 'bg-slate-300' : 'bg-slate-200'}`}></label>
                    </div>
                </div>

                <div className="pt-2">
                  <NeuButton 
                    onClick={handleAnalyze} 
                    disabled={isAnalyzing} 
                    className="w-full flex justify-center items-center gap-2 text-sm"
                  >
                    {isAnalyzing ? (
                      <span className="animate-pulse">Analyzing...</span>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        Get AI Ideas
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
                <h2 className="text-lg font-bold text-slate-700">Materials</h2>
                <span className="text-xs font-bold text-slate-400">
                  Visible: {Object.entries(patternData.counts)
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
                        title="Click to replace color"
                      >
                        <div className="flex items-center gap-3">
                           {/* Visibility Toggle */}
                          <button 
                             onClick={(e) => toggleBeadVisibility(bead.id, e)}
                             className="text-slate-400 hover:text-slate-600 focus:outline-none transition-colors p-1"
                             title={isHidden ? "Show beads" : "Hide beads"}
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
                 <p className="font-bold text-lg opacity-50">Upload an image to start</p>
               </div>
            ) : (
              <div 
                ref={containerRef}
                className="w-full h-full absolute inset-0 overflow-hidden cursor-crosshair bg-[#e0e5ec] shadow-inner"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={handleCanvasClick}
              >
                 {/* Instructions overlay */}
                 <div className="absolute top-4 left-4 z-10 pointer-events-none opacity-40 hover:opacity-100 transition-opacity">
                    <div className="bg-slate-800/10 text-slate-500 text-[10px] px-2 py-1 rounded backdrop-blur-sm">
                        Scroll: Zoom • Drag: Pan • Click: Edit
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
                        title="Reset View"
                     >
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                     </button>
                 )}
              </div>
            )}
          </NeuCard>

          {/* Action Footer */}
          {patternData && (
             <div className="flex justify-end">
               <NeuButton 
                  onClick={handleDownload}
                  className="flex items-center gap-2 shadow-lg"
               >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                 Download Pattern
               </NeuButton>
             </div>
          )}
        </div>
      </div>

      {/* Color Picker Modal */}
      <NeuModal
        isOpen={!!pickingColorFor}
        onClose={() => { setPickingColorFor(null); setColorSearch(''); }}
        title={pickingColorFor?.type === 'global' ? 'Replace Color Globally' : 'Edit Bead'}
      >
        <div className="flex flex-col gap-4">
            
            {/* Mode Switcher (If in Single Mode, allow switching to global) */}
            {pickingColorFor?.type === 'single' && (
                <div className="flex p-1 bg-slate-200/50 rounded-xl">
                    <button 
                        className="flex-1 py-2 text-xs font-bold rounded-lg bg-white shadow-sm text-slate-700 transition-all"
                    >
                        Change This Bead
                    </button>
                    <button 
                        className="flex-1 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-all"
                        onClick={() => setPickingColorFor(prev => prev ? { ...prev, type: 'global', targetId: prev.currentBead?.id } : null)}
                    >
                        Change All '{pickingColorFor.currentBead?.name}'
                    </button>
                </div>
            )}

            {/* Current Color Display */}
            <div className="flex items-center gap-3 p-3 bg-slate-200/50 rounded-xl border border-white/50">
                <div className="w-10 h-10 rounded-full border border-slate-300 shadow-sm" style={{ backgroundColor: pickingColorFor?.currentBead?.hex }}></div>
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-500 uppercase">Current Color</span>
                    <span className="font-bold text-slate-700">{pickingColorFor?.currentBead?.name} ({pickingColorFor?.currentBead?.id})</span>
                </div>
            </div>

            {/* Search */}
            <NeuInput 
                placeholder="Search colors..." 
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

    </div>
  );
};

export default App;