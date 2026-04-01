const ORS_API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjRiM2ZmYzgyMTk4ODQ5NGE5YzM0ZGNjOTBkOGM3ZGMzIiwiaCI6Im11cm11cjY0In0=";
import { auth, db } from "./firebase-config.js";
import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    updateDoc,
    doc,
    query,
    where,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* =========================================================
   ELEMENTOS
========================================================= */
const logoutBtn = document.getElementById("logout-btn");
const startRouteBtn = document.getElementById("start-route-btn");
const undoPointBtn = document.getElementById("undo-point-btn");
const clearRouteBtn = document.getElementById("clear-route-btn");
const saveRouteBtn = document.getElementById("save-route-btn");

const routeNameInput = document.getElementById("route-name");
const routeStatusEl = document.getElementById("route-status");
const routePointsCountEl = document.getElementById("route-points-count");
const routeDistanceEl = document.getElementById("route-distance");
const routesListEl = document.getElementById("routes-list");
const routesCounterEl = document.getElementById("routes-counter");

const statTotalRoutesEl = document.getElementById("stat-total-routes");
const statTotalKmEl = document.getElementById("stat-total-km");
const statAvgKmEl = document.getElementById("stat-avg-km");

const searchRoutesInput = document.getElementById("search-routes-input");
const sortRoutesSelect = document.getElementById("sort-routes-select");

const customModal = document.getElementById("custom-modal");
const modalIcon = document.getElementById("modal-icon");
const modalTitle = document.getElementById("modal-title");
const modalMessage = document.getElementById("modal-message");
const modalInput = document.getElementById("modal-input");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalCancelBtn = document.getElementById("modal-cancel-btn");
const locationSearchInput = document.getElementById("location-search-input");
const locationSearchBtn = document.getElementById("location-search-btn");
const locationSearchResults = document.getElementById("location-search-results");

/* =========================================================
   MAPA
========================================================= */
const map = L.map("map").setView([-26.3044, -48.8487], 13); // Joinville

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

/* =========================================================
   ESTADO
========================================================= */
let currentUser = null;
let isDrawingRoute = false;

let tempPoints = [];
let tempMarkers = [];
let tempPolyline = null;

let selectedRouteLayer = null;
let selectedRouteMarkers = [];

let allRoutes = [];
let selectedRouteId = null;
let currentRouteDistance = 0;
let modalCloseTimeout = null;

/* =========================================================
   AUTH
========================================================= */
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "../../index.html";
        return;
    }

    currentUser = user;
    loadRoutes();
});

logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.href = "../../index.html";
    } catch (error) {
        console.error("Erro ao sair:", error);
        showModal("Erro", "Não foi possível sair da conta.", "error");
    }
});

/* =========================================================
   EVENTOS
========================================================= */
startRouteBtn.addEventListener("click", toggleDrawingMode);
undoPointBtn.addEventListener("click", undoLastPoint);
clearRouteBtn.addEventListener("click", clearCurrentRoute);
saveRouteBtn.addEventListener("click", saveCurrentRoute);

searchRoutesInput.addEventListener("input", applyRoutesFilters);
sortRoutesSelect.addEventListener("change", applyRoutesFilters);

locationSearchBtn.addEventListener("click", searchLocationByName);

locationSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        searchLocationByName();
    }
});

map.on("click", (e) => {
    if (!isDrawingRoute) return;

    const { lat, lng } = e.latlng;
    addPointToCurrentRoute(lat, lng);
});

/* =========================================================
   MODAL
========================================================= */
function setModalLoading(isLoading, text = "Processando...") {
    if (isLoading) {
        modalCloseBtn.disabled = true;
        modalCancelBtn.disabled = true;
        modalCloseBtn.dataset.originalText = modalCloseBtn.textContent;
        modalCloseBtn.textContent = text;
    } else {
        modalCloseBtn.disabled = false;
        modalCancelBtn.disabled = false;
        if (modalCloseBtn.dataset.originalText) {
            modalCloseBtn.textContent = modalCloseBtn.dataset.originalText;
        }
    }
}

function resetModalState() {
    // texto padrão
    modalTitle.textContent = "";
    modalMessage.textContent = "";

    // input
    modalInput.value = "";
    modalInput.placeholder = "Digite aqui...";
    modalInput.classList.add("hidden");
    modalInput.onkeydown = null;
    modalInput.style.borderColor = "rgba(255,255,255,0.08)";
    modalInput.style.boxShadow = "none";

    // botões
    modalCloseBtn.textContent = "Fechar";
    modalCloseBtn.disabled = false;
    modalCloseBtn.onclick = null;
    modalCloseBtn.classList.remove("modal-half");

    modalCancelBtn.textContent = "Cancelar";
    modalCancelBtn.disabled = false;
    modalCancelBtn.onclick = null;
    modalCancelBtn.classList.add("hidden");
    modalCancelBtn.classList.remove("modal-half");
}

function startRouteInGoogleMaps(routeData) {
    if (!routeData) {
        showModal("Erro", "Não foi possível iniciar esta rota.");
        return;
    }

    let orderedPoints = [];

    // Novo formato
    if (Array.isArray(routeData.points) && routeData.points.length > 0) {
        orderedPoints = routeData.points
            .filter(p => p && typeof p.lat === "number" && typeof p.lng === "number")
            .map(p => ({
                lat: p.lat,
                lng: p.lng
            }));
    }

    // Compatibilidade com rota antiga (lat/lng únicos)
    else if (
        typeof routeData.lat === "number" &&
        typeof routeData.lng === "number"
    ) {
        orderedPoints = [
            {
                lat: routeData.lat,
                lng: routeData.lng
            }
        ];
    }

    if (orderedPoints.length < 2) {
        showModal(
            "Rota inválida",
            "Essa rota precisa ter pelo menos 2 pontos para iniciar no Google Maps."
        );
        return;
    }

    // Mantém EXATAMENTE a ordem salva
    const path = orderedPoints
        .map(point => `${point.lat},${point.lng}`)
        .join("/");

    const googleMapsUrl = `https://www.google.com/maps/dir/${path}`;

    window.open(googleMapsUrl, "_blank");
}

function showModal(title, message, type = "success", options = {}) {
    resetModalState();

    modalTitle.textContent = title;
    modalMessage.textContent = message;

    if (type === "success") {
        modalIcon.textContent = "✓";
        modalIcon.style.background = "rgba(34,197,94,0.14)";
        modalIcon.style.color = "#22c55e";

        modalCloseBtn.onclick = closeModal;
    }

    else if (type === "error") {
        modalIcon.textContent = "!";
        modalIcon.style.background = "rgba(239,68,68,0.14)";
        modalIcon.style.color = "#ef4444";

        modalCloseBtn.onclick = closeModal;
    }

    else if (type === "confirm") {
        modalIcon.textContent = "?";
        modalIcon.style.background = "rgba(59,130,246,0.14)";
        modalIcon.style.color = "#3b82f6";

        modalCancelBtn.classList.remove("hidden");

        modalCloseBtn.textContent = options.confirmText || "Sim";
        modalCancelBtn.textContent = options.cancelText || "Não";

        // deixa os dois com largura bonita
        modalCloseBtn.classList.add("modal-half");
        modalCancelBtn.classList.add("modal-half");

        modalCloseBtn.onclick = async () => {
            if (options.onConfirm) {
                await options.onConfirm();
            } else {
                closeModal();
            }
        };

        modalCancelBtn.onclick = closeModal;
    }

    else {
        modalIcon.textContent = "i";
        modalIcon.style.background = "rgba(59,130,246,0.14)";
        modalIcon.style.color = "#3b82f6";

        modalCloseBtn.onclick = closeModal;
    }

    if (modalCloseTimeout) {
        clearTimeout(modalCloseTimeout);
        modalCloseTimeout = null;
    }

    customModal.classList.remove("hidden");

    requestAnimationFrame(() => {
        customModal.style.opacity = "1";
    });
}

function showInputModal(title, message, options = {}) {
    resetModalState();

    modalTitle.textContent = title;
    modalMessage.textContent = message;

    modalIcon.textContent = "✎";
    modalIcon.style.background = "rgba(59,130,246,0.14)";
    modalIcon.style.color = "#3b82f6";

    modalInput.classList.remove("hidden");
    modalCancelBtn.classList.remove("hidden");

    modalInput.value = options.defaultValue || "";
    modalInput.placeholder = options.placeholder || "Digite aqui...";

    modalCloseBtn.textContent = options.confirmText || "Salvar";
    modalCancelBtn.textContent = "Cancelar";

    modalCloseBtn.classList.add("modal-half");
    modalCancelBtn.classList.add("modal-half");

    modalCloseBtn.onclick = async () => {
        const value = modalInput.value.trim();
        console.log("INPUT MODAL VALOR:", value);

        if (!value) {
            modalInput.focus();
            modalInput.style.borderColor = "#ef4444";
            modalInput.style.boxShadow = "0 0 0 3px rgba(239,68,68,0.2)";
            return;
        }

        if (options.onConfirm) {
            await options.onConfirm(value);
        }
    };

    modalCancelBtn.onclick = closeModal;

    modalInput.onkeydown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            modalCloseBtn.click();
        }
    };

    if (modalCloseTimeout) {
        clearTimeout(modalCloseTimeout);
        modalCloseTimeout = null;
    }

    customModal.classList.remove("hidden");

    requestAnimationFrame(() => {
        customModal.style.opacity = "1";
    });

    setTimeout(() => {
        modalInput.focus();
        modalInput.select();
    }, 50);
}

function closeModal() {
    if (modalCloseTimeout) {
        clearTimeout(modalCloseTimeout);
        modalCloseTimeout = null;
    }

    customModal.style.opacity = "0";

    modalCloseTimeout = setTimeout(() => {
        customModal.classList.add("hidden");
        customModal.style.opacity = "";
        resetModalState();
        modalCloseTimeout = null;
    }, 180);
}

// fechar ao clicar fora
customModal.addEventListener("click", (e) => {
    if (e.target === customModal) {
        closeModal();
    }
});
// fechar com ESC
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !customModal.classList.contains("hidden")) {
        closeModal();
    }
});

/* =========================================================
   MODO DESENHO
========================================================= */
function toggleDrawingMode() {
    isDrawingRoute = !isDrawingRoute;

    if (isDrawingRoute) {
        routeStatusEl.textContent = "Desenhando rota";
        startRouteBtn.textContent = "Finalizar";
        startRouteBtn.style.background = "#f59e0b";
    } else {
        routeStatusEl.textContent = tempPoints.length > 0 ? "Preview pronta" : "Aguardando";
        startRouteBtn.textContent = "Iniciar rota";
        startRouteBtn.style.background = "#3b82f6";
    }
}

/* =========================================================
   CRIAÇÃO DE ROTA
========================================================= */
function addPointToCurrentRoute(lat, lng) {
    tempPoints.push({ lat, lng });

    const marker = createNumberedMarker(lat, lng, tempPoints.length);
    marker.addTo(map);
    tempMarkers.push(marker);

    updateCurrentRoutePreview();
    drawPreviewRoute();
}

function undoLastPoint() {
    if (tempPoints.length === 0) return;

    tempPoints.pop();

    const lastMarker = tempMarkers.pop();
    if (lastMarker) {
        map.removeLayer(lastMarker);
    }

    redrawTempMarkers();
    updateCurrentRoutePreview();
    drawPreviewRoute();

    if (tempPoints.length === 0) {
        routeStatusEl.textContent = isDrawingRoute ? "Desenhando rota" : "Aguardando";
    }
}

function clearCurrentRoute() {
    tempPoints = [];
    currentRouteDistance = 0;

    tempMarkers.forEach((marker) => map.removeLayer(marker));
    tempMarkers = [];

    if (tempPolyline) {
        map.removeLayer(tempPolyline);
        tempPolyline = null;
    }

    isDrawingRoute = false;
    routeStatusEl.textContent = "Aguardando";
    routePointsCountEl.textContent = "0";
    routeDistanceEl.textContent = "0.00 km";
    routeNameInput.value = "";

    startRouteBtn.textContent = "Iniciar rota";
    startRouteBtn.style.background = "#3b82f6";
}

function updateCurrentRoutePreview() {
    routePointsCountEl.textContent = tempPoints.length;

    // distância assíncrona (OSRM)
    updateDistancePreviewAsync();
}

updateDistancePreviewAsync();

async function updateDistancePreviewAsync() {
    if (tempPoints.length < 2) {
        currentRouteDistance = 0;
        routeDistanceEl.textContent = "0.00 km";
        return;
    }

    routeDistanceEl.textContent = "Calculando...";

    try {
        const distance = await calculateRouteDistanceORS(tempPoints);
        currentRouteDistance = distance;
        routeDistanceEl.textContent = `${distance.toFixed(2)} km`;
    } catch (error) {
        console.warn("Preview ORS falhou, usando linha reta.");
        const fallbackDistance = calculateDistanceFromPoints(tempPoints);
        currentRouteDistance = fallbackDistance;
        routeDistanceEl.textContent = `${fallbackDistance.toFixed(2)} km`;
    }
}

function drawPreviewRoute() {
    if (tempPolyline) {
        map.removeLayer(tempPolyline);
        tempPolyline = null;
    }

    if (tempPoints.length < 2) return;

    tempPolyline = L.polyline(
        tempPoints.map((point) => [point.lat, point.lng]),
        {
            color: "#38bdf8",
            weight: 5,
            opacity: 0.95
        }
    ).addTo(map);
}

function redrawTempMarkers() {
    tempMarkers.forEach((marker) => map.removeLayer(marker));
    tempMarkers = [];

    tempPoints.forEach((point, index) => {
        const marker = createNumberedMarker(point.lat, point.lng, index + 1);
        marker.addTo(map);
        tempMarkers.push(marker);
    });
}

/* =========================================================
   SALVAR
========================================================= */
async function saveCurrentRoute() {
    if (!currentUser) {
        showModal("Erro", "Usuário não autenticado.", "error");
        return;
    }

    if (tempPoints.length < 2) {
        showModal("Atenção", "Adicione pelo menos 2 pontos para salvar a rota.", "info");
        return;
    }

    const routeName = routeNameInput.value.trim();
    if (!routeName) {
        showModal("Atenção", "Digite um nome para a rota.", "info");
        return;
    }

    try {
        saveRouteBtn.disabled = true;
        saveRouteBtn.textContent = "Salvando...";

        console.log("Salvando rota imediatamente...");

        // 1) salva rápido com fallback em linha reta
        const finalDistance = currentRouteDistance || calculateDistanceFromPoints(tempPoints);

        const docRef = await addDoc(collection(db, "routes"), {
            userId: currentUser.uid,
            name: routeName,
            points: tempPoints,
            distance: finalDistance,
            createdAt: serverTimestamp()
        });

        console.log("Rota salva rápido com fallback:", docRef.id);

        // 2) feedback imediato pro usuário
        showModal("Rota salva!", "Sua rota foi salva com sucesso.");
        clearCurrentRoute();
        loadRoutes();


    } catch (error) {
        console.error("Erro ao salvar rota:", error);
        showModal("Erro", `Não foi possível salvar a rota. ${error.message || ""}`, "error");
    } finally {
        saveRouteBtn.disabled = false;
        saveRouteBtn.textContent = "Salvar rota";
    }
}


/* =========================================================
   LISTAGEM
========================================================= */
async function loadRoutes() {
    if (!currentUser) return;

    routesListEl.innerHTML = "<p>Carregando rotas...</p>";

    try {
        const routesRef = collection(db, "routes");
        const q = query(
            routesRef,
            where("userId", "==", currentUser.uid),
            orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(q);
        allRoutes = [];

        snapshot.forEach((docSnap) => {
            allRoutes.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        applyRoutesFilters();
        updateDashboardStats(allRoutes);
    } catch (error) {
        console.error("Erro ao carregar rotas:", error);
        routesListEl.innerHTML = "<p>Erro ao carregar rotas.</p>";
    }
}

function applyRoutesFilters() {
    const searchTerm = searchRoutesInput.value.trim().toLowerCase();
    const sortValue = sortRoutesSelect.value;

    let filteredRoutes = [...allRoutes];

    if (searchTerm) {
        filteredRoutes = filteredRoutes.filter((route) =>
            (route.name || "").toLowerCase().includes(searchTerm)
        );
    }

    filteredRoutes.sort((a, b) => {
        switch (sortValue) {
            case "oldest":
                return getCreatedAtMs(a) - getCreatedAtMs(b);

            case "name-asc":
                return (a.name || "").localeCompare(b.name || "");

            case "name-desc":
                return (b.name || "").localeCompare(a.name || "");

            case "distance-desc":
                return (b.distance || 0) - (a.distance || 0);

            case "distance-asc":
                return (a.distance || 0) - (b.distance || 0);

            case "recent":
            default:
                return getCreatedAtMs(b) - getCreatedAtMs(a);
        }
    });

    renderRoutesList(filteredRoutes);
}

function renderRoutesList(routes) {
    routesCounterEl.textContent = routes.length;

    if (routes.length === 0) {
        routesListEl.innerHTML = "<p>Nenhuma rota encontrada.</p>";
        return;
    }

    routesListEl.innerHTML = "";

    routes.forEach((route) => {
        renderRouteCard(route.id, route);
    });
}

function renderRouteCard(routeId, route) {
    const card = document.createElement("div");
    card.className = "route-card";

    if (selectedRouteId === routeId) {
        card.classList.add("active");
    }

    const points = getNormalizedRoutePoints(route);

    card.innerHTML = `
  <h3>${route.name || "Rota sem nome"}</h3>
  <p><strong>Pontos:</strong> ${points.length}</p>
  <p><strong>Distância:</strong> ${(route.distance || 0).toFixed(2)} km</p>
  <div class="route-card-actions">
    <button class="view-btn">Ver</button>
    <button class="start-btn">Iniciar rota</button>
    <button class="rename-btn">Renomear</button>
    <button class="delete-btn">Excluir</button>
  </div>
`;

    const viewBtn = card.querySelector(".view-btn");
    const startBtn = card.querySelector(".start-btn");
    const renameBtn = card.querySelector(".rename-btn");
    const deleteBtn = card.querySelector(".delete-btn");

    viewBtn.addEventListener("click", () => {
        selectedRouteId = routeId;
        highlightRoute(route);
        applyRoutesFilters();
    });

    startBtn.addEventListener("click", () => {
        startRouteInGoogleMaps(route);
    });

    renameBtn.addEventListener("click", () => {
        showInputModal("Renomear rota", "Digite o novo nome da rota:", {
            defaultValue: route.name || "",
            placeholder: "Novo nome da rota",
            confirmText: "Salvar",
            onConfirm: async (newName) => {
                const finalName = (newName || "").trim();
                console.log("RENOMEAR -> routeId:", routeId, "| novo nome:", finalName);

                try {
                    setModalLoading(true, "Salvando...");

                    const routeRef = doc(db, "routes", routeId);

                    await updateDoc(routeRef, {
                        name: finalName
                    });

                    console.log("RENOMEADO NO FIRESTORE:", routeId, finalName);

                    allRoutes = allRoutes.map((item) =>
                        item.id === routeId
                            ? { ...item, name: finalName }
                            : item
                    );

                    closeModal();
                    applyRoutesFilters();
                    showModal("Rota renomeada!", "O nome da rota foi atualizado com sucesso.", "success");
                    loadRoutes();

                } catch (error) {
                    console.error("Erro ao renomear rota:", error);
                    showModal("Erro", "Não foi possível renomear a rota.", "error");
                } finally {
                    setModalLoading(false);
                }
            }
        });
    });

    deleteBtn.addEventListener("click", () => {
        showModal(
            "Excluir rota",
            `Deseja realmente excluir a rota "${route.name || "sem nome"}"?`,
            "confirm",
            {
                confirmText: "Sim",
                cancelText: "Não",
                onConfirm: async () => {
                    try {
                        setModalLoading(true, "Excluindo...");

                        await deleteDoc(doc(db, "routes", routeId));

                        if (selectedRouteId === routeId) {
                            selectedRouteId = null;
                            clearSelectedRoute();
                        }

                        closeModal();
                        showModal("Rota excluída!", "A rota foi removida com sucesso.");
                        loadRoutes();
                    } catch (error) {
                        console.error("Erro ao excluir rota:", error);
                        showModal("Erro", "Não foi possível excluir a rota.", "error");
                    } finally {
                        setModalLoading(false);
                    }
                }
            }
        );
    });

    routesListEl.appendChild(card);
}

/* =========================================================
   VISUALIZAR ROTA
========================================================= */
function highlightRoute(route) {
    const points = getNormalizedRoutePoints(route);
    if (points.length < 1) return;

    clearSelectedRoute();

    const latlngs = points.map((point) => [point.lat, point.lng]);

    selectedRouteLayer = L.polyline(latlngs, {
        color: "#2563eb",
        weight: 6,
        opacity: 1
    }).addTo(map);

    const routeHalo = L.polyline(latlngs, {
        color: "#93c5fd",
        weight: 12,
        opacity: 0.25
    }).addTo(map);

    selectedRouteMarkers.push(routeHalo);

    points.forEach((point, index) => {
        const marker = createNumberedMarker(point.lat, point.lng, index + 1);
        marker.addTo(map);
        selectedRouteMarkers.push(marker);
    });

    const startPoint = points[0];
    const startMarker = createSpecialMarker(startPoint.lat, startPoint.lng, "INÍCIO", "start-marker");
    startMarker.addTo(map);
    selectedRouteMarkers.push(startMarker);

    const endPoint = points[points.length - 1];
    const endMarker = createSpecialMarker(endPoint.lat, endPoint.lng, "FIM", "end-marker");
    endMarker.addTo(map);
    selectedRouteMarkers.push(endMarker);

    const distance = route.distance || calculateDistanceFromPoints(points);

    const center = selectedRouteLayer.getBounds().getCenter();

    const routePopup = L.popup()
        .setLatLng(center)
        .setContent(`
    <div class="route-popup">
      <h4>${route.name || "Rota sem nome"}</h4>
      <p><strong>Pontos:</strong> ${points.length}</p>
      <p><strong>Distância:</strong> ${distance.toFixed(2)} km</p>
    </div>
  `);

    routePopup.on("remove", () => {
        clearSelectedRoute();
        selectedRouteId = null;
        applyRoutesFilters();
    });

    routePopup.openOn(map);

    map.fitBounds(selectedRouteLayer.getBounds(), {
        padding: [50, 50]
    });
}

function clearSelectedRoute() {
    if (selectedRouteLayer) {
        map.removeLayer(selectedRouteLayer);
        selectedRouteLayer = null;
    }

    selectedRouteMarkers.forEach((marker) => map.removeLayer(marker));
    selectedRouteMarkers = [];
}

/* =========================================================
   DASHBOARD STATS
========================================================= */
function updateDashboardStats(routes) {
    const totalRoutes = routes.length;
    const totalKm = routes.reduce((sum, route) => sum + (route.distance || 0), 0);
    const avgKm = totalRoutes > 0 ? totalKm / totalRoutes : 0;

    statTotalRoutesEl.textContent = totalRoutes;
    statTotalKmEl.textContent = totalKm.toFixed(2);
    statAvgKmEl.textContent = avgKm.toFixed(2);
}

/* =========================================================
   BUSCA DE LOCAL
========================================================= */
async function searchLocationByName() {
    const query = locationSearchInput.value.trim();

    if (!query) {
        showModal("Atenção", "Digite um local para buscar.", "info");
        return;
    }

    locationSearchResults.innerHTML = `<p class="location-search-empty">Buscando...</p>`;

    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
        );

        const results = await response.json();

        renderLocationSearchResults(results);
    } catch (error) {
        console.error("Erro ao buscar local:", error);
        locationSearchResults.innerHTML = `<p class="location-search-empty">Erro ao buscar local.</p>`;
    }
}

function renderLocationSearchResults(results) {
    if (!results || results.length === 0) {
        locationSearchResults.innerHTML = `<p class="location-search-empty">Nenhum local encontrado.</p>`;
        return;
    }

    locationSearchResults.innerHTML = "";

    results.forEach((place) => {
        const item = document.createElement("div");
        item.className = "location-result-item";

        const title = place.name || place.display_name.split(",")[0] || "Local encontrado";

        item.innerHTML = `
      <strong>${title}</strong>
      <span>${place.display_name}</span>
    `;

        item.addEventListener("click", () => {
            const lat = Number(place.lat);
            const lng = Number(place.lon);

            map.setView([lat, lng], 16);

            L.popup()
                .setLatLng([lat, lng])
                .setContent(`<strong>${title}</strong><br>${place.display_name}`)
                .openOn(map);

            if (!isDrawingRoute) {
                toggleDrawingMode();
            }

            addPointToCurrentRoute(lat, lng);

            locationSearchInput.value = title;
            locationSearchResults.innerHTML = "";

            showModal("Ponto adicionado!", `"${title}" foi adicionado à rota.`);
        });

        locationSearchResults.appendChild(item);
    });
}

/* =========================================================
   UTILITÁRIOS
========================================================= */
function getNormalizedRoutePoints(route) {
    if (route.points && Array.isArray(route.points)) {
        return route.points;
    }

    if (route.lat && route.lng) {
        return [{ lat: route.lat, lng: route.lng }];
    }

    return [];
}

function createNumberedMarker(lat, lng, number) {
    return L.marker([lat, lng], {
        icon: L.divIcon({
            className: "",
            html: `<div class="custom-number-marker">${number}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        })
    });
}

function createSpecialMarker(lat, lng, label, className) {
    return L.marker([lat, lng], {
        icon: L.divIcon({
            className: "",
            html: `<div class="${className}">${label}</div>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17]
        })
    });
}

function calculateDistanceFromPoints(points) {
    if (!points || points.length < 2) return 0;

    let totalDistance = 0;

    for (let i = 0; i < points.length - 1; i++) {
        totalDistance += getDistanceInKm(
            points[i].lat,
            points[i].lng,
            points[i + 1].lat,
            points[i + 1].lng
        );
    }

    return totalDistance;
}

function getDistanceInKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(value) {
    return (value * Math.PI) / 180;
}

function getCreatedAtMs(route) {
    if (route.createdAt?.seconds) {
        return route.createdAt.seconds * 1000;
    }

    return 0;
}

/* =========================================================
   DISTÂNCIA REAL (OSRM)
========================================================= */
async function calculateRouteDistanceORS(points) {
    if (!points || points.length < 2) return 0;

    try {
        const coordinates = points.map((p) => [p.lng, p.lat]);

        const response = await fetch("https://api.openrouteservice.org/v2/directions/driving-car/json", {
            method: "POST",
            headers: {
                "Authorization": ORS_API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                coordinates: coordinates
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ ORS RESPONSE:", errorText);
            throw new Error(`ORS HTTP ${response.status}`);
        }

        const data = await response.json();

        console.log("📦 RESPOSTA ORS:", data);

        const distanceMeters = data.routes?.[0]?.summary?.distance;
        const distanceKm = distanceMeters / 1000;

        if (!distanceMeters || !isFinite(distanceKm) || distanceKm <= 0) {
            throw new Error("ORS retornou distância inválida");
        }

        return distanceKm;
    } catch (error) {
        console.warn("ORS falhou, usando fallback:", error.message);
        return calculateDistanceFromPoints(points);
    }
}