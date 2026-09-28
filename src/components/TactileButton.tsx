import React from 'react';
import { sound } from '../lib/sound';

interface TactileButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'emerald' | 'amber' | 'sky' | 'rose' | 'slate' | 'white';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const TactileButton: React.FC<TactileButtonProps> = ({
  variant = 'amber',
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

  // Soft, friendly, professional palette matching the Anideck soft coral-peach & cream icon
  const variants = {
    amber:
      'bg-[#FB923C] hover:bg-[#F97316] text-slate-950 border border-[#FDBA74]/60 shadow-[0_3px_0_0_#C2410C] active:shadow-none active:translate-y-[2px]',
    emerald:
      'bg-emerald-500/90 hover:bg-emerald-500 text-slate-950 border border-emerald-300/40 shadow-[0_3px_0_0_#065F46] active:shadow-none active:translate-y-[2px]',
    sky:
      'bg-[#FFFDF8] hover:bg-orange-50 text-slate-900 border border-slate-300 shadow-[0_3px_0_0_#94A3B8] active:shadow-none active:translate-y-[2px]',
    rose:
      'bg-rose-500 hover:bg-rose-400 text-white border border-rose-300/30 shadow-[0_3px_0_0_#881337] active:shadow-none active:translate-y-[2px]',
    slate:
      'bg-[#1E293B] hover:bg-[#334155] text-slate-100 border border-slate-700 shadow-[0_3px_0_0_#0F172A] active:shadow-none active:translate-y-[2px]',
    white:
      'bg-[#162032] hover:bg-[#1E293B] text-slate-200 border border-slate-700/80 shadow-[0_3px_0_0_#0B111E] active:shadow-none active:translate-y-[2px]',
  };

  const sizes = {
    sm: 'px-3.5 py-1.5 text-xs font-bold rounded-xl',
    md: 'px-4 py-2.5 text-sm font-extrabold rounded-xl',
    lg: 'px-6 py-3.5 text-sm sm:text-base font-black rounded-xl tracking-wide',
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
