import React, { useState, useRef, useEffect, useCallback } from 'react';
import { NeuCard, NeuButton, NeuSelect } from './NeumorphicComponents';
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

    const cellSize = 20 * zoom;
    const width = patternData.width * cellSize;
    const height = patternData.height * cellSize;

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
    for (let x = 0; x <= patternData.width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, height);
      ctx.stroke();
    }
    // Horizontal
    for (let y = 0; y <= patternData.height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(width, y * cellSize);
      ctx.stroke();
    }

    ctx.restore();
  }, [grid, patternData, zoom, pan]);

  useEffect(() => {
    requestAnimationFrame(drawCanvas);
  }, [drawCanvas]);

  // Tool Logic
  const getGridPos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - pan.x;
    const y = e.clientY - rect.top - pan.y;
    const cellSize = 20 * zoom;
    
    const gridX = Math.floor(x / cellSize);
    const gridY = Math.floor(y / cellSize);

    if (gridX >= 0 && gridX < patternData.width && gridY >= 0 && gridY < patternData.height) {
      return { x: gridX, y: gridY };
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle click or Space+Click for panning
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      return;
    }

    const pos = getGridPos(e);
    if (!pos) return;

    if (selectedTool === 'picker') {
      const bead = grid[pos.y][pos.x];
      setSelectedColor(bead);
      setSelectedTool('pencil'); // Switch back to pencil after picking
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
                
                // Neighbors
                if (x > 0) stack.push({x: x-1, y});
                if (x < patternData.width - 1) stack.push({x: x+1, y});
                if (y > 0) stack.push({x, y: y-1});
                if (y < patternData.height - 1) stack.push({x, y: y+1});
            }
        }
        pushToHistory(newGrid);
        return;
    }

    setIsDrawing(true);
    applyTool(pos.x, pos.y);
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
      const pos = getGridPos(e);
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

  return (
    <div className="fixed inset-0 z-50 bg-[#e0e5ec] flex flex-col">
      {/* Header */}
      <div className="p-4 shadow-md flex justify-between items-center bg-[#e0e5ec] z-10">
        <h2 className="text-xl font-bold text-slate-700">{t.freeDrawTitle}</h2>
        <div className="flex gap-4">
          <NeuButton onClick={handleUndo} disabled={historyIndex <= 0}>{t.undo}</NeuButton>
          <NeuButton onClick={handleRedo} disabled={historyIndex >= history.length - 1}>{t.redo}</NeuButton>
          <NeuButton onClick={onCancel} className="text-red-500">{t.cancel}</NeuButton>
          <NeuButton onClick={() => onSave(grid)} className="text-green-600">{t.save}</NeuButton>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 p-4 flex flex-col gap-4 shadow-lg z-10 bg-[#e0e5ec] overflow-y-auto">
          <NeuCard className="flex flex-col gap-2">
            <h3 className="font-bold text-slate-600">{t.tools}</h3>
            <div className="grid grid-cols-2 gap-2">
                <NeuButton active={selectedTool === 'pencil'} onClick={() => setSelectedTool('pencil')}>✏️ {t.toolPencil}</NeuButton>
                <NeuButton active={selectedTool === 'bucket'} onClick={() => setSelectedTool('bucket')}>🪣 {t.toolBucket}</NeuButton>
                <NeuButton active={selectedTool === 'eraser'} onClick={() => setSelectedTool('eraser')}>🧹 {t.toolEraser}</NeuButton>
                <NeuButton active={selectedTool === 'picker'} onClick={() => setSelectedTool('picker')}>🖌️ {t.toolPicker}</NeuButton>
            </div>
          </NeuCard>

          <NeuCard className="flex flex-col gap-2">
            <h3 className="font-bold text-slate-600">{t.colors}</h3>
            <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto p-1">
                {palette.map(c => (
                    <div 
                        key={c.id}
                        className={`w-6 h-6 rounded-full cursor-pointer border-2 ${selectedColor.id === c.id ? 'border-blue-500 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c.hex }}
                        onClick={() => setSelectedColor(c)}
                        title={c.name}
                    />
                ))}
            </div>
            <div className="mt-2 text-sm text-slate-500">
                {t.currentColor}: {selectedColor.name} ({selectedColor.id})
            </div>
          </NeuCard>
          
          <NeuCard className="flex flex-col gap-2">
             <h3 className="font-bold text-slate-600">{t.eraserColor}</h3>
             <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto p-1">
                {palette.map(c => (
                    <div 
                        key={`eraser-${c.id}`}
                        className={`w-6 h-6 rounded-full cursor-pointer border-2 ${eraserColor.id === c.id ? 'border-red-500 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c.hex }}
                        onClick={() => setEraserColor(c)}
                        title={c.name}
                    />
                ))}
            </div>
             <div className="mt-2 text-sm text-slate-500">
                {t.toolEraser}: {eraserColor.name}
            </div>
          </NeuCard>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative bg-slate-200 overflow-hidden cursor-crosshair">
            <canvas 
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                className="absolute top-0 left-0 w-full h-full"
            />
             <div className="absolute bottom-4 right-4 bg-white/80 p-2 rounded shadow text-xs">
                Zoom: {Math.round(zoom * 100)}% | Shift+Click to Pan
            </div>
        </div>
      </div>
    </div>
  );
};
