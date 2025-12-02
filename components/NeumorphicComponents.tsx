import React, { ReactNode } from 'react';

// Common base styles
const BASE_BG = 'bg-[#e0e5ec]';
const TEXT_COLOR = 'text-slate-600';

// Shadow styles
const SHADOW_OUT = 'shadow-[9px_9px_16px_rgb(163,177,198,0.6),-9px_-9px_16px_rgba(255,255,255,0.5)]';
const SHADOW_IN = 'shadow-[inset_6px_6px_10px_0_rgba(163,177,198,0.7),inset_-6px_-6px_10px_0_rgba(255,255,255,0.8)]';

interface Props {
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
  active?: boolean;
}

export const NeuCard: React.FC<Props> = ({ children, className = '' }) => (
  <div className={`${BASE_BG} ${SHADOW_OUT} rounded-2xl p-6 ${className}`}>
    {children}
  </div>
);

export const NeuButton: React.FC<Props & { disabled?: boolean }> = ({ children, className = '', onClick, active, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      ${BASE_BG} 
      ${active ? SHADOW_IN : SHADOW_OUT} 
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:shadow-[inset_4px_4px_8px_0_rgba(163,177,198,0.7),inset_-4px_-4px_8px_0_rgba(255,255,255,0.8)] transform active:scale-[0.98]'}
      rounded-full px-6 py-2 font-bold ${TEXT_COLOR} transition-all duration-200
      ${className}
    `}
  >
    {children}
  </button>
);

export const NeuInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className={`
      ${BASE_BG} ${SHADOW_IN}
      rounded-xl px-4 py-3 outline-none ${TEXT_COLOR}
      focus:ring-2 focus:ring-slate-300 transition-all
      placeholder-slate-400
      ${props.className}
    `}
  />
);

export const NeuSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
  <div className={`relative ${props.className}`}>
    <select
      {...props}
      className={`
        appearance-none w-full
        ${BASE_BG} ${SHADOW_IN}
        rounded-xl px-4 py-3 outline-none ${TEXT_COLOR}
        focus:ring-2 focus:ring-slate-300 transition-all
        cursor-pointer
      `}
    />
    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
    </div>
  </div>
);

export const NeuRange: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string, valueDisplay?: string }> = ({ label, valueDisplay, ...props }) => (
  <div className="flex flex-col gap-2 w-full">
    {(label || valueDisplay) && (
      <div className="flex justify-between px-1">
        <span className="text-sm font-semibold text-slate-500">{label}</span>
        <span className="text-sm font-bold text-slate-600">{valueDisplay}</span>
      </div>
    )}
    <div className={`h-8 rounded-full ${SHADOW_IN} flex items-center px-2`}>
      <input
        type="range"
        {...props}
        className="w-full h-2 bg-transparent appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-400 [&::-webkit-slider-thumb]:shadow-md"
      />
    </div>
  </div>
);

export const NeuModal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-800/30 backdrop-blur-sm">
      <div className="bg-[#e0e5ec] rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease-out]">
        <div className="flex justify-between items-center p-6 border-b border-slate-300">
          <h3 className="text-xl font-bold text-slate-700">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};
