import React from 'react';

/**
 * Card Component — Bloque visual unificado
 * 
 * Variantes:
 * - default: fondo zinc-900, borde zinc-700
 * - accent: borde naranja, para elementos destacados
 * - alert: borde rojo, para alertas/errores
 */
export function Card({
  variant = 'default',
  children,
  className = '',
  ...props
}) {
  const baseClasses = 'rounded-[2rem] border p-4 transition-all';

  const variants = {
    default: 'bg-zinc-900 border-zinc-800',
    accent: 'bg-zinc-900/50 border-orange-500/50',
    alert: 'bg-red-950/30 border-red-600/50',
  };

  return (
    <div className={`${baseClasses} ${variants[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
}

/**
 * CardHeader — Encabezado con título y acción
 */
export function CardHeader({
  title,
  subtitle = null,
  action = null,
  className = '',
}) {
  return (
    <div className={`flex items-start justify-between gap-4 mb-4 ${className}`}>
      <div>
        <h3 className="text-sm font-black uppercase tracking-widest text-white">{title}</h3>
        {subtitle && <p className="text-[10px] text-zinc-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * CardBody — Contenedor de contenido
 */
export function CardBody({ children, className = '' }) {
  return <div className={`space-y-3 ${className}`}>{children}</div>;
}

/**
 * CardFooter — Pie con acciones
 */
export function CardFooter({ children, className = '' }) {
  return (
    <div className={`flex items-center gap-2 pt-4 border-t border-zinc-800 ${className}`}>
      {children}
    </div>
  );
}

/**
 * Grid de Cards — layout responsive
 */
export function CardGrid({ children, cols = 2, className = '' }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-${cols} gap-4 ${className}`}>
      {children}
    </div>
  );
}
