import React, { useEffect, useState } from "react";
import { auth } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";

function safeRedirect(value) {
  if (!value) return "";
  try {
    const decoded = decodeURIComponent(String(value));
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return "";
    return decoded;
  } catch {
    return "";
  }
}

function resolveRedirect(explicitRedirect = "") {
  const params = new URLSearchParams(window.location.search || "");
  const redirect = safeRedirect(explicitRedirect || params.get("redirect") || "");
  if (redirect) return redirect;

  const legacyOffer = params.get("oferta");
  if (legacyOffer) return `/oferta/${encodeURIComponent(legacyOffer)}`;

  if (window.location.pathname === "/login") return "/";

  return "";
}

export default function LoginScreen({ redirectTo = "" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [modo, setModo] = useState("login"); // login | registro | recuperar
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", ok: false });
  const [termsOk, setTermsOk] = useState(false);
  const [privacyOk, setPrivacyOk] = useState(false);

  const err = (text) => setMsg({ text, ok: false });
  const ok = (text) => setMsg({ text, ok: true });
  const reset = (nextMode) => {
    setModo(nextMode);
    setMsg({ text: "", ok: false });
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const redirect = resolveRedirect(redirectTo);
      if (user && redirect && window.location.pathname !== redirect) {
        window.location.assign(redirect);
      }
    });
    return () => unsub();
  }, [redirectTo]);

  const redirectAfterLogin = () => {
    const redirect = resolveRedirect(redirectTo);
    if (redirect) {
      window.location.assign(redirect);
    }
  };

  const handleAuth = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) return err("Completá correo y contraseña.");
    if (password.length < 6) return err("La contraseña debe tener al menos 6 caracteres.");
    if (modo === "registro" && (!termsOk || !privacyOk)) return err("Debés aceptar los Términos y la Política de Privacidad para crear una cuenta.");

    setMsg({ text: "", ok: false });
    setLoading(true);
    try {
      if (modo === "login") {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
        redirectAfterLogin();
        return;
      }

      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      sendEmailVerification(cred.user).catch(() => {});
      ok("Cuenta creada. Te enviamos un correo para verificar tu dirección.");
      redirectAfterLogin();
    } catch (e) {
      if (e.code === "auth/user-not-found") err("No encontramos una cuenta con ese correo.");
      else if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") err("Contraseña incorrecta. Revisá los datos e intentá de nuevo.");
      else if (e.code === "auth/email-already-in-use") err("Ese correo ya tiene cuenta. Ingresá con tu contraseña.");
      else if (e.code === "auth/too-many-requests") err("Demasiados intentos. Esperá unos minutos e intentá de nuevo.");
      else err("No se pudo iniciar sesión. Revisá correo y contraseña.");
    } finally {
      setLoading(false);
    }
  };

  const handleRecuperar = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return err("Ingresá tu correo.");
    setLoading(true);
    setMsg({ text: "", ok: false });
    try {
      const res = await fetch("/api/send-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || "Error");
      ok("Correo enviado. Revisá bandeja de entrada, spam o promociones.");
    } catch {
      err("No se pudo enviar el correo. Verificá que el email sea correcto.");
    } finally {
      setLoading(false);
    }
  };

  if (modo === "recuperar") {
    return (
      <Shell>
        <Brand />
        <Panel>
          <div>
            <p className="text-lg font-black text-white">Recuperar acceso</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Ingresá el correo de tu cuenta. Te mandamos un link para crear una contraseña nueva.
            </p>
          </div>

          <Field
            icon={<Mail size={16} />}
            type="email"
            label="Correo del taller"
            placeholder="tuemail@taller.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <MsgLine msg={msg} />

          <PrimaryButton onClick={handleRecuperar} disabled={loading}>
            {loading ? "Enviando..." : "Enviar link de recuperación"}
          </PrimaryButton>

          <button
            onClick={() => reset("login")}
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <ArrowLeft size={14} /> Volver al login
          </button>
        </Panel>
      </Shell>
    );
  }

  return (
    <Shell>
      <Brand />

      <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-[#141414] p-1">
        <Tab active={modo === "login"} onClick={() => reset("login")}>Ingresar</Tab>
        <Tab active={modo === "registro"} onClick={() => reset("registro")}>Crear cuenta</Tab>
      </div>

      <Panel>
        <div>
          <p className="text-lg font-black text-white">
            {modo === "login" ? "Entrar al taller" : "Crear cuenta de taller"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            {modo === "login"
              ? "Usá el correo y contraseña con los que registraste MotoGestión."
              : "Creá el acceso inicial. Después vas a poder configurar datos, planes y comprobantes."}
          </p>
        </div>

        <Field
          icon={<Mail size={16} />}
          type="email"
          label="Correo"
          placeholder="tuemail@taller.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="relative">
          <Field
            icon={<LockKeyhole size={16} />}
            type={showPass ? "text" : "password"}
            label="Contraseña"
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
          />
          <button
            type="button"
            onClick={() => setShowPass((value) => !value)}
            className="absolute bottom-[15px] right-4 text-zinc-500 transition-colors hover:text-zinc-300"
            aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>

        {modo === "registro" && (
          <div className="space-y-2.5">
            <ConsentCheck
              id="terms"
              checked={termsOk}
              onChange={(e) => setTermsOk(e.target.checked)}
            >
              Acepto los{" "}
              <a href="https://motogestion.ar/terminos" target="_blank" rel="noopener noreferrer" className="text-orange-400 underline">
                Términos y Condiciones
              </a>
            </ConsentCheck>
            <ConsentCheck
              id="privacy"
              checked={privacyOk}
              onChange={(e) => setPrivacyOk(e.target.checked)}
            >
              Acepto la{" "}
              <a href="https://motogestion.ar/privacidad" target="_blank" rel="noopener noreferrer" className="text-orange-400 underline">
                Política de Privacidad
              </a>
            </ConsentCheck>
          </div>
        )}

        <MsgLine msg={msg} />

        <PrimaryButton onClick={handleAuth} disabled={loading}>
          {loading
            ? "Procesando..."
            : modo === "login"
              ? "Ingresar a MotoGestión"
              : "Crear mi cuenta"}
        </PrimaryButton>

        {modo === "login" && (
          <button
            type="button"
            onClick={() => reset("recuperar")}
            className="w-full text-center text-[11px] font-black uppercase tracking-widest text-zinc-600 transition-colors hover:text-zinc-400"
          >
            Olvidé mi contraseña
          </button>
        )}
      </Panel>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-[#080808] px-5 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-sm flex-col justify-center">
        {children}
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-orange-500/30 bg-black shadow-xl shadow-orange-600/20">
        <img src="/brand/motogestion-icon.png" alt="MotoGestión" className="h-full w-full object-cover" />
      </div>
      <div className="mt-5 overflow-hidden rounded-3xl border border-orange-500/20 bg-black/70 px-3 py-4 shadow-inner">
        <img
          src="/brand/motogestion-banner.png"
          alt="MotoGestión - Sistema de gestión para talleres de motos"
          className="h-auto max-h-36 w-full object-contain"
        />
      </div>
      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.24em] text-orange-500">
        Gestión para talleres de motos
      </p>
    </div>
  );
}

function Panel({ children }) {
  return (
    <div className="mt-3 space-y-4 rounded-3xl border border-white/10 bg-[#141414] p-6 shadow-2xl">
      {children}
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl py-3 text-xs font-black uppercase tracking-wider transition-all ${
        active ? "bg-orange-600 text-white shadow-lg shadow-orange-600/20" : "text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ icon, label, ...props }) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{label}</span>}
      <span className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-4 py-3.5 transition-all focus-within:border-orange-500/60 focus-within:bg-black">
        {icon && <span className="text-zinc-500">{icon}</span>}
        <input
          {...props}
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-700"
        />
      </span>
    </label>
  );
}

function PrimaryButton({ onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-2xl bg-orange-600 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/20 transition-all active:scale-[0.98] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function MsgLine({ msg }) {
  if (!msg.text) return null;
  return (
    <p className={`rounded-2xl px-4 py-3 text-xs font-bold leading-relaxed ${msg.ok ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
      {msg.text}
    </p>
  );
}

function ConsentCheck({ id, checked, onChange, children }) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 cursor-pointer">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 shrink-0 accent-orange-600 cursor-pointer"
      />
      <span className="text-xs leading-relaxed text-zinc-400">{children}</span>
    </label>
  );
}
