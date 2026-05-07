import React, { useState } from "react";
import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { Eye, EyeOff, ArrowLeft, Wrench } from "lucide-react";

export default function LoginScreen() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [modo, setModo]         = useState("login"); // login | registro | recuperar
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState({ text: "", ok: false });

  const err   = (text) => setMsg({ text, ok: false });
  const ok    = (text) => setMsg({ text, ok: true });
  const reset = (m)    => { setModo(m); setMsg({ text: "", ok: false }); };

  const handleAuth = async () => {
    if (!email || !password) return err("Completá los campos");
    if (password.length < 6)  return err("Mínimo 6 caracteres");
    setMsg({ text: "", ok: false });
    setLoading(true);
    try {
      if (modo === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (e) {
      if (e.code === "auth/user-not-found")            err("No encontramos una cuenta con ese correo");
      else if (e.code === "auth/wrong-password" ||
               e.code === "auth/invalid-credential")   err("Contraseña incorrecta — revisá y volvé a intentar");
      else if (e.code === "auth/email-already-in-use") err("Ese correo ya tiene cuenta — ingresá con tu contraseña");
      else err("No se pudo iniciar sesión. Revisá tu correo y contraseña.");
    }
    setLoading(false);
  };

  const handleRecuperar = async () => {
    if (!email) return err("Ingresá tu correo");
    setLoading(true);
    setMsg({ text: "", ok: false });
    try {
      await sendPasswordResetEmail(auth, email);
      ok("Correo enviado — revisá tu bandeja de entrada");
    } catch (e) {
      if (e.code === "auth/user-not-found") err("No existe cuenta con ese email");
      else err("Error al enviar el correo");
    }
    setLoading(false);
  };

  // ── RECUPERAR CONTRASEÑA ───────────────────────────────────────────
  if (modo === "recuperar") return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <Logo />
        <div className="mt-8 rounded-3xl border border-white/8 bg-[#141414] p-7 space-y-5">
          <div>
            <p className="text-white font-black text-base">Recuperar contraseña</p>
            <p className="text-zinc-500 text-xs mt-1">Te enviamos un link al correo para restablecer tu acceso.</p>
          </div>
          <Field
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <MsgLine msg={msg} />
          <Btn onClick={handleRecuperar} disabled={loading}>
            {loading ? "Enviando..." : "Enviar link de recuperación"}
          </Btn>
          <button
            onClick={() => reset("login")}
            className="flex items-center gap-1.5 text-zinc-500 text-xs font-bold hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft size={13} /> Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );

  // ── LOGIN / REGISTRO ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <Logo />

        {/* Tabs */}
        <div className="mt-8 flex gap-2 p-1 rounded-2xl bg-[#141414] border border-white/8">
          <Tab active={modo === "login"}    onClick={() => reset("login")}>Ya tengo cuenta</Tab>
          <Tab active={modo === "registro"} onClick={() => reset("registro")}>Soy nuevo</Tab>
        </div>

        {/* Formulario */}
        <div className="mt-3 rounded-3xl border border-white/8 bg-[#141414] p-7 space-y-4">
          <Field
            type="email"
            label="Correo electrónico"
            placeholder="hola@taller.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <div className="relative">
            <Field
              type={showPass ? "text" : "password"}
              label="Contraseña"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAuth()}
            />
            <button
              onClick={() => setShowPass(!showPass)}
              className="absolute right-4 bottom-[14px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>

          <MsgLine msg={msg} />

          <Btn onClick={handleAuth} disabled={loading}>
            {loading
              ? "Procesando..."
              : modo === "login"
                ? "Ingresar al taller"
                : "Crear mi cuenta gratis"}
          </Btn>

          {modo === "login" && (
            <button
              onClick={() => reset("recuperar")}
              className="w-full text-center text-zinc-600 text-[11px] font-bold hover:text-zinc-400 transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Componentes internos ─────────────────────────────────────────────

function Logo() {
  return (
    <div className="text-center py-2">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-orange-500 to-orange-700 mb-5 shadow-xl shadow-orange-600/30">
        <Wrench size={30} className="text-white" strokeWidth={2.5} />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500 mb-1">Mecánica de Motos</p>
      <h1 className="text-[2.6rem] font-black tracking-tighter text-white leading-none">JOHNNY BLAZE</h1>
      <div className="w-14 h-[2px] bg-gradient-to-r from-transparent via-orange-600 to-transparent mx-auto my-3 rounded-full" />
      <p className="text-zinc-500 text-[10px] font-bold tracking-[0.3em] uppercase">Sistema de Gestión</p>
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
        active
          ? "bg-orange-500 text-white shadow"
          : "text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <p className="text-[11px] font-black uppercase tracking-widest text-zinc-500">{label}</p>}
      <input
        {...props}
        className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm placeholder-zinc-600 outline-none focus:border-orange-500/60 focus:bg-black transition-all"
      />
    </div>
  );
}

function Btn({ onClick, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full bg-orange-500 hover:bg-orange-400 active:scale-[0.98] disabled:opacity-50 text-white font-black text-sm py-4 rounded-2xl transition-all shadow-lg shadow-orange-500/20"
    >
      {children}
    </button>
  );
}

function MsgLine({ msg }) {
  if (!msg.text) return null;
  return (
    <p className={`text-xs font-bold leading-relaxed ${msg.ok ? "text-green-400" : "text-red-400"}`}>
      {msg.text}
    </p>
  );
}
