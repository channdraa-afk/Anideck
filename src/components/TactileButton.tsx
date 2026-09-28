import React from 'react';

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
    if (!disabled && onClick) {
      onClick(e);
    }
  };

  const variants = {
    amber:
      'bg-[#F97316] hover:bg-[#FB923C] text-[#090C15] border border-[#FDBA74]/50 shadow-[0_3px_0_0_#9A3412] active:shadow-none active:translate-y-[2px]',
    emerald:
      'bg-emerald-400 hover:bg-emerald-300 text-[#090C15] border border-emerald-200/50 shadow-[0_3px_0_0_#065F46] active:shadow-none active:translate-y-[2px]',
    sky:
      'bg-[#FFFDF8] hover:bg-amber-50 text-[#090C15] border border-white/60 shadow-[0_3px_0_0_#64748B] active:shadow-none active:translate-y-[2px]',
    rose:
      'bg-rose-500/90 hover:bg-rose-500 text-white border border-rose-400/40 shadow-[0_3px_0_0_#881337] active:shadow-none active:translate-y-[2px]',
    slate:
      'bg-[#151C2C] hover:bg-[#1E273D] text-slate-100 border border-white/10 shadow-[0_3px_0_0_#070A10] active:shadow-none active:translate-y-[2px]',
    white:
      'bg-[#111623] hover:bg-[#192134] text-slate-300 hover:text-white border border-white/[0.08] shadow-[0_2px_0_0_#06080E] active:shadow-none active:translate-y-[2px]',
  };

  const sizes = {
    sm: 'px-3.5 py-1.5 text-xs font-extrabold rounded-xl tracking-tight',
    md: 'px-4 py-2.5 text-xs sm:text-sm font-extrabold rounded-xl tracking-tight',
    lg: 'px-6 py-3.5 text-sm sm:text-base font-black rounded-2xl tracking-tight',
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
