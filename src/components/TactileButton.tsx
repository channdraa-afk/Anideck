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

  // Grand Velvet Cinema Palette (#6D0808 Crimson, #2D0000 Oxblood, #757D6F Olive Sage, #EEEAD7 Parchment Cream)
  const variants = {
    amber:
      'bg-[#6D0808] hover:bg-[#820A0A] text-[#EEEAD7] border border-[#8E1616] shadow-[0_3px_0_0_#180000] active:shadow-none',
    emerald:
      'bg-[#757D6F] hover:bg-[#848D7E] text-[#EEEAD7] border border-[#90998A] shadow-[0_3px_0_0_#3E433B] active:shadow-none',
    sky:
      'bg-[#380303] hover:bg-[#4A0505] text-[#EEEAD7] border border-[#757D6F]/45 shadow-[0_3px_0_0_#180000] active:shadow-none',
    rose:
      'bg-[#6D0808] hover:bg-[#870B0B] text-[#EEEAD7] border border-[#A31B1B] shadow-[0_3px_0_0_#180000] active:shadow-none',
    slate:
      'bg-[#220000] hover:bg-[#380303] text-[#EEEAD7] border border-[#757D6F]/35 shadow-[0_3px_0_0_#120000] active:shadow-none',
    white:
      'bg-[#EEEAD7] hover:bg-[#F7F4E8] text-[#2D0000] border border-[#D4CEB6] shadow-[0_3px_0_0_#757D6F] active:shadow-none',
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
