import React from 'react';

/**
 * Badge Component — Etiqueta/tag pequeño
 * 
 * Variantes:
 * - primary: naranja, estados primarios
 * - success: verde, completado/aprobado
 * - warning: amarillo, atención/advertencia
 * - error: rojo, error/rechazado
 * - muted: gris, inactivo/neutral
 */
export function Badge({
  variant = 'muted',
  children,
  className = '',
  ...props
}) {
  const baseClasses = 'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest';
  
  const variants = {
    primary: 'bg-orange-500/20 text-orange-400 border border-orange-500/40',
    success: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
    warning: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40',
    error: 'bg-red-500/20 text-red-400 border border-red-500/40',
    muted: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
  };

  return (
    <div className={`${baseClasses} ${variants[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
}

/**
 * Status Badge — Indicador de estado con color
 */
export function StatusBadge({ status, label }) {
  const statusMap = {
    'pending': { variant: 'warning', label: 'Pendiente' },
    'approved': { variant: 'success', label: 'Aprobado' },
    'rejected': { variant: 'error', label: 'Rechazado' },
    'active': { variant: 'primary', label: 'Activo' },
    'inactive': { variant: 'muted', label: 'Inactivo' },
    'processing': { variant: 'primary', label: 'Procesando' },
    'completed': { variant: 'success', label: 'Completado' },
    'failed': { variant: 'error', label: 'Falló' },
  };

  const config = statusMap[status] || { variant: 'muted', label: label || status };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
