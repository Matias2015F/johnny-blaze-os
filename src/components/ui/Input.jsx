import React from 'react';

/**
 * Input Component — Unificado
 * 
 * Props:
 * - type: 'text', 'email', 'tel', 'number', 'password', 'search'
 * - placeholder: texto placeholder
 * - error: string con mensaje de error
 * - icon: JSX element para icono izquierdo
 * - disabled: boolean
 * - size: 'sm' | 'md' | 'lg'
 */
export function Input({
  type = 'text',
  placeholder = '',
  error = false,
  icon = null,
  disabled = false,
  size = 'md',
  className = '',
  ...props
}) {
  const baseClasses = 'bg-zinc-900 border-2 transition-all outline-none';
  
  const borderClasses = error
    ? 'border-red-600 focus:border-red-400'
    : 'border-zinc-700 focus:border-orange-500';

  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-4 py-2.5 text-sm rounded-xl',
    lg: 'px-4 py-3 text-base rounded-2xl',
  };

  const wrapperClass = icon ? 'relative' : '';
  const inputClass = `${baseClasses} ${borderClasses} ${sizes[size]} text-white placeholder:text-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed w-full ${icon ? 'pl-10' : ''} ${className}`;

  return (
    <div className={wrapperClass}>
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
          {icon}
        </div>
      )}
      <input
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        className={inputClass}
        {...props}
      />
      {error && typeof error === 'string' && (
        <p className="text-[10px] text-red-500 font-bold mt-1">{error}</p>
      )}
    </div>
  );
}

/**
 * Textarea Component
 */
export function Textarea({
  placeholder = '',
  error = false,
  disabled = false,
  rows = 4,
  className = '',
  ...props
}) {
  const baseClasses = 'bg-zinc-900 border-2 border-zinc-700 focus:border-orange-500 text-white placeholder:text-zinc-600 rounded-xl px-4 py-2.5 text-sm transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed w-full';
  
  const borderClasses = error ? 'border-red-600 focus:border-red-400' : '';

  return (
    <div>
      <textarea
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={`${baseClasses} ${borderClasses} ${className}`}
        {...props}
      />
      {error && typeof error === 'string' && (
        <p className="text-[10px] text-red-500 font-bold mt-1">{error}</p>
      )}
    </div>
  );
}
