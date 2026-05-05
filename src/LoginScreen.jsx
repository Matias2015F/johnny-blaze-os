import React, { useState } from "react";
import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";

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

  const Header = () => (
    <div style={{ marginBottom: "28px" }}>
      <h2 style={s.title}>JOHNNY BLAZE</h2>
      <p style={s.sub}>Sistema de Gestión para Talleres</p>
    </div>
  );

  const MsgLine = () => msg.text
    ? <p style={{ ...s.msg, color: msg.ok ? "#22c55e" : "#ef4444" }}>{msg.text}</p>
    : null;

  // RECUPERAR
  if (modo === "recuperar") return (
    <div style={s.container}>
      <div style={s.card}>
        <Header />
        <p style={{ color: "#94a3b8", fontSize: "11px", marginBottom: "18px", fontWeight: "bold", lineHeight: "1.5" }}>
          Ingresá tu correo y te enviamos un link para restablecer la contraseña.
        </p>
        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={s.input}
        />
        <MsgLine />
        <button onClick={handleRecuperar} style={s.button} disabled={loading}>
          {loading ? "ENVIANDO..." : "ENVIAR LINK DE RECUPERACIÓN"}
        </button>
        <button onClick={() => reset("login")} style={s.back}>
          <ArrowLeft size={14} style={{ display: "inline", marginRight: 4 }} />
          Volver
        </button>
      </div>
    </div>
  );

  // LOGIN / REGISTRO
  return (
    <div style={s.container}>
      <div style={s.card}>
        <Header />

        <div style={{ display: "flex", gap: "6px", marginBottom: "20px" }}>
          <button onClick={() => reset("login")}    style={{ ...s.tab, ...(modo === "login"    ? s.tabActive : {}) }}>Ingresar</button>
          <button onClick={() => reset("registro")} style={{ ...s.tab, ...(modo === "registro" ? s.tabActive : {}) }}>Crear cuenta</button>
        </div>

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
            onKeyDown={e => e.key === "Enter" && handleAuth()}
            style={s.input}
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
            ¿Olvidaste tu contraseña?
          </button>
        )}
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
  title:     { fontSize: "28px", fontWeight: "900", letterSpacing: "-1px", margin: 0 },
  sub:       { color: "#f97316", fontSize: "10px", fontWeight: "bold", marginTop: "5px" },
  input:     { width: "100%", padding: "14px", marginBottom: "12px", borderRadius: "12px", border: "1px solid #333", background: "#000", color: "white", outline: "none", boxSizing: "border-box", fontSize: "14px" },
  button:    { width: "100%", padding: "16px", borderRadius: "12px", border: "none", cursor: "pointer", fontWeight: "900", marginTop: "10px", background: "#f97316", color: "white", fontSize: "12px", letterSpacing: "0.5px" },
  eyeBtn:    { position: "absolute", right: "12px", top: "16px", background: "none", border: "none", color: "#666", cursor: "pointer" },
  reset:     { marginTop: "12px", background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "10px", fontWeight: "bold", textDecoration: "underline", display: "block", width: "100%", textAlign: "center" },
  back:      { marginTop: "14px", background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "11px", fontWeight: "bold", display: "block", width: "100%", textAlign: "center" },
  msg:       { fontSize: "11px", marginBottom: "12px", fontWeight: "bold", lineHeight: "1.5" },
  tab:       { flex: 1, padding: "10px", borderRadius: "10px", border: "1px solid #333", background: "#000", color: "#666", fontSize: "11px", fontWeight: "900", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.5px" },
  tabActive: { background: "#f97316", color: "white", border: "1px solid #f97316" },
};
