import React from 'react';
import { sound } from '../lib/sound';

interface TactileButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'emerald' | 'amber' | 'sky' | 'rose' | 'slate' | 'white';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const TactileButton: React.FC<TactileButtonProps> = ({
  variant = 'sky',
  size = 'md',
  children,
  onClick,
  disabled,
  className = '',
  ...props
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled) {
      sound.playPop();
      if (onClick) onClick(e);
    }
  };

  const variants = {
    emerald:
      'bg-emerald-500 hover:bg-emerald-600 text-white border-2 border-emerald-800 shadow-[0_4px_0_0_#065f46] active:shadow-none active:translate-y-1',
    amber:
      'bg-amber-500 hover:bg-amber-600 text-slate-900 border-2 border-amber-800 shadow-[0_4px_0_0_#92400e] active:shadow-none active:translate-y-1',
    sky: 'bg-sky-600 hover:bg-sky-500 text-white border-2 border-sky-900 shadow-[0_4px_0_0_#0c4a6e] active:shadow-none active:translate-y-1',
    rose: 'bg-rose-500 hover:bg-rose-600 text-white border-2 border-rose-800 shadow-[0_4px_0_0_#9f1239] active:shadow-none active:translate-y-1',
    slate:
      'bg-slate-800 hover:bg-slate-700 text-white border-2 border-slate-950 shadow-[0_4px_0_0_#0f172a] active:shadow-none active:translate-y-1',
    white:
      'bg-white hover:bg-amber-50/60 text-slate-800 border-2 border-slate-300 shadow-[0_4px_0_0_#cbd5e1] active:shadow-none active:translate-y-1',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs font-extrabold rounded-xl',
    md: 'px-4 py-2.5 text-sm font-extrabold rounded-2xl',
    lg: 'px-6 py-3.5 text-base font-black rounded-2xl tracking-wide',
  };

  return (
    <button
      {...props}
      disabled={disabled}
      onClick={handleClick}
      className={`relative inline-flex items-center justify-center gap-2 cursor-pointer transition-transform duration-75 select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
};
