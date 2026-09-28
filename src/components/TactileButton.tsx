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

  // Warm Studio Editorial Palette (Soft Terracotta, Calm Sage, Warm Espresso, Alabaster White)
  const variants = {
    amber:
      'bg-[#E07A5F] hover:bg-[#D4694D] text-[#FFFDF9] border border-[#C85D41] shadow-[0_3px_0_0_#A6472E] active:shadow-none',
    emerald:
      'bg-[#2A9D8F] hover:bg-[#23877B] text-[#FFFDF9] border border-[#1E7268] shadow-[0_3px_0_0_#16574F] active:shadow-none',
    sky:
      'bg-[#F4A261] hover:bg-[#E8924F] text-[#1C1917] border border-[#D6803E] shadow-[0_3px_0_0_#B36529] active:shadow-none',
    rose:
      'bg-[#D9534F] hover:bg-[#C9433F] text-white border border-[#B53632] shadow-[0_3px_0_0_#8F2724] active:shadow-none',
    slate:
      'bg-[#1C1917] hover:bg-[#292524] text-[#FAF8F5] border border-[#1C1917] shadow-[0_3px_0_0_#0C0A09] active:shadow-none',
    white:
      'bg-[#FFFFFF] hover:bg-[#FAF8F5] text-[#1C1917] border border-[#DFD9CE] shadow-[0_3px_0_0_#CFC8BA] active:shadow-none',
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
      style={{
        transition: 'transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 150ms ease',
      }}
      className={`relative inline-flex items-center justify-center gap-2 cursor-pointer select-none hover:-translate-y-[1.5px] active:translate-y-[2px] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
};
