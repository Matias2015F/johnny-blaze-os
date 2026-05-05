// Prototipo interactivo UI - Johnny Blaze OS

const app = document.getElementById('app');

const views = {
  home: `
    <div class="max-w-md mx-auto min-h-screen bg-[#0A0A0A] pb-32">
      <!-- Header -->
      <div class="bg-gradient-to-b from-blue-600/20 to-transparent p-6 space-y-5">
        <div class="text-center">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-orange-500 mb-3">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
          </div>
          <h1 class="text-4xl font-black tracking-tight">JOHNNY BLAZE</h1>
          <p class="text-orange-500 text-xs font-bold tracking-widest uppercase mt-1">Gestión de Taller</p>
        </div>

        <!-- Cards de stats -->
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-2xl border border-white/10 bg-black/40 p-4">
            <p class="text-xs font-bold text-slate-400 uppercase">Activos hoy</p>
            <p class="text-3xl font-black text-blue-400 mt-2">5</p>
            <p class="text-[10px] text-slate-500 mt-1">En movimiento</p>
          </div>
          <div class="rounded-2xl border border-white/10 bg-black/40 p-4">
            <p class="text-xs font-bold text-slate-400 uppercase">Pendiente</p>
            <p class="text-3xl font-black text-emerald-400 mt-2">$18k</p>
            <p class="text-[10px] text-slate-500 mt-1">Por cobrar</p>
          </div>
        </div>
      </div>

      <!-- Botón principal -->
      <div class="px-4 mt-4">
        <button class="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:to-orange-700 text-white font-black py-5 rounded-3xl shadow-lg shadow-orange-500/30 active:scale-95 transition-all flex items-center justify-center gap-3">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
          <span class="text-lg">Nuevo ingreso</span>
        </button>
      </div>

      <!-- Quick actions -->
      <div class="px-4 mt-6 grid grid-cols-2 gap-3">
        <button onclick="switchView('orders')" class="rounded-2xl border border-white/10 bg-slate-900/80 hover:bg-slate-800 p-5 text-left transition-all active:scale-95">
          <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <p class="text-xs font-black uppercase mt-4 text-white">Trabajos</p>
          <p class="text-[10px] text-slate-500 mt-1">Ver y seguir</p>
        </button>
        <button class="rounded-2xl border border-white/10 bg-slate-900/80 hover:bg-slate-800 p-5 text-left transition-all active:scale-95">
          <svg class="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <p class="text-xs font-black uppercase mt-4 text-white">Pagos</p>
          <p class="text-[10px] text-slate-500 mt-1">Cobrar</p>
        </button>
      </div>
    </div>
  `,

  orders: `
    <div class="max-w-md mx-auto min-h-screen bg-[#0A0A0A] pb-24">
      <!-- Header con back -->
      <div class="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur border-b border-white/10 px-4 py-4 flex items-center justify-between">
        <button onclick="switchView('home')" class="p-2 hover:bg-slate-900 rounded-lg transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
          </svg>
        </button>
        <h2 class="text-lg font-black">TRABAJOS ACTIVOS</h2>
        <div class="w-10"></div>
      </div>

      <!-- Lista de órdenes -->
      <div class="p-4 space-y-3">
        ${[
          { patente: 'A123ABC', marca: 'Honda', modelo: 'Tornado 250', estado: 'NORMAL', costo: '$8,500' },
          { patente: 'B456DEF', marca: 'Yamaha', modelo: 'FZ 16', estado: 'ALERTA', costo: '$12,300' },
          { patente: 'C789GHI', marca: 'Suzuki', modelo: 'Gixxer', estado: 'BLOQUEADO', costo: '$25,000' },
        ].map(work => `
          <button onclick="switchView('detail')" class="w-full rounded-2xl border border-white/10 bg-slate-900/80 hover:bg-slate-800 p-4 text-left transition-all active:scale-95">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-lg font-black text-white">${work.patente}</p>
                <p class="text-xs text-slate-500 mt-1">${work.marca} ${work.modelo}</p>
                <span class="inline-block mt-2 text-[9px] font-black px-3 py-1 rounded-lg ${
                  work.estado === 'NORMAL' ? 'bg-green-500/20 text-green-300' :
                  work.estado === 'ALERTA' ? 'bg-yellow-500/20 text-yellow-300' :
                  'bg-red-500/20 text-red-300'
                }">${work.estado}</span>
              </div>
              <div class="text-right">
                <p class="text-xs text-slate-500">Acumulado</p>
                <p class="text-lg font-black text-white">${work.costo}</p>
              </div>
            </div>
          </button>
        `).join('')}
      </div>
    </div>
  `,

  detail: `
    <div class="max-w-md mx-auto min-h-screen bg-[#0A0A0A] pb-24">
      <!-- Header -->
      <div class="sticky top-0 z-40 bg-gradient-to-b from-blue-600/10 to-transparent backdrop-blur border-b border-white/10 px-4 py-5">
        <div class="flex items-center justify-between mb-4">
          <button onclick="switchView('orders')" class="p-2 hover:bg-slate-900 rounded-lg transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          <span class="inline-block text-[10px] font-black px-3 py-1 rounded-full bg-green-500/20 text-green-300">EN CURSO</span>
        </div>
        <div>
          <h2 class="text-4xl font-black">A123ABC</h2>
          <p class="text-sm text-blue-400 font-black uppercase mt-1">OT-000001</p>
          <p class="text-sm text-slate-300 font-black mt-2">Juan Pérez</p>
          <p class="text-xs text-slate-500">📱 +54 343 4111222</p>
        </div>
      </div>

      <!-- Progress steps -->
      <div class="px-4 mt-4 flex gap-2 overflow-x-auto pb-2">
        ${['Diag.', 'Presup.', 'Aprobado', 'En curso', 'Cobro', 'PDF', 'Cerrado'].map((step, i) => `
          <div class="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm ${
            i < 3 ? 'bg-emerald-500 text-white' :
            i === 3 ? 'bg-blue-600 text-white scale-105' :
            'bg-slate-900 text-slate-500'
          }">${step}</div>
        `).join('')}
      </div>

      <!-- Content -->
      <div class="p-4 space-y-6">
        <!-- Ganancia -->
        <div class="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <p class="text-[10px] font-black uppercase text-emerald-300">Ganancia del taller</p>
          <p class="text-3xl font-black text-emerald-400 mt-2">$8,500</p>
          <p class="text-xs text-emerald-300/70 mt-2">De mano de obra. El cliente paga extra por repuestos.</p>
        </div>

        <!-- Tareas -->
        <div class="space-y-2">
          <p class="text-xs font-black uppercase text-slate-500">Trabajos registrados</p>
          <div class="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
            <p class="font-black text-white">Regulación de válvulas</p>
            <p class="text-xs text-slate-500 mt-1">2 horas base</p>
            <p class="text-sm font-black text-blue-400 mt-2">$15,000</p>
          </div>
        </div>

        <!-- Acciones -->
        <div class="grid grid-cols-2 gap-3">
          <button class="rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black py-4 active:scale-95 transition-all">Agregar tarea</button>
          <button class="rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-black py-4 active:scale-95 transition-all">Cronómetro</button>
        </div>
      </div>
    </div>
  `
};

function switchView(viewName) {
  app.innerHTML = views[viewName];
}

// Iniciar
app.innerHTML = views.home;
