import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Icon } from '@iconify/react';
import { NeuCard, NeuButton, NeuSelect, NeuModal } from './NeumorphicComponents';
import { BeadColor, PatternData } from '../types';
import { translations } from '../translations';

interface FreeDrawEditorProps {
  patternData: PatternData;
  palette: BeadColor[];
  onSave: (newGrid: BeadColor[][]) => void;
  onCancel: () => void;
  t: typeof translations['en'];
}

type Tool = 'pencil' | 'bucket' | 'eraser' | 'picker';

export const FreeDrawEditor: React.FC<FreeDrawEditorProps> = ({
  patternData,
  palette,
  onSave,
  onCancel,
  t,
}) => {
  // State
  const [grid, setGrid] = useState<BeadColor[][]>(() => {
    // Deep copy grid
    return patternData.grid.map(row => [...row]);
  });
  
  // History
  const [history, setHistory] = useState<BeadColor[][][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Tools
  const [selectedTool, setSelectedTool] = useState<Tool>('pencil');
  const [selectedColor, setSelectedColor] = useState<BeadColor>(palette[0]);
  const [eraserColor, setEraserColor] = useState<BeadColor>(
    palette.find(c => c.hex.toLowerCase() === '#ffffff') || palette[0]
  );

  // Canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  // Touch State
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number, y: number } | null>(null);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showEraserPicker, setShowEraserPicker] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [popoverCoords, setPopoverCoords] = useState({ x: 0, bottom: 0 });

  const toggleColorPicker = (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setPopoverCoords({
          x: rect.left + rect.width / 2,
          bottom: window.innerHeight - rect.top + 8
      });
      setShowColorPicker(!showColorPicker);
      setShowEraserPicker(false);
  };

  const toggleEraserPicker = (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setPopoverCoords({
          x: rect.left + rect.width / 2,
          bottom: window.innerHeight - rect.top + 8
      });
      setShowEraserPicker(!showEraserPicker);
      setShowColorPicker(false);
  };

  // Initialize History
  useEffect(() => {
    if (history.length === 0) {
      setHistory([grid]);
      setHistoryIndex(0);
    }
  }, []);

  // Save to history
  const pushToHistory = (newGrid: BeadColor[][]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newGrid);
    // Limit history size if needed, e.g., 20 steps
    if (newHistory.length > 20) {
      newHistory.shift();
    }
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setGrid(newGrid);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setGrid(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setGrid(history[historyIndex + 1]);
    }
  };

  // Canvas Drawing Logic
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentHeight = grid.length;
    const currentWidth = grid.length > 0 ? grid[0].length : 0;

    const cellSize = 20 * zoom;
    const width = currentWidth * cellSize;
    const height = currentHeight * cellSize;

    canvas.width = canvas.parentElement?.clientWidth || 800;
    canvas.height = canvas.parentElement?.clientHeight || 600;

    // Clear background
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply Pan
    ctx.save();
    ctx.translate(pan.x, pan.y);

    // Draw Grid
    grid.forEach((row, y) => {
      row.forEach((bead, x) => {
        ctx.fillStyle = bead.hex;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      });
    });

    // Draw Grid Lines
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    
    // Vertical
    for (let x = 0; x <= currentWidth; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, height);
      ctx.stroke();
    }
    // Horizontal
    for (let y = 0; y <= currentHeight; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(width, y * cellSize);
      ctx.stroke();
    }

    ctx.restore();
  }, [grid, zoom, pan]);

  useEffect(() => {
    requestAnimationFrame(drawCanvas);
  }, [drawCanvas]);

  // Tool Logic
  const getGridPos = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left - pan.x;
    const y = clientY - rect.top - pan.y;
    const cellSize = 20 * zoom;
    
    const gridX = Math.floor(x / cellSize);
    const gridY = Math.floor(y / cellSize);

    if (gridX >= 0 && gridX < patternData.width && gridY >= 0 && gridY < patternData.height) {
      return { x: gridX, y: gridY };
    }
    return null;
  };

  const handleToolAction = (clientX: number, clientY: number, isClick: boolean = false) => {
      const pos = getGridPos(clientX, clientY);
      if (!pos) return;

      if (isClick) {
        if (selectedTool === 'picker') {
            const bead = grid[pos.y][pos.x];
            setSelectedColor(bead);
            setSelectedTool('pencil'); 
            return;
        }

        if (selectedTool === 'bucket') {
            const targetColor = grid[pos.y][pos.x];
            const replaceColor = selectedColor;
            
            if (targetColor.id === replaceColor.id) return;

            const newGrid = grid.map(row => [...row]);
            const stack = [{x: pos.x, y: pos.y}];
            const visited = new Set<string>();
            
            while (stack.length > 0) {
                const {x, y} = stack.pop()!;
                const key = `${x},${y}`;
                if (visited.has(key)) continue;
                visited.add(key);

                if (newGrid[y][x].id === targetColor.id) {
                    newGrid[y][x] = replaceColor;
                    
                    if (x > 0) stack.push({x: x-1, y});
                    if (x < patternData.width - 1) stack.push({x: x+1, y});
                    if (y > 0) stack.push({x, y: y-1});
                    if (y < patternData.height - 1) stack.push({x, y: y+1});
                }
            }
            pushToHistory(newGrid);
            return;
        }
      }

      setIsDrawing(true);
      applyTool(pos.x, pos.y);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle click or Space+Click for panning
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      return;
    }

    handleToolAction(e.clientX, e.clientY, true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const deltaX = e.clientX - lastMousePos.x;
      const deltaY = e.clientY - lastMousePos.y;
      setPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
      return;
    }

    if (isDrawing) {
      const pos = getGridPos(e.clientX, e.clientY);
      if (pos) {
        applyTool(pos.x, pos.y);
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (isDrawing) {
      setIsDrawing(false);
      // Push state to history after drawing stroke
      if (grid !== history[historyIndex]) {
          pushToHistory(grid);
      }
    }
    // Reset touch state
    lastTouchDistance.current = null;
    lastTouchCenter.current = null;
  };

  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
      // Prevent default to stop scrolling
      // Note: Might need CSS touch-action: none on canvas
      if (e.touches.length === 1) {
          const touch = e.touches[0];
          handleToolAction(touch.clientX, touch.clientY, true);
      } else if (e.touches.length === 2) {
          const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
          );
          lastTouchDistance.current = dist;
          
          const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          lastTouchCenter.current = { x: centerX, y: centerY };
      }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (e.touches.length === 1 && isDrawing) {
          const touch = e.touches[0];
          handleToolAction(touch.clientX, touch.clientY, false);
      } else if (e.touches.length === 2) {
          const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
          );
          const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

          if (lastTouchDistance.current !== null && lastTouchCenter.current !== null) {
              // Zoom
              const deltaDist = dist - lastTouchDistance.current;
              const zoomSensitivity = 0.005;
              setZoom(prev => Math.min(Math.max(0.1, prev + deltaDist * zoomSensitivity), 5));

              // Pan
              const deltaX = centerX - lastTouchCenter.current.x;
              const deltaY = centerY - lastTouchCenter.current.y;
              setPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
          }

          lastTouchDistance.current = dist;
          lastTouchCenter.current = { x: centerX, y: centerY };
      }
  };

  const applyTool = (x: number, y: number) => {
    const newGrid = grid.map(row => [...row]); // Shallow copy rows
    // To avoid creating too many history states, we might modify 'grid' directly during drag
    // and only push to history on MouseUp. 
    // BUT React state is immutable. So we setGrid with new copy.
    
    // Check if change is needed
    let colorToApply = selectedColor;
    if (selectedTool === 'eraser') {
      colorToApply = eraserColor;
    }

    if (newGrid[y][x].id !== colorToApply.id) {
        newGrid[y][x] = colorToApply;
        setGrid(newGrid);
    }
  };
  
  // Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
      // e.preventDefault(); // Can't prevent default in React synthetic event easily if passive
      const zoomSensitivity = 0.001;
      setZoom(prev => Math.min(Math.max(0.1, prev - e.deltaY * zoomSensitivity), 5));
  };

  // Image Actions
  const handleFlipH = () => {
      const newGrid = grid.map(row => [...row].reverse());
      pushToHistory(newGrid);
  };

  const handleFlipV = () => {
      const newGrid = [...grid].reverse();
      pushToHistory(newGrid);
  };

  const handleRotate = () => {
      if (grid.length === 0) return;
      const rows = grid.length;
      const cols = grid[0].length;
      // Rotate 90 deg clockwise
      // New dimensions: cols x rows
      // We need to cast to any to initialize empty array of correct size, then fill
      // Or safer: map
      const newGrid: BeadColor[][] = [];
      for(let x=0; x<cols; x++) {
          newGrid[x] = [];
          for(let y=0; y<rows; y++) {
              newGrid[x][y] = grid[rows - 1 - y][x];
          }
      }
      pushToHistory(newGrid);
  };

  const handleClear = () => {
      setShowClearConfirm(true);
  };
  
  const confirmClear = () => {
     const h = grid.length;
     const w = grid.length > 0 ? grid[0].length : 0;
     // Fill with eraser color (usually white)
     const newGrid = Array.from({ length: h }, () => Array(w).fill(eraserColor)); 
     pushToHistory(newGrid);
     setShowClearConfirm(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#e0e5ec] flex flex-col overscroll-none" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="p-2 md:p-4 shadow-md flex justify-between items-center bg-[#e0e5ec] z-10 shrink-0">
        <h2 className="text-lg md:text-xl font-bold text-slate-700">{t.freeDrawTitle}</h2>
        <div className="flex gap-2 md:gap-4">
          <NeuButton onClick={handleUndo} disabled={historyIndex <= 0} className="px-3 py-1 text-sm md:text-base md:px-6 md:py-2">{t.undo}</NeuButton>
          <NeuButton onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="px-3 py-1 text-sm md:text-base md:px-6 md:py-2">{t.redo}</NeuButton>
          <NeuButton onClick={onCancel} className="text-red-500 px-3 py-1 text-sm md:text-base md:px-6 md:py-2">{t.cancel}</NeuButton>
          <NeuButton onClick={() => onSave(grid)} className="text-green-600 px-3 py-1 text-sm md:text-base md:px-6 md:py-2">{t.save}</NeuButton>
        </div>
      </div>

      {/* Toolbar & Canvas Container */}
      <div className="flex-1 overflow-hidden relative">
        {/* Canvas Area */}
        <div className="absolute inset-0 z-0 bg-slate-200 overflow-hidden cursor-crosshair touch-none pb-[140px]">
            <canvas 
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleMouseUp}
                onWheel={handleWheel}
                className="absolute top-0 left-0 w-full h-full touch-none"
            />
             <div className="absolute top-4 right-4 bg-white/80 p-2 rounded shadow text-xs pointer-events-none select-none z-20">
                <span className="hidden md:inline">{t.fdZoom.replace('{zoom}', Math.round(zoom * 100).toString())}</span>
                <span className="md:hidden">{t.fdTouch}</span>
            </div>
        </div>

        {/* Toolbar - Fixed at bottom for ALL devices */}
        <div 
            className="fixed bottom-0 left-0 right-0 h-auto p-2 md:p-4 flex items-end justify-center gap-2 md:gap-4 z-50 pointer-events-none"
            style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
            <div className="bg-[#e0e5ec] shadow-[0_-4px_20px_rgba(0,0,0,0.15)] rounded-2xl p-2 md:p-4 flex gap-2 md:gap-6 overflow-x-auto max-w-full pointer-events-auto items-center">
                
                {/* Tools Group */}
                <div className="flex gap-2 shrink-0">
                    <NeuButton 
                        active={selectedTool === 'pencil'} 
                        onClick={() => setSelectedTool('pencil')} 
                        className="w-10 h-10 md:w-12 md:h-12 !p-0 flex items-center justify-center text-lg md:text-xl"
                        title={t.toolPencil}
                    >
                        <Icon icon="lucide:pencil" className="w-6 h-6" />
                    </NeuButton>
                    <NeuButton 
                        active={selectedTool === 'bucket'} 
                        onClick={() => setSelectedTool('bucket')} 
                        className="w-10 h-10 md:w-12 md:h-12 !p-0 flex items-center justify-center text-lg md:text-xl"
                        title={t.toolBucket}
                    >
                        <Icon icon="lucide:paint-bucket" className="w-6 h-6" />
                    </NeuButton>
                    <NeuButton 
                        active={selectedTool === 'picker'} 
                        onClick={() => setSelectedTool('picker')} 
                        className="w-10 h-10 md:w-12 md:h-12 !p-0 flex items-center justify-center text-lg md:text-xl"
                        title={t.toolPicker}
                    >
                        <Icon icon="lucide:pipette" className="w-6 h-6" />
                    </NeuButton>
                </div>

                <div className="w-px h-8 bg-slate-300 mx-1"></div>

                {/* Color Picker with Popover */}
                <div className="relative shrink-0">
                    <div 
                        className={`w-10 h-10 md:w-12 md:h-12 rounded-full cursor-pointer border-4 shadow-inner ${showColorPicker ? 'ring-4 ring-blue-200' : ''}`}
                        style={{ backgroundColor: selectedColor.hex, borderColor: '#e0e5ec' }}
                        onClick={toggleColorPicker}
                        title={t.colors}
                    />
                </div>

                <div className="w-px h-8 bg-slate-300 mx-1"></div>

                 {/* Eraser Group */}
                 <div className="relative flex gap-2 shrink-0 items-center">
                    <NeuButton 
                        active={selectedTool === 'eraser'} 
                        onClick={() => setSelectedTool('eraser')} 
                        className="w-10 h-10 md:w-12 md:h-12 !p-0 flex items-center justify-center text-lg md:text-xl"
                        title={t.toolEraser}
                    >
                        <Icon icon="lucide:eraser" className="w-6 h-6" />
                    </NeuButton>
                    
                    {/* Eraser Color Trigger */}
                    <div 
                        className={`w-6 h-6 md:w-8 md:h-8 rounded-full cursor-pointer border-2 shadow-sm ${showEraserPicker ? 'ring-2 ring-red-200' : ''}`}
                        style={{ backgroundColor: eraserColor.hex, borderColor: '#fff' }}
                        onClick={toggleEraserPicker}
                        title={t.eraserColor}
                    />
                 </div>

                <div className="w-px h-8 bg-slate-300 mx-1"></div>

                {/* Image Actions */}
                <div className="flex gap-2 shrink-0">
                    <NeuButton onClick={handleFlipH} className="w-10 h-10 md:w-12 md:h-12 !p-0 flex items-center justify-center text-lg md:text-xl" title={t.toolFlipH}>
                        <Icon icon="lucide:flip-horizontal" className="w-6 h-6" />
                    </NeuButton>
                    <NeuButton onClick={handleFlipV} className="w-10 h-10 md:w-12 md:h-12 !p-0 flex items-center justify-center text-lg md:text-xl" title={t.toolFlipV}>
                        <Icon icon="lucide:flip-vertical" className="w-6 h-6" />
                    </NeuButton>
                    <NeuButton onClick={handleRotate} className="w-10 h-10 md:w-12 md:h-12 !p-0 flex items-center justify-center text-lg md:text-xl" title={t.toolRotate}>
                        <Icon icon="lucide:rotate-cw" className="w-6 h-6" />
                    </NeuButton>
                    <NeuButton onClick={handleClear} className="w-10 h-10 md:w-12 md:h-12 !p-0 flex items-center justify-center text-lg md:text-xl text-red-500" title={t.toolClear}>
                        <Icon icon="lucide:trash-2" className="w-6 h-6" />
                    </NeuButton>
                </div>
            </div>
        </div>

        {/* Clear Confirmation Modal */}
        <NeuModal
            isOpen={showClearConfirm}
            onClose={() => setShowClearConfirm(false)}
            title={t.toolClear}
        >
            <div className="flex flex-col gap-4">
                <p className="text-slate-600">{t.clearConfirmText}</p>
                <div className="flex justify-end gap-2">
                    <NeuButton onClick={() => setShowClearConfirm(false)}>{t.cancel}</NeuButton>
                    <NeuButton onClick={confirmClear} className="text-red-500 font-bold">{t.toolClear}</NeuButton>
                </div>
            </div>
        </NeuModal>

        {/* Global Popovers */}
        {showColorPicker && (
            <div 
                className="fixed z-[60] p-4 bg-[#e0e5ec] rounded-xl shadow-xl w-64 md:w-80 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-4 duration-200"
                style={{ left: popoverCoords.x, bottom: popoverCoords.bottom, transform: 'translateX(-50%)' }}
            >
                <h3 className="font-bold text-slate-600 text-sm">{t.colors}</h3>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                    {palette.map(c => (
                        <div 
                            key={c.id}
                            className={`w-8 h-8 rounded-full cursor-pointer border-2 ${selectedColor.id === c.id ? 'border-blue-500 scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: c.hex }}
                            onClick={() => {
                                setSelectedColor(c);
                                setShowColorPicker(false);
                            }}
                            title={`${c.name} (${c.id})`}
                        />
                    ))}
                </div>
                <div className="text-xs text-slate-500 text-center border-t border-slate-300 pt-2">
                    {selectedColor.name} ({selectedColor.id})
                </div>
                {/* Triangle Arrow */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-2 border-8 border-transparent border-t-[#e0e5ec]"></div>
            </div>
        )}

        {showEraserPicker && (
            <div 
                className="fixed z-[60] p-4 bg-[#e0e5ec] rounded-xl shadow-xl w-64 md:w-80 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-4 duration-200"
                style={{ left: popoverCoords.x, bottom: popoverCoords.bottom, transform: 'translateX(-50%)' }}
            >
                    <h3 className="font-bold text-slate-600 text-sm">{t.eraserColor}</h3>
                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                    {palette.map(c => (
                        <div 
                            key={`eraser-${c.id}`}
                            className={`w-8 h-8 rounded-full cursor-pointer border-2 ${eraserColor.id === c.id ? 'border-red-500 scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: c.hex }}
                            onClick={() => {
                                setEraserColor(c);
                                setShowEraserPicker(false);
                            }}
                            title={`${c.name} (${c.id})`}
                        />
                    ))}
                </div>
                <div className="text-xs text-slate-500 text-center border-t border-slate-300 pt-2">
                    {eraserColor.name}
                </div>
                    {/* Triangle Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-2 border-8 border-transparent border-t-[#e0e5ec]"></div>
            </div>
        )}
      </div>
    </div>
  );
};
