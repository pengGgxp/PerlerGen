import React, { useState, useEffect, useRef } from 'react';
import { NeuCard, NeuButton, NeuInput } from './components/NeumorphicComponents';
import { processImageToPattern } from './services/imageProcessor';
import { analyzeBeadPattern } from './services/gemini';
import { PatternData, AIAnalysis } from './types';
import { BEAD_PALETTE } from './constants';

const App = () => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  
  // Grid Dimensions State
  const [gridWidth, setGridWidth] = useState<number>(29);
  const [gridHeight, setGridHeight] = useState<number>(29);
  const [lockRatio, setLockRatio] = useState<boolean>(true);
  const [imgAspectRatio, setImgAspectRatio] = useState<number>(1);

  const [patternData, setPatternData] = useState<PatternData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showGridLines, setShowGridLines] = useState(true);

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
        // Adjust height to match aspect ratio initially, keeping current width
        if (lockRatio) {
            setGridHeight(Math.max(1, Math.round(gridWidth / ratio)));
        }
      };
      img.src = imageSrc;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSrc]); // Only run when new image is loaded

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

  // Generate Pattern Effect
  useEffect(() => {
    if (imageSrc && gridWidth > 0 && gridHeight > 0) {
      setIsProcessing(true);
      const timer = setTimeout(() => {
        processImageToPattern(imageSrc, gridWidth, gridHeight)
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
  }, [imageSrc, gridWidth, gridHeight]);

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
  useEffect(() => {
    if (patternData && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const cellSize = 12; 
      
      canvas.width = patternData.width * cellSize;
      canvas.height = patternData.height * cellSize;

      // Clear
      ctx.fillStyle = '#e0e5ec';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      patternData.grid.forEach((row, y) => {
        row.forEach((bead, x) => {
          ctx.fillStyle = bead.hex;
          if (showGridLines) {
             ctx.beginPath();
             ctx.arc(
               x * cellSize + cellSize / 2, 
               y * cellSize + cellSize / 2, 
               (cellSize / 2) - 1, 
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
  }, [patternData, showGridLines]);

  return (
    <div className="min-h-screen p-8 flex flex-col items-center gap-8 bg-[#e0e5ec]">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-4xl font-extrabold text-slate-700 tracking-tight mb-2">PerlerGen AI</h1>
        <p className="text-slate-500 font-medium">Magic Pixel Art Generator</p>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Controls & Material List */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          
          {/* Controls */}
          <NeuCard className="flex flex-col gap-6">
            <h2 className="text-xl font-bold text-slate-700">Settings</h2>
            
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-500 ml-2">Upload Image</label>
              <NeuInput type="file" accept="image/*" onChange={handleFileUpload} />
            </div>

            {imageSrc && (
              <>
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center px-2 mb-1">
                        <span className="text-sm font-bold text-slate-500">Grid Dimensions (Beads)</span>
                        <button 
                            onClick={() => setLockRatio(!lockRatio)}
                            className={`p-1 rounded-lg transition-all ${lockRatio ? 'bg-slate-300 text-slate-700 shadow-inner' : 'text-slate-400 hover:text-slate-600'}`}
                            title={lockRatio ? "Unlock Aspect Ratio" : "Lock Aspect Ratio"}
                        >
                            {lockRatio ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                            )}
                        </button>
                    </div>
                    <div className="flex gap-4 items-center">
                        <div className="flex-1">
                            <label className="text-xs font-semibold text-slate-400 ml-2 mb-1 block">Width</label>
                            <NeuInput 
                                type="number" 
                                value={gridWidth} 
                                onChange={(e) => handleWidthChange(e.target.value)}
                                min="1"
                                className="text-center font-mono"
                            />
                        </div>
                        <span className="text-slate-400 font-bold mt-5">×</span>
                        <div className="flex-1">
                            <label className="text-xs font-semibold text-slate-400 ml-2 mb-1 block">Height</label>
                            <NeuInput 
                                type="number" 
                                value={gridHeight} 
                                onChange={(e) => handleHeightChange(e.target.value)}
                                min="1"
                                className="text-center font-mono"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center px-2 py-2">
                   <label className="text-sm font-bold text-slate-500">Show Circular Beads</label>
                   <input 
                     type="checkbox" 
                     checked={showGridLines} 
                     onChange={(e) => setShowGridLines(e.target.checked)}
                     className="w-5 h-5 accent-slate-500 cursor-pointer"
                   />
                </div>

                <div className="pt-2">
                  <NeuButton 
                    onClick={handleAnalyze} 
                    disabled={isAnalyzing} 
                    className="w-full flex justify-center items-center gap-2"
                  >
                    {isAnalyzing ? (
                      <span className="animate-pulse">Thinking...</span>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        Ask AI for Ideas
                      </>
                    )}
                  </NeuButton>
                </div>
              </>
            )}
          </NeuCard>

          {/* AI Insights Panel */}
          {aiAnalysis && (
            <NeuCard className="bg-slate-200">
               <div className="flex flex-col gap-3">
                  <h3 className="text-lg font-bold text-slate-700 border-b border-slate-300 pb-2">{aiAnalysis.title}</h3>
                  <p className="text-sm text-slate-600 italic">"{aiAnalysis.description}"</p>
                  <div className="flex justify-between items-center text-sm font-semibold text-slate-500">
                    <span>Difficulty:</span>
                    <span className={`px-2 py-0.5 rounded-md ${
                        aiAnalysis.difficulty.toLowerCase().includes('hard') ? 'bg-red-200 text-red-700' :
                        aiAnalysis.difficulty.toLowerCase().includes('medium') ? 'bg-yellow-200 text-yellow-700' :
                        'bg-green-200 text-green-700'
                    }`}>{aiAnalysis.difficulty}</span>
                  </div>
                   <div className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-500">Idea: </span> 
                    {aiAnalysis.suggestedUsage}
                  </div>
               </div>
            </NeuCard>
          )}

          {/* Materials List */}
          {patternData && (
            <NeuCard className="flex flex-col gap-4 max-h-[500px] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-end">
                <h2 className="text-xl font-bold text-slate-700">Materials</h2>
                <span className="text-xs font-bold text-slate-400">Total Beads: {patternData.width * patternData.height}</span>
              </div>
              
              <div className="flex flex-col gap-2">
                {BEAD_PALETTE.filter(b => patternData.counts[b.id]).sort((a,b) => (patternData.counts[b.id] || 0) - (patternData.counts[a.id] || 0)).map((bead) => (
                  <div key={bead.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-200/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full border border-slate-300 shadow-sm" style={{ backgroundColor: bead.hex }}></div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700">{bead.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{bead.id}</span>
                      </div>
                    </div>
                    <span className="font-bold text-slate-600 bg-slate-200 px-2 py-1 rounded-md min-w-[3rem] text-center text-sm">
                      {patternData.counts[bead.id]}
                    </span>
                  </div>
                ))}
              </div>
            </NeuCard>
          )}
        </div>

        {/* Right Column: Canvas Preview */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <NeuCard className="min-h-[600px] flex items-center justify-center relative overflow-hidden p-8">
            {!imageSrc ? (
               <div className="flex flex-col items-center gap-4 text-slate-400">
                 <svg className="w-24 h-24 opacity-20" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
                 <p className="font-bold text-lg opacity-50">Upload an image to start</p>
               </div>
            ) : (
              <div className="relative flex flex-col items-center">
                 {/* Canvas container with inner shadow for 'sunken' look */}
                 <div className="p-4 rounded-xl bg-[#e0e5ec] shadow-[inset_9px_9px_16px_rgb(163,177,198,0.6),inset_-9px_-9px_16px_rgba(255,255,255,0.5)] overflow-auto max-w-full max-h-[70vh]">
                    <canvas ref={canvasRef} className="rounded cursor-crosshair mx-auto" />
                 </div>
                 
                 {/* Original Image comparison (Thumbnail) */}
                 <div className="absolute top-4 right-4 w-24 h-24 p-2 bg-[#e0e5ec] rounded-xl shadow-[9px_9px_16px_rgb(163,177,198,0.6),-9px_-9px_16px_rgba(255,255,255,0.5)] transform rotate-2 hover:rotate-0 transition-transform duration-300 hidden md:block">
                    <img src={imageSrc} className="w-full h-full object-cover rounded-lg" alt="Original" />
                 </div>
              </div>
            )}
          </NeuCard>

          {/* Action Footer */}
          {patternData && (
             <div className="flex justify-end">
               <NeuButton 
                  onClick={() => {
                     if (canvasRef.current) {
                        const link = document.createElement('a');
                        link.download = `perler-pattern-${gridWidth}x${gridHeight}.png`;
                        link.href = canvasRef.current.toDataURL();
                        link.click();
                     }
                  }}
                  className="flex items-center gap-2"
               >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                 Download Pattern
               </NeuButton>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;