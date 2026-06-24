import { auth, db, hasFirebaseConfig } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const page = window.location.pathname.split("/").pop() || "index.html";
const loginForm = document.querySelector("#loginForm");
const registerForm = document.querySelector("#registerForm");
const loginLinks = [...document.querySelectorAll("[data-auth-login]")];
const panelLinks = [...document.querySelectorAll("[data-auth-panel]")];
const logoutButtons = [...document.querySelectorAll("[data-logout]")];
const artistOnlyLinks = [...document.querySelectorAll("[data-artist-only]")];
const searchParams = new URLSearchParams(window.location.search);
const isFileProtocol = window.location.protocol === "file:";

const firebaseMessage = "Firebase todavia no esta configurado. Pega tu configuracion real en js/firebase-config.js.";
const fileProtocolMessage = "Para usar Firebase Auth, abri el proyecto desde un servidor local o hosting. No lo abras con file://.";

function setAlert(form, message, type = "error") {
  const alert = form?.querySelector("[data-form-alert]");
  if (!alert) return;
  alert.textContent = message;
  alert.hidden = false;
  alert.classList.toggle("success", type === "success");
}

function clearErrors(form) {
  form.querySelectorAll("[data-error-for]").forEach((slot) => {
    slot.textContent = "";
  });
  form.querySelectorAll(".has-error").forEach((field) => {
    field.classList.remove("has-error");
  });
  const alert = form.querySelector("[data-form-alert]");
  if (alert) {
    alert.hidden = true;
    alert.textContent = "";
    alert.classList.remove("success");
  }
}

function showFieldError(form, fieldName, message) {
  const slot = form.querySelector(`[data-error-for="${fieldName}"]`);
  const field = form.querySelector(`[name="${fieldName}"]`)?.closest(".field") || slot?.closest(".role-select");
  if (slot) slot.textContent = message;
  if (field) field.classList.add("has-error");
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function roleLabel(role) {
  if (String(role).toLowerCase().includes("productor")) return "Productor / Administrador";
  if (String(role).toLowerCase().includes("artista")) return "Artista / Cliente";

  const labels = {
    artist: "Artista / Cliente",
    producer: "Productor / Administrador"
  };
  return labels[role] || role || "Rol no cargado";
}

function normalizeRole(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized.includes("producer") || normalized.includes("productor")) return "producer";
  return "artist";
}

function validateLogin(form) {
  clearErrors(form);
  const data = Object.fromEntries(new FormData(form));
  let valid = true;

  if (!isEmail(data.email || "")) {
    showFieldError(form, "email", "Ingresa un email valido.");
    valid = false;
  }

  if (!data.password || data.password.length < 6) {
    showFieldError(form, "password", "La contrasena debe tener al menos 6 caracteres.");
    valid = false;
  }

  return valid ? data : null;
}

function validateRegister(form) {
  clearErrors(form);
  const data = Object.fromEntries(new FormData(form));
  let valid = true;

  if (!data.name || data.name.trim().length < 2) {
    showFieldError(form, "name", "Ingresa un nombre de al menos 2 caracteres.");
    valid = false;
  }

  if (!isEmail(data.email || "")) {
    showFieldError(form, "email", "Ingresa un email valido.");
    valid = false;
  }

  if (!data.password || data.password.length < 6) {
    showFieldError(form, "password", "La contrasena debe tener al menos 6 caracteres.");
    valid = false;
  }

  if (data.confirmPassword !== data.password) {
    showFieldError(form, "confirmPassword", "Las contrasenas no coinciden.");
    valid = false;
  }

  if (!data.role) {
    showFieldError(form, "role", "Elegi un rol para crear tu perfil.");
    valid = false;
  }

  return valid ? data : null;
}

function setLoading(form, isLoading, label) {
  const button = form.querySelector("[data-submit-button]");
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = isLoading ? "Cargando..." : label;
}

function readableFirebaseError(error) {
  const code = error?.code || "";
  const messages = {
    "auth/email-already-in-use": "Ese email ya esta registrado.",
    "auth/invalid-email": "El email no es valido.",
    "auth/invalid-credential": "Email o contrasena incorrectos.",
    "auth/user-not-found": "No existe una cuenta con ese email.",
    "auth/wrong-password": "La contrasena es incorrecta.",
    "auth/operation-not-allowed": "Activa Email/Password en Firebase Authentication.",
    "auth/unauthorized-domain": "Este dominio no esta autorizado en Firebase Authentication. Agrega localhost o tu dominio en Firebase Console.",
    "auth/too-many-requests": "Firebase bloqueo intentos por seguridad. Espera un momento y proba de nuevo.",
    "auth/weak-password": "La contrasena es demasiado debil.",
    "auth/network-request-failed": "Hay un problema de conexion. Proba de nuevo.",
    "permission-denied": "La cuenta se creo, pero Firestore rechazo guardar el perfil. Revisa las reglas de la coleccion users.",
    "not-found": "La cuenta se creo, pero Firestore no esta disponible. Crea la base de datos en Firebase Console.",
    "unavailable": "Firebase no respondio. Revisa tu conexion y proba otra vez."
  };
  return messages[code] || error?.message || "No se pudo completar la operacion. Revisa los datos e intenta otra vez.";
}

async function createProfileDocument(user, data) {
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    name: data.name.trim(),
    email: data.email,
    role: data.role,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function getUserRole(user) {
  if (!user || !db) return null;

  try {
    const snapshot = await getDoc(doc(db, "users", user.uid));
    return normalizeRole(snapshot.exists() ? snapshot.data().role : "artist");
  } catch (error) {
    return null;
  }
}

if (hasFirebaseConfig && !isFileProtocol && (loginLinks.length || panelLinks.length || logoutButtons.length)) {
  onAuthStateChanged(auth, async (user) => {
    const role = user ? await getUserRole(user) : null;
    const isProducer = role === "producer";

    loginLinks.forEach((link) => {
      link.hidden = Boolean(user);
    });

    panelLinks.forEach((link) => {
      link.hidden = !user;
    });

    logoutButtons.forEach((button) => {
      button.hidden = !user;
    });

    artistOnlyLinks.forEach((link) => {
      link.hidden = isProducer;
    });
  });
}

if (loginForm && searchParams.get("registered") === "1") {
  setAlert(loginForm, "Cuenta creada correctamente. Ahora inicia sesion con tu email y contrasena.", "success");
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = validateLogin(loginForm);
    if (!data) return;

    if (isFileProtocol) {
      setAlert(loginForm, fileProtocolMessage);
      return;
    }

    if (!hasFirebaseConfig) {
      setAlert(loginForm, firebaseMessage);
      return;
    }

    try {
      setLoading(loginForm, true, "Entrar");
      await signInWithEmailAndPassword(auth, data.email, data.password);
      window.location.href = "dashboard.html";
    } catch (error) {
      setAlert(loginForm, readableFirebaseError(error));
    } finally {
      setLoading(loginForm, false, "Entrar");
    }
  });
}

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = validateRegister(registerForm);
    if (!data) return;

    if (isFileProtocol) {
      setAlert(registerForm, fileProtocolMessage);
      return;
    }

    if (!hasFirebaseConfig) {
      setAlert(registerForm, firebaseMessage);
      return;
    }

    let accountWasCreated = false;

    try {
      setLoading(registerForm, true, "Crear cuenta");
      const credential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      accountWasCreated = true;
      await updateProfile(credential.user, { displayName: data.name.trim() });
      await createProfileDocument(credential.user, data);
      await signOut(auth);
      setAlert(registerForm, "Cuenta creada. Redirigiendo a login...", "success");
      window.setTimeout(() => {
        window.location.href = "login.html?registered=1";
      }, 600);
    } catch (error) {
      if (accountWasCreated && auth?.currentUser) {
        await signOut(auth).catch(() => {});
      }
      setAlert(registerForm, readableFirebaseError(error));
    } finally {
      setLoading(registerForm, false, "Crear cuenta");
    }
  });
}

if (page === "dashboard.html") {
  if (!hasFirebaseConfig || isFileProtocol) {
    window.location.href = "login.html";
  } else {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "login.html";
        return;
      }

      let profile = {
        name: user.displayName || "Usuario DOBLECERO",
        email: user.email || "-",
        role: "Rol no cargado"
      };

      try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        if (snapshot.exists()) {
          profile = { ...profile, ...snapshot.data() };
        }
      } catch (error) {
        profile.role = "No se pudo leer Firestore";
      }

      document.querySelector("[data-user-name]").textContent = `Bienvenido, ${profile.name}`;
      document.querySelector("[data-welcome]").textContent = "Tu sesion esta activa y protegida con Firebase Authentication.";
      document.querySelector("[data-profile-name]").textContent = profile.name;
      document.querySelector("[data-profile-email]").textContent = profile.email;
      document.querySelector("[data-profile-role]").textContent = roleLabel(profile.role);
    });
  }
}

logoutButtons.forEach((button) => button.addEventListener("click", async () => {
  if (!hasFirebaseConfig) {
    window.location.href = "login.html";
    return;
  }

  await signOut(auth);
  window.location.href = "login.html";
}));
