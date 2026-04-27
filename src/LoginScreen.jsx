import React, { useState } from "react";
import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Eye, EyeOff } from "lucide-react";

export default function LoginScreen() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [modo, setModo]         = useState("login"); // login | registro | recuperar
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState({ text: "", ok: false });

  const err = (text) => setMsg({ text, ok: false });
  const ok  = (text) => setMsg({ text, ok: true });

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
          email,
          estado: "trial",
          trialInicio: ahora,
          trialFin: ahora + 60 * 1000,
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

  // ── PANTALLA RECUPERAR ────────────────────────────────────────────
  if (modo === "recuperar") {
    return (
      <div style={s.container}>
        <div style={s.card}>
          <div style={{ marginBottom: "28px" }}>
            <h2 style={s.title}>JOHNNY BLAZE</h2>
            <p style={s.sub}>WORKSHOP OS</p>
          </div>

          <p style={{ color: "#888", fontSize: "11px", marginBottom: "20px", fontWeight: "bold" }}>
            Ingresá tu correo y te enviamos un link para restablecer la contraseña.
          </p>

          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={s.input}
          />

          {msg.text && (
            <p style={{ ...s.msg, color: msg.ok ? "#22c55e" : "#ef4444" }}>{msg.text}</p>
          )}

          <button onClick={handleRecuperar} style={s.button} disabled={loading}>
            {loading ? "ENVIANDO..." : "ENVIAR LINK DE RECUPERACIÓN"}
          </button>

          <button onClick={() => { setModo("login"); setMsg({ text: "", ok: false }); }} style={s.back}>
            ← Volver al login
          </button>
        </div>
      </div>
    );
  }

  // ── PANTALLA LOGIN / REGISTRO ─────────────────────────────────────
  return (
    <div style={s.container}>
      <div style={s.card}>
        <div style={{ marginBottom: "28px" }}>
          <h2 style={s.title}>JOHNNY BLAZE</h2>
          <p style={s.sub}>WORKSHOP OS</p>
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
            style={s.input}
          />
          <button onClick={() => setShowPass(!showPass)} style={s.eyeBtn}>
            {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {msg.text && (
          <p style={{ ...s.msg, color: msg.ok ? "#22c55e" : "#ef4444" }}>{msg.text}</p>
        )}

        <button onClick={handleAuth} style={s.button} disabled={loading}>
          {loading ? "PROCESANDO..." : modo === "login" ? "INGRESAR AL TALLER" : "CREAR CUENTA TRIAL"}
        </button>

        <p style={s.switch}>
          {modo === "login" ? "¿Sos nuevo?" : "¿Ya tenés cuenta?"}
          <span
            onClick={() => { setModo(modo === "login" ? "registro" : "login"); setMsg({ text: "", ok: false }); }}
            style={s.link}
          >
            {modo === "login" ? " EMPEZAR TRIAL" : " INGRESA AQUÍ"}
          </span>
        </p>

        {modo === "login" && (
          <button
            onClick={() => { setModo("recuperar"); setMsg({ text: "", ok: false }); }}
            style={s.reset}
          >
            ¿Olvidaste tu contraseña?
          </button>
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
  reset:     { marginTop: "15px", background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "10px", fontWeight: "bold", textDecoration: "underline" },
  back:      { marginTop: "16px", background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "11px", fontWeight: "bold" },
  msg:       { fontSize: "11px", marginBottom: "12px", fontWeight: "bold" },
};
