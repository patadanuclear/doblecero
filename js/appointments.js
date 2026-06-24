import { auth, db, hasFirebaseConfig } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
  where,
  query
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const page = window.location.pathname.split("/").pop() || "index.html";
const appointmentForm = document.querySelector("#appointmentForm");
const artistPanel = document.querySelector("[data-artist-panel]");
const producerPanel = document.querySelector("[data-producer-panel]");
const artistList = document.querySelector("[data-artist-appointments]");
const producerList = document.querySelector("[data-producer-appointments]");
const isFileProtocol = window.location.protocol === "file:";

const statusOptions = ["pendiente", "confirmado", "cancelado", "completado"];

function roleLabel(role) {
  return role === "producer" ? "Productor / Administrador" : "Artista / Cliente";
}

function normalizeRole(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized.includes("producer") || normalized.includes("productor")) return "producer";
  return "artist";
}

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
  const field = form.querySelector(`[name="${fieldName}"]`)?.closest(".field");
  if (slot) slot.textContent = message;
  if (field) field.classList.add("has-error");
}

function setLoading(form, isLoading, label) {
  const button = form.querySelector("[data-submit-button]");
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = isLoading ? "Guardando..." : label;
}

function firebaseErrorMessage(error) {
  const messages = {
    "permission-denied": "Firestore rechazo la operacion. Revisa las reglas de users y appointments.",
    "unavailable": "Firebase no respondio. Proba de nuevo en unos minutos.",
    "not-found": "Firestore no esta creado o no esta disponible."
  };
  return messages[error?.code] || error?.message || "No se pudo completar la operacion.";
}

function validateAppointment(form) {
  clearErrors(form);
  const data = Object.fromEntries(new FormData(form));
  let valid = true;

  if (!data.service) {
    showFieldError(form, "service", "Elegí un servicio.");
    valid = false;
  }

  if (!data.artistName || data.artistName.trim().length < 2) {
    showFieldError(form, "artistName", "Ingresá un nombre de al menos 2 caracteres.");
    valid = false;
  }

  if (!data.date) {
    showFieldError(form, "date", "Elegí una fecha.");
    valid = false;
  }

  if (!data.time) {
    showFieldError(form, "time", "Elegí un horario.");
    valid = false;
  }

  return valid ? data : null;
}

async function getUserProfile(user) {
  const fallback = {
    uid: user.uid,
    name: user.displayName || "Usuario DOBLECERO",
    email: user.email || "",
    role: "artist"
  };

  const snapshot = await getDoc(doc(db, "users", user.uid));
  const profile = snapshot.exists() ? { ...fallback, ...snapshot.data() } : fallback;
  return { ...profile, role: normalizeRole(profile.role) };
}

function normalizeAppointments(snapshot) {
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => `${b.date || ""}${b.time || ""}`.localeCompare(`${a.date || ""}${a.time || ""}`));
}

function appointmentCard(appointment, mode) {
  const article = document.createElement("article");
  article.className = "appointment-item";

  const statusMarkup = mode === "producer"
    ? `<select class="status-select" data-status-id="${appointment.id}" aria-label="Cambiar estado">
        ${statusOptions.map((status) => `<option value="${status}" ${appointment.status === status ? "selected" : ""}>${status}</option>`).join("")}
      </select>`
    : `<strong class="status-pill">${appointment.status || "pendiente"}</strong>`;

  article.innerHTML = `
    <div>
      <span>${appointment.service || "Servicio"}</span>
      <h3>${appointment.artistName || appointment.userName || "Cliente"}</h3>
      <p>${appointment.notes || "Sin observaciones."}</p>
    </div>
    <dl>
      <div><dt>Fecha</dt><dd>${appointment.date || "-"}</dd></div>
      <div><dt>Hora</dt><dd>${appointment.time || "-"}</dd></div>
      <div><dt>Email</dt><dd>${appointment.userEmail || "-"}</dd></div>
      <div><dt>Estado</dt><dd>${statusMarkup}</dd></div>
    </dl>
  `;

  return article;
}

function renderAppointments(container, appointments, mode) {
  if (!container) return;
  container.innerHTML = "";

  if (!appointments.length) {
    container.innerHTML = `<p class="empty-state">Todavía no hay turnos cargados.</p>`;
    return;
  }

  appointments.forEach((appointment) => {
    container.appendChild(appointmentCard(appointment, mode));
  });
}

async function loadArtistAppointments(user) {
  const appointmentQuery = query(collection(db, "appointments"), where("userId", "==", user.uid));
  const snapshot = await getDocs(appointmentQuery);
  renderAppointments(artistList, normalizeAppointments(snapshot), "artist");
}

async function loadProducerAppointments() {
  const snapshot = await getDocs(collection(db, "appointments"));
  renderAppointments(producerList, normalizeAppointments(snapshot), "producer");
}

async function setupDashboard(user) {
  const profile = await getUserProfile(user);
  const isProducer = profile.role === "producer";

  artistPanel.hidden = isProducer;
  producerPanel.hidden = !isProducer;

  if (isProducer) {
    await loadProducerAppointments();
  } else {
    await loadArtistAppointments(user);
  }
}

if ((page === "appointment.html" || page === "dashboard.html") && (!hasFirebaseConfig || isFileProtocol)) {
  window.location.href = "login.html";
}

if (appointmentForm && hasFirebaseConfig && !isFileProtocol) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    let profile = null;

    try {
      profile = await getUserProfile(user);
    } catch (error) {
      setAlert(appointmentForm, firebaseErrorMessage(error));
      return;
    }

    if (profile.role === "producer") {
      setAlert(appointmentForm, "Los productores administran turnos desde el panel y no pueden reservar como clientes.");
      window.setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 900);
      return;
    }

    appointmentForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = validateAppointment(appointmentForm);
      if (!data) return;

      try {
        setLoading(appointmentForm, true, "Guardar turno");
        await addDoc(collection(db, "appointments"), {
          userId: user.uid,
          userName: profile.name || user.displayName || data.artistName.trim(),
          userEmail: profile.email || user.email || "",
          role: profile.role || "artist",
          service: data.service,
          artistName: data.artistName.trim(),
          date: data.date,
          time: data.time,
          notes: data.notes?.trim() || "",
          status: "pendiente",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        setAlert(appointmentForm, "Turno guardado. Redirigiendo al panel...", "success");
        window.setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 700);
      } catch (error) {
        setAlert(appointmentForm, firebaseErrorMessage(error));
      } finally {
        setLoading(appointmentForm, false, "Guardar turno");
      }
    }, { once: true });
  });
}

if (page === "dashboard.html" && artistPanel && producerPanel && hasFirebaseConfig && !isFileProtocol) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    try {
      await setupDashboard(user);
    } catch (error) {
      const visibleList = producerPanel.hidden ? artistList : producerList;
      if (visibleList) {
        visibleList.innerHTML = `<p class="empty-state">${firebaseErrorMessage(error)}</p>`;
      }
    }
  });
}

producerList?.addEventListener("change", async (event) => {
  const select = event.target.closest("[data-status-id]");
  if (!select) return;

  try {
    select.disabled = true;

    if (select.value === "completado") {
      await deleteDoc(doc(db, "appointments", select.dataset.statusId));
      select.closest(".appointment-item")?.remove();

      if (producerList && !producerList.querySelector(".appointment-item")) {
        producerList.innerHTML = `<p class="empty-state">Todavía no hay turnos cargados.</p>`;
      }
      return;
    }

    await updateDoc(doc(db, "appointments", select.dataset.statusId), {
      status: select.value,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    window.alert(firebaseErrorMessage(error));
  } finally {
    select.disabled = false;
  }
});
