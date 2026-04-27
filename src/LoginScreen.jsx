import React, { useState, useRef } from "react";
import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPhoneNumber,
  RecaptchaVerifier,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Eye, EyeOff, Phone, ArrowLeft } from "lucide-react";

const COUNTRY_CODES = [
  { label: "🇦🇷 +54", value: "+54" },
  { label: "🇺🇾 +598", value: "+598" },
  { label: "🇨🇱 +56", value: "+56" },
  { label: "🇧🇷 +55", value: "+55" },
  { label: "🇺🇸 +1", value: "+1" },
];

export default function LoginScreen() {
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [modo, setModo]             = useState("login"); // login | registro | recuperar | telefono | otp
  const [showPass, setShowPass]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [msg, setMsg]               = useState({ text: "", ok: false });

  // phone flow
  const [countryCode, setCountryCode] = useState("+54");
  const [phone, setPhone]             = useState("");
  const [otpCode, setOtpCode]         = useState("");
  const [confirmResult, setConfirmResult] = useState(null);
  const recaptchaRef = useRef(null);

  const err = (text) => setMsg({ text, ok: false });
  const ok  = (text) => setMsg({ text, ok: true });
  const reset = (m)  => { setModo(m); setMsg({ text: "", ok: false }); };

  // ── EMAIL AUTH ────────────────────────────────────────────────────
  const handleAuth = async () => {
    if (!email || !password) return err("Completá los campos");
    if (password.length < 6) return err("Mínimo 6 caracteres");
    setMsg({ text: "", ok: false });
    setLoading(true);
    try {
      if (modo === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        const ahora = Date.now();
        await setDoc(doc(db, "usuarios", res.user.uid), {
          email, estado: "trial", trialInicio: ahora, trialFin: ahora + 60 * 1000,
        });
      }
    } catch (e) {
      if (e.code === "auth/user-not-found")      err("El usuario no existe");
      else if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") err("Contraseña incorrecta");
      else if (e.code === "auth/email-already-in-use") err("El mail ya tiene cuenta");
      else err("Error: " + e.code);
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

  // ── PHONE AUTH ────────────────────────────────────────────────────
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
      if (e.code === "auth/invalid-phone-number")  err("Número inválido — incluí el código de área sin 0");
      else if (e.code === "auth/too-many-requests") err("Demasiados intentos, esperá unos minutos");
      else err("Error: " + e.code);
    }
    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length < 4) return err("Ingresá el código recibido");
    setLoading(true);
    setMsg({ text: "", ok: false });
    try {
      await confirmResult.confirm(otpCode);
      // App.jsx creará el doc de Firestore si el usuario es nuevo
    } catch (e) {
      if (e.code === "auth/invalid-verification-code") err("Código incorrecto");
      else if (e.code === "auth/code-expired")          err("Código expirado — pedí uno nuevo");
      else err("Error: " + e.code);
    }
    setLoading(false);
  };

  // ── PANTALLAS ─────────────────────────────────────────────────────
  const Header = () => (
    <div style={{ marginBottom: "28px" }}>
      <h2 style={s.title}>JOHNNY BLAZE</h2>
      <p style={s.sub}>WORKSHOP OS</p>
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

  // RECUPERAR
  if (modo === "recuperar") return (
    <div style={s.container}>
      <div style={s.card}>
        <Header />
        <p style={{ color: "#888", fontSize: "11px", marginBottom: "18px", fontWeight: "bold" }}>
          Ingresá tu correo y te enviamos un link para restablecer la contraseña.
        </p>
        <input type="email" placeholder="Correo electrónico" value={email}
          onChange={e => setEmail(e.target.value)} style={s.input} />
        <MsgLine />
        <button onClick={handleRecuperar} style={s.button} disabled={loading}>
          {loading ? "ENVIANDO..." : "ENVIAR LINK DE RECUPERACIÓN"}
        </button>
        <BackBtn to="login" />
      </div>
    </div>
  );

  // TELÉFONO
  if (modo === "telefono") return (
    <div style={s.container}>
      <div id="recaptcha-container" />
      <div style={s.card}>
        <Header />
        <p style={{ color: "#888", fontSize: "11px", marginBottom: "18px", fontWeight: "bold" }}>
          Ingresá tu número. Te enviaremos un código por SMS.
        </p>

        <div style={{ display: "flex", gap: "8px", marginBottom: "15px" }}>
          <select value={countryCode} onChange={e => setCountryCode(e.target.value)}
            style={{ ...s.input, marginBottom: 0, width: "110px", flex: "none" }}>
            {COUNTRY_CODES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input type="tel" placeholder="Número sin 0 ni 15" value={phone}
            onChange={e => setPhone(e.target.value)} style={{ ...s.input, marginBottom: 0, flex: 1 }} />
        </div>

        <p style={{ color: "#555", fontSize: "10px", marginBottom: "12px" }}>
          Ej: si tu número es 0343-412-3456 ingresá <strong style={{ color: "#888" }}>3434123456</strong>
        </p>

        <MsgLine />
        <button onClick={handleSendOTP} style={s.button} disabled={loading}>
          {loading ? "ENVIANDO..." : "ENVIAR CÓDIGO SMS"}
        </button>
        <BackBtn to="login" />
      </div>
    </div>
  );

  // OTP
  if (modo === "otp") return (
    <div style={s.container}>
      <div id="recaptcha-container" />
      <div style={s.card}>
        <Header />
        <p style={{ color: "#888", fontSize: "11px", marginBottom: "4px", fontWeight: "bold" }}>
          Código enviado a {countryCode} {phone}
        </p>
        <p style={{ color: "#555", fontSize: "10px", marginBottom: "18px" }}>
          Revisá tus mensajes de texto (SMS).
        </p>

        <input type="number" placeholder="Código de 6 dígitos" value={otpCode}
          onChange={e => setOtpCode(e.target.value)} style={{ ...s.input, textAlign: "center", fontSize: "22px", letterSpacing: "8px" }} />

        <MsgLine />
        <button onClick={handleVerifyOTP} style={s.button} disabled={loading}>
          {loading ? "VERIFICANDO..." : "INGRESAR AL TALLER"}
        </button>

        <button onClick={() => { setModo("telefono"); setOtpCode(""); clearRecaptcha(); setMsg({ text: "", ok: false }); }}
          style={s.back}>
          Cambiar número / reenviar código
        </button>
      </div>
    </div>
  );

  // LOGIN / REGISTRO
  return (
    <div style={s.container}>
      <div id="recaptcha-container" />
      <div style={s.card}>
        <Header />

        <input type="email" placeholder="Correo electrónico" value={email}
          onChange={e => setEmail(e.target.value)} style={s.input} />

        <div style={{ position: "relative" }}>
          <input type={showPass ? "text" : "password"} placeholder="Contraseña" value={password}
            onChange={e => setPassword(e.target.value)} style={s.input} />
          <button onClick={() => setShowPass(!showPass)} style={s.eyeBtn}>
            {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <MsgLine />

        <button onClick={handleAuth} style={s.button} disabled={loading}>
          {loading ? "PROCESANDO..." : modo === "login" ? "INGRESAR AL TALLER" : "CREAR CUENTA TRIAL"}
        </button>

        <p style={s.switch}>
          {modo === "login" ? "¿Sos nuevo?" : "¿Ya tenés cuenta?"}
          <span onClick={() => reset(modo === "login" ? "registro" : "login")} style={s.link}>
            {modo === "login" ? " EMPEZAR TRIAL" : " INGRESA AQUÍ"}
          </span>
        </p>

        {modo === "login" && (
          <>
            <button onClick={() => reset("recuperar")} style={s.reset}>
              ¿Olvidaste tu contraseña?
            </button>

            <div style={{ margin: "16px 0", borderTop: "1px solid #222" }} />

            <button onClick={() => reset("telefono")} style={{ ...s.button, background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <Phone size={15} /> INGRESAR CON TELÉFONO
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const s = {
  container: { minHeight: "100vh", background: "#0b0b0b", display: "flex", justifyContent: "center", alignItems: "center", color: "white", fontFamily: "sans-serif" },
  card:      { background: "#151515", padding: "40px", borderRadius: "24px", width: "340px", textAlign: "center", border: "1px solid #333" },
  title:     { fontSize: "28px", fontWeight: "900", letterSpacing: "-1px", margin: 0 },
  sub:       { color: "#f97316", fontSize: "10px", fontWeight: "bold", marginTop: "5px" },
  input:     { width: "100%", padding: "14px", marginBottom: "15px", borderRadius: "12px", border: "1px solid #333", background: "#000", color: "white", outline: "none", boxSizing: "border-box" },
  button:    { width: "100%", padding: "16px", borderRadius: "12px", border: "none", cursor: "pointer", fontWeight: "900", marginTop: "10px", background: "#f97316", color: "white", fontSize: "12px" },
  eyeBtn:    { position: "absolute", right: "12px", top: "18px", background: "none", border: "none", color: "#666", cursor: "pointer" },
  switch:    { marginTop: "20px", fontSize: "11px", color: "#666", fontWeight: "bold" },
  link:      { color: "#fff", cursor: "pointer", fontWeight: "900", marginLeft: "5px" },
  reset:     { marginTop: "12px", background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "10px", fontWeight: "bold", textDecoration: "underline" },
  back:      { marginTop: "14px", background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "11px", fontWeight: "bold" },
  msg:       { fontSize: "11px", marginBottom: "12px", fontWeight: "bold" },
};
