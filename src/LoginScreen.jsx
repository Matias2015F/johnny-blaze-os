import React, { useState } from "react";
import { auth, db } from "./firebase.js";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail 
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Eye, EyeOff, LogIn, UserPlus, Mail } from "lucide-react";

// ✅ IMPORTANTE: El "export default" debe estar aquí, al inicio de la función
export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [modo, setModo] = useState("login"); // login | registro
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleAuth = async () => {
    if (!email || !password) return setErrorMsg("Completá los campos");
    if (password.length < 6) return setErrorMsg("Mínimo 6 caracteres");
    
    setErrorMsg("");
    setLoading(true);

    try {
      if (modo === "login") {
        // 🔑 MODO LOGIN
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // 📝 MODO REGISTRO
        const res = await createUserWithEmailAndPassword(auth, email, password);
        
        const ahora = Date.now();
        const unMinuto = 60 * 1000;

        // Escribimos el trial en Firestore con el UID del nuevo usuario
        await setDoc(doc(db, "usuarios", res.user.uid), {
          email: email,
          estado: "trial",
          trialInicio: ahora,
          trialFin: ahora + unMinuto
        });
      }
    } catch (error) {
      console.error("Auth Error:", error.code);
      if (error.code === "auth/user-not-found") setErrorMsg("El usuario no existe");
      else if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") setErrorMsg("Contraseña incorrecta");
      else if (error.code === "auth/email-already-in-use") setErrorMsg("El mail ya tiene cuenta");
      else setErrorMsg("Error: " + error.code);
    }
    setLoading(false);
  };

  const resetPassword = async () => {
    if (!email) return setErrorMsg("Ingresá tu correo primero");
    try {
      await sendPasswordResetEmail(auth, email);
      setErrorMsg("Correo de recuperación enviado");
    } catch {
      setErrorMsg("Error al enviar recuperación");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{ marginBottom: "30px" }}>
          <h2 style={{ fontSize: "28px", fontWeight: "900", letterSpacing: "-1px", margin: 0 }}>JOHNNY BLAZE</h2>
          <p style={{ color: "#f97316", fontSize: "10px", fontWeight: "bold", tracking: "2px", marginTop: "5px" }}>WORKSHOP OS</p>
        </div>

        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
        />

        <div style={{ position: "relative" }}>
          <input
            type={showPass ? "text" : "password"}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />
          <button 
            onClick={() => setShowPass(!showPass)}
            style={styles.eyeBtn}
          >
            {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {errorMsg && <p style={styles.error}>{errorMsg}</p>}

        <button onClick={handleAuth} style={styles.button} disabled={loading}>
          {loading ? "PROCESANDO..." : modo === "login" ? "INGRESAR AL TALLER" : "CREAR CUENTA TRIAL"}
        </button>

        <p style={styles.switch}>
          {modo === "login" ? "¿Sos nuevo?" : "¿Ya tenés cuenta?"}
          <span onClick={() => setModo(modo === "login" ? "registro" : "login")} style={styles.link}>
            {modo === "login" ? " EMPEZAR TRIAL" : " INGRESA AQUÍ"}
          </span>
        </p>

        <button onClick={resetPassword} style={styles.reset}>
          ¿Olvidaste tu contraseña?
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", background: "#0b0b0b", display: "flex", justifyContent: "center", alignItems: "center", color: "white", fontFamily: "sans-serif" },
  card: { background: "#151515", padding: "40px", borderRadius: "24px", width: "340px", textAlign: "center", border: "1px solid #333" },
  input: { width: "100%", padding: "14px", marginBottom: "15px", borderRadius: "12px", border: "1px solid #333", background: "#000", color: "white", outline: "none", boxSizing: "border-box" },
  button: { width: "100%", padding: "16px", borderRadius: "12px", border: "none", cursor: "pointer", fontWeight: "900", marginTop: "10px", background: "#f97316", color: "white", fontSize: "12px" },
  eyeBtn: { position: "absolute", right: "12px", top: "18px", background: "none", border: "none", color: "#666", cursor: "pointer" },
  switch: { marginTop: "20px", fontSize: "11px", color: "#666", fontWeight: "bold" },
  link: { color: "#fff", cursor: "pointer", fontWeight: "900", marginLeft: "5px" },
  reset: { marginTop: "15px", background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: "10px", fontWeight: "bold" },
  error: { color: "#ef4444", fontSize: "11px", marginBottom: "15px", fontWeight: "bold" }
};