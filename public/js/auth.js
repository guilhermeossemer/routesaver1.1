import { auth } from "./firebase-config.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ========================
// MODAL SIMPLES (AUTH)
// ========================
function showAuthModal(title, message) {
  // cria modal dinamicamente
  const modal = document.createElement("div");
  modal.style.position = "fixed";
  modal.style.inset = "0";
  modal.style.background = "rgba(0,0,0,0.6)";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.zIndex = "9999";

  modal.innerHTML = `
    <div style="
      background:#0f172a;
      padding:24px;
      border-radius:16px;
      max-width:320px;
      width:90%;
      text-align:center;
      color:white;
      box-shadow:0 20px 50px rgba(0,0,0,0.4);
    ">
      <h3 style="margin-bottom:10px;">${title}</h3>
      <p style="margin-bottom:20px;color:#cbd5e1;">${message}</p>
      <button style="
        background:#3b82f6;
        border:none;
        padding:10px 16px;
        border-radius:10px;
        color:white;
        font-weight:bold;
        cursor:pointer;
      ">OK</button>
    </div>
  `;

  modal.querySelector("button").onclick = () => {
    document.body.removeChild(modal);
  };

  document.body.appendChild(modal);
}

function goToDashboard() {
  const base = window.location.origin + window.location.pathname;

  if (base.includes("/public/pages/")) {
    window.location.href = "./dashboard.html";
  } else {
    window.location.href = "./public/pages/dashboard.html";
  }
}

// ========================
// CADASTRO
// ========================
const registerForm = document.getElementById("register-form");

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("register-email")?.value;
    const password = document.getElementById("register-password")?.value;

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      console.log("Usuário criado:", userCredential.user);

      showAuthModal("Conta criada!", "Cadastro realizado com sucesso.");
      goToDashboard();

    } catch (error) {
      console.error(error);
      showAuthModal("Erro", "Erro ao cadastrar: " + error.message);
    }
  });
}

// ========================
// LOGIN
// ========================
const loginForm = document.getElementById("login-form");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("login-email")?.value;
    const password = document.getElementById("login-password")?.value;

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      console.log("Logado:", userCredential.user);
      goToDashboard();

    } catch (error) {
      console.error(error);
      showAuthModal("Erro no login", error.message);
    }
  });
}