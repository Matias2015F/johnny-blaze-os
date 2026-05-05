import React, { useState, useRef } from "react";
import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPhoneNumber,
  RecaptchaVerifier,
} from "firebase/auth";
import { Eye, EyeOff, Phone, Mail, ArrowLeft } from "lucide-react";

const COUNTRY_CODES = [
  { label: "🇦🇷 +549 AR celular", value: "+549" },
  { label: "🇦🇷 +54 AR fijo",    value: "+54" },
  { label: "🇺🇾 +598",           value: "+598" },
  { label: "🇨🇱 +56",            value: "+56" },
  { label: "🇧🇷 +55",            value: "+55" },
  { label: "🇺🇸 +1",             value: "+1" },
];

export default function LoginScreen() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  // modo: login | registro | recuperar | telefono | otp
  const [modo, setModo]         = useState("login");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState({ text: "", ok: false });

  const [countryCode, setCountryCode]     = useState("+549");
  const [phone, setPhone]                 = useState("");
  const [otpCode, setOtpCode]             = useState("");
  const [confirmResult, setConfirmResult] = useState(null);
  const recaptchaRef = useRef(null);

  const err   = (text) => setMsg({ text, ok: false });
  const ok    = (text) => setMsg({ text, ok: true });
  const reset = (m)    => { setModo(m); setMsg({ text: "", ok: false }); };

  // ── EMAIL AUTH ─────────────────────────────────────────────────────
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
      if (e.code === "auth/user-not-found")               err("No encontramos una cuenta con ese correo");
      else if (e.code === "auth/wrong-password" ||
               e.code === "auth/invalid-credential")      err("Contraseña incorrecta — revisá y volvé a intentar");
      else if (e.code === "auth/email-already-in-use")    err("Ese correo ya tiene cuenta — ingresá con tu contraseña");
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

  // ── PHONE AUTH ─────────────────────────────────────────────────────
  const getRecaptcha = () => {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        callback: () => {},
      });
    }
    return recaptchaRef.current;
  };

  const clearRecaptcha = () => {
    recaptchaRef.current?.clear();
    recaptchaRef.current = null;
  };

  const handleSendOTP = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 6) return err("Ingresá el número completo");
    setLoading(true);
    setMsg({ text: "", ok: false });
    try {
      const fullPhone = countryCode + digits;
      const result = await signInWithPhoneNumber(auth, fullPhone, getRecaptcha());
      setConfirmResult(result);
      setModo("otp");
      setMsg({ text: "", ok: false });
    } catch (e) {
      clearRecaptcha();
      console.error("Phone OTP error:", e.code, e.message);
      if (e.code === "auth/invalid-phone-number")
        err("Número inválido — incluí el código de área sin el 0");
      else if (e.code === "auth/too-many-requests")
        err("Demasiados intentos — esperá unos minutos");
      else if (e.code === "auth/operation-not-allowed")
        err("El login con teléfono no está activado en Firebase. Activalo en Firebase Console → Authentication → Sign-in method → Phone.");
      else if (e.code === "auth/app-not-authorized" || e.code === "auth/unauthorized-domain")
        err("Este dominio no está autorizado en Firebase. Agregá johnny-blaze-os.vercel.app en Authentication → Authorized domains.");
      else if (e.code === "auth/quota-exceeded")
        err("Límite de SMS alcanzado — el plan gratuito de Firebase no envía SMS reales. Activá el plan Blaze en Firebase.");
      else if (e.code === "auth/missing-phone-number")
        err("Ingresá un número de teléfono");
      else
        err(`Error: ${e.code || e.message || "desconocido"}`);
    }
    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length < 4) return err("Ingresá el código recibido");
    setLoading(true);
    setMsg({ text: "", ok: false });
    try {
      await confirmResult.confirm(otpCode);
    } catch (e) {
      if (e.code === "auth/invalid-verification-code") err("Código incorrecto — revisá el SMS");
      else if (e.code === "auth/code-expired")          err("El código venció — pedí uno nuevo");
      else err("No se pudo verificar el código. Intentá de nuevo.");
    }
    setLoading(false);
  };

  // ── COMPONENTES ────────────────────────────────────────────────────
  const Header = () => (
    <div style={{ marginBottom: "28px" }}>
      <h2 style={s.title}>JOHNNY BLAZE</h2>
      <p style={s.sub}>Sistema de Gestión para Talleres</p>
    </div>
  );

  const MsgLine = () => msg.text
    ? <p style={{ ...s.msg, color: msg.ok ? "#22c55e" : "#ef4444" }}>{msg.text}</p>
    : null;

  const BackBtn = ({ to }) => (
    <button onClick={() => reset(to)} style={s.back}>
      <ArrowLeft size={14} style={{ display: "inline", marginRight: 4 }} />
      Volver
    </button>
  );

  const Divider = () => (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "16px 0" }}>
      <div style={{ flex: 1, height: "1px", background: "#222" }} />
      <span style={{ color: "#444", fontSize: "10px", fontWeight: "bold" }}>O</span>
      <div style={{ flex: 1, height: "1px", background: "#222" }} />
    </div>
  );

  // ── PANTALLA: CÓDIGO OTP ───────────────────────────────────────────
  if (modo === "otp") return (
    <div style={s.container}>
      <div id="recaptcha-container" />
      <div style={s.card}>
        <Header />
        <div style={{ background: "#0f172a", borderRadius: "12px", padding: "14px", marginBottom: "18px" }}>
          <p style={{ color: "#94a3b8", fontSize: "11px", fontWeight: "bold", marginBottom: "2px" }}>
            Código enviado a
          </p>
          <p style={{ color: "#fff", fontSize: "15px", fontWeight: "900" }}>
            {countryCode} {phone}
          </p>
          <p style={{ color: "#64748b", fontSize: "10px", marginTop: "4px" }}>
            Revisá tus mensajes de texto (SMS)
          </p>
        </div>

        <input
          type="text"
          inputMode="numeric"
          placeholder="● ● ● ● ● ●"
          value={otpCode}
          onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          style={{ ...s.input, textAlign: "center", fontSize: "26px", letterSpacing: "10px", fontWeight: "900" }}
          autoFocus
        />

        <MsgLine />
        <button onClick={handleVerifyOTP} style={s.button} disabled={loading || otpCode.length < 4}>
          {loading ? "VERIFICANDO..." : "INGRESAR AL TALLER"}
        </button>

        <button
          onClick={() => { setModo("telefono"); setOtpCode(""); clearRecaptcha(); setMsg({ text: "", ok: false }); }}
          style={s.back}
        >
          Cambiar número / reenviar código
        </button>
      </div>
    </div>
  );

  // ── PANTALLA: TELÉFONO ─────────────────────────────────────────────
  if (modo === "telefono") return (
    <div style={s.container}>
      <div id="recaptcha-container" />
      <div style={s.card}>
        <Header />
        <p style={{ color: "#94a3b8", fontSize: "11px", marginBottom: "18px", fontWeight: "bold", lineHeight: "1.5" }}>
          Ingresá tu número. Te enviamos un código por SMS para entrar sin contraseña.
        </p>

        <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <select
            value={countryCode}
            onChange={e => setCountryCode(e.target.value)}
            style={{ ...s.input, marginBottom: 0, width: "110px", flex: "none" }}
          >
            {COUNTRY_CODES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input
            type="tel"
            placeholder="Número sin 0 ni 15"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            style={{ ...s.input, marginBottom: 0, flex: 1 }}
            autoFocus
          />
        </div>
        <div style={{ background: "#0f172a", borderRadius: "10px", padding: "10px 12px", marginBottom: "16px", textAlign: "left" }}>
          <p style={{ color: "#64748b", fontSize: "10px", marginBottom: "4px", fontWeight: "bold" }}>Celular argentino: usá <span style={{ color: "#f97316" }}>+549</span></p>
          <p style={{ color: "#64748b", fontSize: "10px", margin: 0 }}>
            Ej: 0343-<strong style={{ color: "#94a3b8" }}>415-0664</strong> → ingresá <strong style={{ color: "#f97316" }}>3434150664</strong> con +549
          </p>
          <p style={{ color: "#64748b", fontSize: "10px", marginTop: "4px", margin: 0 }}>
            Sin el 0 del área, sin el 15, sin guiones.
          </p>
        </div>

        <MsgLine />
        <button onClick={handleSendOTP} style={s.button} disabled={loading}>
          {loading ? "ENVIANDO..." : "ENVIAR CÓDIGO SMS"}
        </button>
        <BackBtn to="login" />
      </div>
    </div>
  );

  // ── PANTALLA: RECUPERAR ────────────────────────────────────────────
  if (modo === "recuperar") return (
    <div style={s.container}>
      <div id="recaptcha-container" />
      <div style={s.card}>
        <Header />
        <p style={{ color: "#94a3b8", fontSize: "11px", marginBottom: "20px", fontWeight: "bold", lineHeight: "1.5" }}>
          Elegí cómo recuperar el acceso a tu cuenta.
        </p>

        {/* Opción email */}
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "14px", padding: "16px", marginBottom: "10px" }}>
          <p style={{ color: "#94a3b8", fontSize: "10px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>
            <Mail size={12} style={{ display: "inline", marginRight: 5 }} />
            Recuperar por email
          </p>
          <input
            type="email"
            placeholder="Tu correo electrónico"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ ...s.input, marginBottom: "10px", background: "#020617" }}
          />
          <button onClick={handleRecuperar} style={{ ...s.button, marginTop: 0, background: "#1e40af" }} disabled={loading}>
            {loading ? "ENVIANDO..." : "ENVIAR LINK DE RECUPERACIÓN"}
          </button>
        </div>

        {/* Divider */}
        <Divider />

        {/* Opción teléfono */}
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "14px", padding: "16px", marginBottom: "16px" }}>
          <p style={{ color: "#94a3b8", fontSize: "10px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>
            <Phone size={12} style={{ display: "inline", marginRight: 5 }} />
            Entrar con teléfono (sin contraseña)
          </p>
          <p style={{ color: "#64748b", fontSize: "10px", marginBottom: "10px", lineHeight: "1.5" }}>
            Si te registraste con tu número de teléfono, podés ingresar directamente con un SMS.
          </p>
          <button
            onClick={() => reset("telefono")}
            style={{ ...s.button, marginTop: 0, background: "#064e3b", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          >
            <Phone size={14} /> RECUPERAR CON TELÉFONO
          </button>
        </div>

        <MsgLine />
        <BackBtn to="login" />
      </div>
    </div>
  );

  // ── PANTALLA: LOGIN / REGISTRO ─────────────────────────────────────
  return (
    <div style={s.container}>
      <div id="recaptcha-container" />
      <div style={s.card}>
        <Header />

        {/* Tabs login / registro */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "20px" }}>
          <button
            onClick={() => reset("login")}
            style={{ ...s.tab, ...(modo === "login" ? s.tabActive : {}) }}
          >
            Ingresar
          </button>
          <button
            onClick={() => reset("registro")}
            style={{ ...s.tab, ...(modo === "registro" ? s.tabActive : {}) }}
          >
            Crear cuenta
          </button>
        </div>

        {/* Email / password */}
        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={s.input}
        />
        <div style={{ position: "relative" }}>
          <input
            type={showPass ? "text" : "password"}
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={s.input}
            onKeyDown={e => e.key === "Enter" && handleAuth()}
          />
          <button onClick={() => setShowPass(!showPass)} style={s.eyeBtn}>
            {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <MsgLine />

        <button onClick={handleAuth} style={s.button} disabled={loading}>
          {loading ? "PROCESANDO..." : modo === "login" ? "INGRESAR AL TALLER" : "CREAR MI CUENTA GRATIS"}
        </button>

        {modo === "login" && (
          <button onClick={() => reset("recuperar")} style={s.reset}>
            ¿Olvidaste tu contraseña o número?
          </button>
        )}

        <Divider />

        {/* Botón teléfono — disponible en login Y registro */}
        <button
          onClick={() => reset("telefono")}
          style={{ ...s.button, background: "#0f172a", border: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: 0 }}
        >
          <Phone size={15} />
          {modo === "login" ? "INGRESAR CON TELÉFONO" : "REGISTRARSE CON TELÉFONO"}
        </button>
      </div>
    </div>
  );
}

const s = {
  container: {
    minHeight: "100vh",
    background: "#0b0b0b",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    color: "white",
    fontFamily: "sans-serif",
    padding: "16px",
  },
  card: {
    background: "#151515",
    padding: "36px 32px",
    borderRadius: "24px",
    width: "100%",
    maxWidth: "360px",
    textAlign: "center",
    border: "1px solid #222",
  },
  title:   { fontSize: "28px", fontWeight: "900", letterSpacing: "-1px", margin: 0 },
  sub:     { color: "#f97316", fontSize: "10px", fontWeight: "bold", marginTop: "5px" },
  input:   { width: "100%", padding: "14px", marginBottom: "12px", borderRadius: "12px", border: "1px solid #333", background: "#000", color: "white", outline: "none", boxSizing: "border-box", fontSize: "14px" },
  button:  { width: "100%", padding: "16px", borderRadius: "12px", border: "none", cursor: "pointer", fontWeight: "900", marginTop: "10px", background: "#f97316", color: "white", fontSize: "12px", letterSpacing: "0.5px", opacity: 1 },
  eyeBtn:  { position: "absolute", right: "12px", top: "16px", background: "none", border: "none", color: "#666", cursor: "pointer" },
  reset:   { marginTop: "12px", background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "10px", fontWeight: "bold", textDecoration: "underline", display: "block", width: "100%", textAlign: "center" },
  back:    { marginTop: "14px", background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "11px", fontWeight: "bold", display: "block", width: "100%", textAlign: "center" },
  msg:     { fontSize: "11px", marginBottom: "12px", fontWeight: "bold", lineHeight: "1.5" },
  tab:     { flex: 1, padding: "10px", borderRadius: "10px", border: "1px solid #333", background: "#000", color: "#666", fontSize: "11px", fontWeight: "900", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.5px" },
  tabActive: { background: "#f97316", color: "white", border: "1px solid #f97316" },
};
