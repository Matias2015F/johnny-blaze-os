import React from 'react';

/**
 * Button Component — Variantes unificadas
 * 
 * Variantes:
 * - primary: naranja, CTA principal
 * - secondary: zinc con borde, acciones secundarias
 * - danger: rojo, acciones destructivas
 * - ghost: sin fondo, acciones tertarias
 * 
 * Tamaños:
 * - sm: pequeño (py-1.5)
 * - md: mediano (py-2.5) — default
 * - lg: grande (py-3.5)
 */
export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  children,
  className = '',
  ...props
}) {
  const baseClasses = 'font-black uppercase tracking-widest transition-all active:scale-95 inline-flex items-center justify-center gap-2';
  
  const variants = {
    primary: 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white shadow-lg shadow-orange-900/30 disabled:opacity-50 disabled:cursor-not-allowed',
    secondary: 'bg-zinc-900 border-2 border-zinc-700 text-white hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed',
    danger: 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-lg shadow-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed',
    ghost: 'text-zinc-400 hover:text-white hover:bg-zinc-800/50 disabled:opacity-30 disabled:cursor-not-allowed',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-4 py-2.5 text-sm rounded-xl',
    lg: 'px-6 py-3.5 text-base rounded-2xl w-full',
  };

  const buttonClass = `${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`;

  return (
    <button
      disabled={disabled || loading}
      className={buttonClass}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
}

/**
 * IconButton — Botón pequeño con icono
 * Touch target: 44px mínimo (p-2 + rounded-lg)
 */
export function IconButton({
  variant = 'ghost',
  disabled = false,
  className = '',
  children,
  ...props
}) {
  const baseClasses = 'p-2 rounded-lg transition-all active:scale-95 flex items-center justify-center';
  
  const variants = {
    ghost: 'bg-transparent text-zinc-400 hover:text-white hover:bg-zinc-800/50',
    secondary: 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700',
    primary: 'bg-orange-600 text-white hover:bg-orange-700',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };

  return (
    <button
      disabled={disabled}
      className={`${baseClasses} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
