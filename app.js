/* ============================================================
   GEOPOINT STUDIO - APPLICATION LOGIC (CLIENT-SIDE ONLY)
   ============================================================ */

// In-Memory Temporary State (Cleared on Refresh)
let points = [];
let map = null;
let markersLayerGroup = null;

// Default Map Center (Jayapura, Papua / Indonesia default)
const DEFAULT_CENTER = [-2.5438, 140.7013];
const DEFAULT_ZOOM = 13;

// Sample Initial Coordinates (Anonymized Dummy Sample Data)
const SAMPLE_DATA = [
    { nama: "Lokasi Sampel A", lat: -2.5382715, lon: 140.7116208 },
    { nama: "Lokasi Sampel B", lat: -2.5110452, lon: 140.7053244 },
    { nama: "Lokasi Sampel C", lat: -2.6034193, lon: 140.6823876 },
    { nama: "Lokasi Sampel D", lat: -2.5373798, lon: 140.7093662 }
];

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    initLeafletMap();
    setupDragAndDrop();
    updateMapAndList();
});

function initLeafletMap() {
    // Inisialisasi Peta Leaflet
    map = L.map("map", {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: true
    });

    // 1. Google Earth / Satelit (+ Label) - DEFAULT TILE LAYER
    const googleSatLayer = L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
        maxZoom: 20,
        attribution: "Google Earth / Satelit"
    }).addTo(map);

    // 2. Esri World Imagery (Earth View HD)
    const esriLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 18,
        attribution: "Esri World Imagery, Maxar"
    });

    // 3. Google Maps Standard Jalan
    const googleRoadLayer = L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
        maxZoom: 20,
        attribution: "Google Maps"
    });

    // 4. OpenStreetMap Standard
    const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
    });

    // Control Layer Switcher
    const baseMaps = {
        "🌍 Google Earth / Satelit (+ Label)": googleSatLayer,
        "🌍 Earth View HD (Esri)": esriLayer,
        "🗺️ Google Maps (Standard Jalan)": googleRoadLayer,
        "🗺️ OpenStreetMap Standard": osmLayer
    };

    L.control.layers(baseMaps, null, { position: "topleft", collapsed: true }).addTo(map);

    // Marker Layer Group
    markersLayerGroup = L.layerGroup().addTo(map);
}

// ============================================================
// TAB NAVIGATION & VIEW SWITCHER
// ============================================================

function switchTab(tabId) {
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(content => content.classList.remove("active"));

    const activeBtn = document.querySelector(`.tab-btn[onclick="switchTab('${tabId}')"]`);
    const activeContent = document.getElementById(tabId);

    if (activeBtn) activeBtn.classList.add("active");
    if (activeContent) activeContent.classList.add("active");
}

// Automatic Map Resize on Window Resize (Dynamic Dimensions)
window.addEventListener("resize", () => {
    if (map) {
        map.invalidateSize();
    }
});

// Grid state array for interactive Excel table
let gridRows = [];

// 1. Parse Excel Copy-Paste text & populate Interactive Table Grid
function parseExcelPaste() {
    const rawText = document.getElementById("pasteInput").value.trim();
    if (!rawText) {
        showToast("⚠️ Silakan paste data dari Excel terlebih dahulu!", "warning");
        return;
    }

    const lines = rawText.split(/\r?\n/);
    let addedCount = 0;

    lines.forEach((line, index) => {
        if (!line.trim()) return;
        
        // Split by tab (\t) or comma or semicolon
        const cols = line.includes("\t") ? line.split("\t") : line.split(/[,;]/);
        const cleanCols = cols.map(c => c.trim().replace(/^["']|["']$/g, ''));

        let nama = "";
        let latStr = "";
        let lonStr = "";

        if (cleanCols.length >= 3) {
            if (index === 0 && isHeaderRow(cleanCols)) return;
            nama = cleanCols[0];
            latStr = cleanCols[1];
            lonStr = cleanCols[2];
        } else if (cleanCols.length === 2) {
            nama = `Titik #${gridRows.length + 1}`;
            latStr = cleanCols[0];
            lonStr = cleanCols[1];
        }

        if (nama || latStr || lonStr) {
            gridRows.push({
                nama: nama,
                lat: latStr,
                lon: lonStr
            });
            addedCount++;
        }
    });

    if (addedCount > 0) {
        document.getElementById("pasteInput").value = "";
        renderGridRows();
        applyGridToMap();
        showToast(`✅ Berhasil memuat ${addedCount} baris ke tabel grid Excel!`, "success");
    } else {
        showToast("❌ Format paste tidak dikenali.", "error");
    }
}

// Render Interactive Excel Grid Table
function renderGridRows() {
    const tbody = document.getElementById("excelGridBody");
    if (!tbody) return;

    if (gridRows.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 16px;">
                    Belum ada baris tabel. Paste dari Excel di atas atau klik <b>+ Baris Baru</b>.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = gridRows.map((row, idx) => `
        <tr>
            <td style="text-align: center; font-weight: 700; color: var(--text-muted); font-size: 11px;">${idx + 1}</td>
            <td>
                <input type="text" class="grid-input-cell" value="${escapeHtml(row.nama)}" 
                       oninput="updateGridCell(${idx}, 'nama', this.value)" placeholder="Nama Tempat">
            </td>
            <td>
                <input type="text" class="grid-input-cell" value="${escapeHtml(row.lat)}" 
                       oninput="updateGridCell(${idx}, 'lat', this.value)" placeholder="-2.5382715">
            </td>
            <td>
                <input type="text" class="grid-input-cell" value="${escapeHtml(row.lon)}" 
                       oninput="updateGridCell(${idx}, 'lon', this.value)" placeholder="140.7116208">
            </td>
            <td style="text-align: center;">
                <button class="btn-grid-delete" onclick="deleteGridRow(${idx})" title="Hapus Baris">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </td>
        </tr>
    `).join("");
}

function updateGridCell(index, field, value) {
    if (gridRows[index]) {
        gridRows[index][field] = value;
    }
}

function addGridRow(nama = "", lat = "", lon = "") {
    gridRows.push({ nama, lat, lon });
    renderGridRows();
}

function deleteGridRow(index) {
    gridRows.splice(index, 1);
    renderGridRows();
}

function clearGridRows() {
    gridRows = [];
    renderGridRows();
}

// Apply rows in grid table directly to the main map state
function applyGridToMap() {
    const validPoints = [];
    let invalidCount = 0;

    gridRows.forEach((row, idx) => {
        const nama = row.nama.trim() || `Titik #${idx + 1}`;
        const lat = parseFloat(String(row.lat).replace(",", "."));
        const lon = parseFloat(String(row.lon).replace(",", "."));

        if (isValidCoordinate(lat, lon)) {
            validPoints.push({
                id: Date.now() + idx + Math.random(),
                nama: nama,
                lat: lat,
                lon: lon
            });
        } else if (row.lat || row.lon) {
            invalidCount++;
        }
    });

    if (validPoints.length > 0) {
        points = validPoints;
        updateMapAndList();
        showToast(`📍 ${validPoints.length} titik berhasil ditampilkan di peta!`, "success");
    } else {
        if (gridRows.length > 0) {
            showToast("⚠️ Tidak ada koordinat valid (Latitude & Longitude) di dalam tabel grid.", "warning");
        }
    }
}

function loadSampleData() {
    // Populate gridRows with anonymized dummy sample data
    gridRows = SAMPLE_DATA.map(item => ({
        nama: item.nama,
        lat: String(item.lat),
        lon: String(item.lon)
    }));

    renderGridRows();

    points = SAMPLE_DATA.map((item, idx) => ({
        id: Date.now() + idx,
        nama: item.nama,
        lat: item.lat,
        lon: item.lon
    }));

    updateMapAndList();
    showToast("🧪 Contoh data 15 titik disamarkan berhasil dimuat!", "success");
}

// 2. Drag & Drop / File Input Parser
function setupDragAndDrop() {
    const dropZone = document.getElementById("dropZone");

    ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ["dragenter", "dragover"].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add("dragover"), false);
    });

    ["dragleave", "drop"].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove("dragover"), false);
    });

    dropZone.addEventListener("drop", (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            processUploadedFile(files[0]);
        }
    });
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        processUploadedFile(files[0]);
    }
}

function processUploadedFile(file) {
    const reader = new FileReader();
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".json")) {
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                parseArrayOfObjects(Array.isArray(data) ? data : [data]);
            } catch (err) {
                showToast("❌ File JSON tidak valid.", "error");
            }
        };
        reader.readAsText(file);
    } else {
        // Handle Excel (.xlsx, .xls) and CSV/TXT with SheetJS
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: "array" });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
                
                parseArrayOfObjects(jsonRows);
            } catch (err) {
                showToast("❌ Gagal membaca file Excel/CSV: " + err.message, "error");
            }
        };
        reader.readAsArrayBuffer(file);
    }
}

function parseArrayOfObjects(rows) {
    let addedCount = 0;

    rows.forEach((row) => {
        // Standardize Column Names
        let nama = "";
        let lat = NaN;
        let lon = NaN;

        for (const [key, value] of Object.entries(row)) {
            const k = key.trim().toLowerCase();
            const valStr = String(value).trim();

            if (["nama", "name", "toko", "store", "label", "lokasi", "titik"].includes(k)) {
                nama = valStr;
            } else if (["latitude", "lat", "latitud", "y"].includes(k)) {
                lat = parseFloat(valStr.replace(",", "."));
            } else if (["longitude", "long", "lng", "lon", "x"].includes(k)) {
                lon = parseFloat(valStr.replace(",", "."));
            }
        }

        if (isValidCoordinate(lat, lon)) {
            points.push({
                id: Date.now() + Math.random(),
                nama: nama || `Titik #${points.length + 1}`,
                lat: lat,
                lon: lon
            });
            addedCount++;
        }
    });

    if (addedCount > 0) {
        updateMapAndList();
        showToast(`✅ Berhasil mengimpor ${addedCount} titik dari file!`, "success");
    } else {
        showToast("❌ Tidak ada kolom koordinat (Latitude & Longitude) yang valid.", "error");
    }
}

// 3. Manual Input Form Handler
function handleManualSubmit(e) {
    e.preventDefault();
    const namaInput = document.getElementById("inputNama");
    const latInput = document.getElementById("inputLat");
    const lngInput = document.getElementById("inputLng");

    const nama = namaInput.value.trim();
    const lat = parseFloat(latInput.value.replace(",", "."));
    const lon = parseFloat(lngInput.value.replace(",", "."));

    if (!isValidCoordinate(lat, lon)) {
        showToast("⚠️ Nilai Latitude harus antara -90 s/d 90 & Longitude -180 s/d 180", "warning");
        return;
    }

    points.push({
        id: Date.now(),
        nama: nama,
        lat: lat,
        lon: lon
    });

    namaInput.value = "";
    latInput.value = "";
    lngInput.value = "";

    updateMapAndList();
    showToast(`✅ Titik "${nama}" berhasil ditambahkan!`, "success");
}

// ============================================================
// RENDER MAP & POINTS LIST
// ============================================================

function updateMapAndList() {
    const pointCountEl = document.getElementById("pointCount");
    const badgeCountEl = document.getElementById("badgeCount");
    const bannerCountEl = document.getElementById("bannerCount");
    const pointsListEl = document.getElementById("pointsList");
    const btnOpenAllGmaps = document.getElementById("btnOpenAllGmaps");
    const btnCopyAllGmaps = document.getElementById("btnCopyAllGmaps");
    const bannerGmapsLink = document.getElementById("bannerGmapsLink");

    // Update Counters
    const count = points.length;
    pointCountEl.textContent = `${count} Titik`;
    badgeCountEl.textContent = count;
    bannerCountEl.textContent = count;

    // Build GMaps Multi-Point Route Link
    const gmapsRouteUrl = generateGMapsRouteUrl();

    if (count > 0) {
        btnOpenAllGmaps.classList.remove("disabled");
        btnOpenAllGmaps.href = gmapsRouteUrl;
        btnCopyAllGmaps.classList.remove("disabled");

        bannerGmapsLink.classList.remove("disabled");
        bannerGmapsLink.href = gmapsRouteUrl;
    } else {
        btnOpenAllGmaps.classList.add("disabled");
        btnOpenAllGmaps.removeAttribute("href");
        btnCopyAllGmaps.classList.add("disabled");

        bannerGmapsLink.classList.add("disabled");
        bannerGmapsLink.removeAttribute("href");
    }

    // Render Points List HTML
    if (count === 0) {
        pointsListEl.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-map-pin"></i>
                <p>Belum ada titik koordinat. Masukkan data via Paste Excel, Drop File, atau Input Manual.</p>
            </div>
        `;
    } else {
        pointsListEl.innerHTML = points.map((p, idx) => `
            <div class="point-card">
                <div class="point-info">
                    <div>
                        <span class="point-num">#${idx + 1}</span>
                        <span class="point-name" title="${escapeHtml(p.nama)}">${escapeHtml(p.nama)}</span>
                    </div>
                    <div class="point-coords">${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}</div>
                </div>
                <div class="point-actions">
                    <button class="btn-mini" onclick="flyToPoint(${p.lat}, ${p.lon})" title="Fokus Peta">
                        <i class="fa-solid fa-crosshairs"></i>
                    </button>
                    <a href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}" target="_blank" class="btn-mini" title="Buka di Google Maps">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    </a>
                    <button class="btn-mini" onclick="copySingleLink(${p.lat}, ${p.lon})" title="Salin Link GMaps">
                        <i class="fa-regular fa-copy"></i>
                    </button>
                    <button class="btn-mini btn-mini-danger" onclick="deletePoint(${p.id})" title="Hapus Titik">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
        `).join("");
    }

    // Update Leaflet Map Markers
    markersLayerGroup.clearLayers();
    const bounds = [];

    points.forEach((p, idx) => {
        const singleGmapsUrl = `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`;
        
        const popupHtml = `
            <div class="popup-custom">
                <h4>${escapeHtml(p.nama)}</h4>
                <p>
                    <b>Latitude:</b> ${p.lat}<br>
                    <b>Longitude:</b> ${p.lon}
                </p>
                <a href="${singleGmapsUrl}" target="_blank" class="popup-btn">
                    <i class="fa-solid fa-location-dot"></i> Buka Titik Ini di Google Maps
                </a>
            </div>
        `;

        const marker = L.marker([p.lat, p.lon])
            .bindTooltip(`${idx + 1}. ${p.nama}`, { sticky: true })
            .bindPopup(popupHtml, { maxWidth: 320 });

        markersLayerGroup.addLayer(marker);
        bounds.push([p.lat, p.lon]);
    });

    // Fit Map Bounds
    if (bounds.length === 1) {
        map.setView(bounds[0], 16);
    } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40] });
    }
}

function flyToPoint(lat, lon) {
    if (map) {
        map.flyTo([lat, lon], 17, { duration: 1.2 });
    }
}

function deletePoint(id) {
    points = points.filter(p => p.id !== id);
    updateMapAndList();
    showToast("🗑️ Titik lokasi dihapus", "info");
}

function clearPoints() {
    if (points.length === 0) return;
    if (confirm("Apakah Anda yakin ingin menghapus seluruh titik koordinat?")) {
        points = [];
        updateMapAndList();
        showToast("🧹 Semua titik berhasil dikosongkan", "info");
    }
}

function resetAllData() {
    clearPoints();
}

// ============================================================
// GOOGLE MAPS LINK GENERATION & COPY TO CLIPBOARD
// ============================================================

function generateGMapsRouteUrl() {
    if (points.length === 0) return "#";

    const coordsList = points.map(p => `${p.lat},${p.lon}`);
    
    if (coordsList.length <= 20) {
        return "https://www.google.com/maps/dir/" + coordsList.join("/");
    } else {
        // Fallback search link for > 20 points
        return `https://www.google.com/maps/search/?api=1&query=${points[0].lat},${points[0].lon}`;
    }
}

function checkGmapsLink(e) {
    if (points.length === 0) {
        e.preventDefault();
        showToast("⚠️ Belum ada titik koordinat yang dimasukkan.", "warning");
        return false;
    }
    return true;
}

function copyAllRouteLink() {
    const url = generateGMapsRouteUrl();
    if (url === "#" || points.length === 0) {
        showToast("⚠️ Belum ada rute untuk disalin.", "warning");
        return;
    }

    navigator.clipboard.writeText(url).then(() => {
        showToast("📋 Link Rute Google Maps (${points.length} Titik) tersalin!", "success");
    }).catch(err => {
        showToast("❌ Gagal menyalin link: " + err, "error");
    });
}

function copySingleLink(lat, lon) {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
    navigator.clipboard.writeText(url).then(() => {
        showToast("📋 Link Titik Google Maps tersalin!", "success");
    }).catch(err => {
        showToast("❌ Gagal menyalin link.", "error");
    });
}

// ============================================================
// HELPERS
// ============================================================

function isValidCoordinate(lat, lon) {
    return !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function isHeaderRow(cols) {
    const firstCol = cols[0].toLowerCase();
    return ["nama", "name", "label", "lat", "latitude"].includes(firstCol);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    let icon = "fa-circle-info";
    if (type === "success") icon = "fa-circle-check";
    if (type === "warning") icon = "fa-triangle-exclamation";
    if (type === "error") icon = "fa-circle-xmark";

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(20px)";
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}
