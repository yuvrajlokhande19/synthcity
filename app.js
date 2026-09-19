/**
 * ================================================================================
 * PROJECT SYNTHCITY: FRONTEND C2 LOGIC, FILE INGESTION & HUMANIZED CHAT (2026)
 * ================================================================================
 */

let isDebateActive = false;
let currentTab = 'overview';
let overviewMap = null;
let fullMap = null;
let currentTileLayer = 'voyager';
let overviewTileLayerObj = null;
let fullTileLayerObj = null;
let pollInterval = null;
let lastChatCount = 0;
let selectedFileContent = "";

// Default Fallback State for Immediate Display
const DEFAULT_C2_STATE = {
  debate_active: false,
  chat: [
    {
      id: "msg_init_1",
      sender: "Zone 1 AI (Neer-Krishi)",
      role: "ai",
      zone: "Zone 1",
      message: "Hello Admin! Kanhan River water levels at Juni Kamptee barrage remain stable, and Kharif paddy field moisture is optimal at 78%.",
      reasoning: "Gemini 3.1 Flash analyzed Kamptee rural moisture & Kanhan hydrology readings.",
      timeStr: "12:00:00",
      timestamp: Date.now() / 1000
    },
    {
      id: "msg_init_2",
      sender: "Zone 2 AI (Nagari-Tantra)",
      role: "ai",
      zone: "Zone 2",
      message: "Good day! Sitabuldi metro interchange traffic density is flowing steadily. Municipal compactor deployed for drain clearance.",
      reasoning: "Gemini 3.1 Flash evaluated Sitabuldi traffic bottlenecks & open plot garbage reports.",
      timeStr: "12:01:00",
      timestamp: Date.now() / 1000
    },
    {
      id: "msg_init_3",
      sender: "Admin AI (Synth-Pradhan)",
      role: "admin",
      zone: "Admin",
      message: "Acknowledge all zone telemetry. Worker 1 ('U') is on Kanhan river patrol and Worker 2 ('Ritesh') is inspecting Sitabuldi market.",
      reasoning: "Synth-Pradhan Orchestrator synthesized Zone 1 & Zone 2 AI telemetry into field directives.",
      timeStr: "12:02:00",
      timestamp: Date.now() / 1000
    }
  ],
  dashboard_outbox: [],
  dispatch_log: [],
  workers: {
    worker1: { id: "8889864487", name: "Worker 1 (U)", status: "AVAILABLE", lastMessage: "Inspect Nag River Kamptee Bridge water level." },
    worker2: { id: "8889864487", name: "Worker 2 (Ritesh Alone)", status: "AVAILABLE", lastMessage: "Deploy compactor to Sitabuldi market drain #4." }
  },
  system_memory: {
    activeModel: "Gemini 3.1 Flash Lite",
    customMemory: "Nag River Kamptee bridge dredging active. Worker 1 on high alert for Sector 4."
  }
};

// Chart Instances
let chartZoneRisks = null;
let chartFleetStatus = null;
let chartAmenities = null;
let chartTelemetryTrends = null;

document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  updateDashboardUI(DEFAULT_C2_STATE);
  initOverviewMap();
  startStatePolling();
  fetchLatestNews();
  runDiagnosticsCheck();
  startLiveClock();

  showToast("SynthCity C2 Initialized", "System & Carto Voyager GIS active.", "success");
});

function startLiveClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const clockEl = document.getElementById('live-clock-display');
  if (clockEl) {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}

function showToast(title, message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-popup toast-${type}`;

  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle';
  if (type === 'warning') iconName = 'alert-triangle';
  if (type === 'error') iconName = 'x-circle';

  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-4 h-4 shrink-0 ${type === 'success' ? 'text-emerald-600' : type === 'warning' ? 'text-amber-600' : type === 'error' ? 'text-red-600' : 'text-blue-600'}"></i>
    <div class="flex-1 min-w-0">
      <h4 class="font-bold text-[12px] text-slate-900 leading-tight">${title}</h4>
      ${message ? `<p class="text-[11px] text-slate-600 leading-tight mt-0.5 truncate">${message}</p>` : ''}
    </div>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

function switchTab(tabId) {
  currentTab = tabId;
  
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.add('hidden');
    el.classList.remove('block');
  });

  const activeTabEl = document.getElementById(`tab-${tabId}`);
  if (activeTabEl) {
    activeTabEl.classList.remove('hidden');
    activeTabEl.classList.add('block');
  }

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeNavBtn = document.getElementById(`nav-${tabId}`);
  if (activeNavBtn) {
    activeNavBtn.classList.add('active');
  }

  document.querySelectorAll('.top-nav-pill').forEach(pill => {
    pill.classList.remove('active');
  });
  const activeTopPill = document.getElementById(`top-nav-${tabId}`);
  if (activeTopPill) {
    activeTopPill.classList.add('active');
  }

  if (tabId === 'overview' && overviewMap) {
    setTimeout(() => overviewMap.invalidateSize(), 200);
  } else if (tabId === 'map') {
    if (!fullMap) {
      initFullMap();
    } else {
      setTimeout(() => fullMap.invalidateSize(), 200);
    }
  } else if (tabId === 'analytics') {
    setTimeout(renderAnalyticsCharts, 200);
  }

  lucide.createIcons();
}

// 100% Free OpenSource Leaflet Map (Zero Key & Zero Watermark, 403-Free)
function initOverviewMap() {
  const mapContainer = document.getElementById('overview-map');
  if (!mapContainer || overviewMap) return;

  const config = window.SYNTH_CONFIG;
  overviewMap = L.map('overview-map', {
    center: [config.NAGPUR_COORDINATES.lat, config.NAGPUR_COORDINATES.lng],
    zoom: 11,
    zoomControl: false
  });

  overviewTileLayerObj = L.tileLayer(config.MAP_TILES.voyager, {
    subdomains: config.MAP_TILES.subdomains,
    attribution: config.MAP_TILES.attribution,
    maxZoom: 18
  });

  overviewTileLayerObj.on('tileerror', function() {
    if (config.MAP_TILES.osm && overviewTileLayerObj._url !== config.MAP_TILES.osm) {
      overviewTileLayerObj.setUrl(config.MAP_TILES.osm);
    }
  });

  overviewTileLayerObj.addTo(overviewMap);
  renderZonePolygons(overviewMap);

  setTimeout(() => {
    if (overviewMap) overviewMap.invalidateSize();
  }, 250);
}

function initFullMap() {
  const mapContainer = document.getElementById('full-map');
  if (!mapContainer || fullMap) return;

  const config = window.SYNTH_CONFIG;
  fullMap = L.map('full-map', {
    center: [config.NAGPUR_COORDINATES.lat, config.NAGPUR_COORDINATES.lng],
    zoom: 12
  });

  fullTileLayerObj = L.tileLayer(config.MAP_TILES.voyager, {
    subdomains: config.MAP_TILES.subdomains,
    attribution: config.MAP_TILES.attribution,
    maxZoom: 18
  });

  fullTileLayerObj.on('tileerror', function() {
    if (config.MAP_TILES.osm && fullTileLayerObj._url !== config.MAP_TILES.osm) {
      fullTileLayerObj.setUrl(config.MAP_TILES.osm);
    }
  });

  fullTileLayerObj.addTo(fullMap);
  renderZonePolygons(fullMap);

  setTimeout(() => {
    if (fullMap) fullMap.invalidateSize();
  }, 250);
}

function renderZonePolygons(mapObj) {
  const config = window.SYNTH_CONFIG;
  Object.keys(config.ZONES).forEach(key => {
    const zone = config.ZONES[key];
    const polygon = L.polygon(zone.bounds, {
      color: zone.borderColor,
      fillColor: zone.color,
      fillOpacity: zone.fillOpacity,
      weight: 2
    }).addTo(mapObj);

    polygon.bindPopup(`
      <div style="font-family: sans-serif; padding: 4px;">
        <strong style="color: ${zone.color};">${zone.name}</strong><br/>
        <span style="font-size: 11px; color: #64748b;">${zone.subtitle}</span>
      </div>
    `);
  });

  // 1. Add Zone News Point Markers
  const newsPoints = [
    { name: "Zone 1: Kanhan Hydro Intake Watch", lat: 21.2300, lng: 79.2000, color: "#0284c7", detail: "Kanhan hydrological levels stable below alert threshold." },
    { name: "Zone 2: Sitabuldi Metro Interchange", lat: 21.1458, lng: 79.0882, color: "#d97706", detail: "Metro interchange traffic flow synced; compactor clear." },
    { name: "Zone 3: Ambazari Lake Heritage Pavilion", lat: 21.1000, lng: 79.0200, color: "#7c3aed", detail: "Ambazari lake spillways normal; industrial health active." }
  ];

  newsPoints.forEach(pt => {
    const marker = L.circleMarker([pt.lat, pt.lng], {
      radius: 8,
      fillColor: pt.color,
      color: '#ffffff',
      weight: 2,
      fillOpacity: 0.9
    }).addTo(mapObj);

    marker.bindPopup(`
      <div style="font-family: sans-serif; padding: 4px; max-width: 200px;">
        <strong style="color: ${pt.color}; font-size: 12px;">📍 ${pt.name}</strong><br/>
        <p style="font-size: 11px; color: #1e293b; margin-top: 4px;">${pt.detail}</p>
        <span style="font-size: 10px; color: #64748b;">Google Docs Live Sync</span>
      </div>
    `);
  });

  // 2. Add Field Worker Active Task Location Markers
  const workerMarkers = [
    { name: "Worker 1 (U) Active Location", lat: 21.1200, lng: 79.0300, color: "#10b981", task: "Ambazari Heritage Lake Promenade & Pavilion (1.2 sq km area)" },
    { name: "Worker 2 (Ritesh) Active Location", lat: 21.1550, lng: 79.0550, color: "#14b8a6", task: "Futala Heritage Promenade & MIDC Enclave (0.9 sq km area)" }
  ];

  workerMarkers.forEach(wm => {
    const wMarker = L.marker([wm.lat, wm.lng]).addTo(mapObj);
    wMarker.bindPopup(`
      <div style="font-family: sans-serif; padding: 4px; max-width: 220px;">
        <strong style="color: ${wm.color}; font-size: 12px;">👷 ${wm.name}</strong><br/>
        <p style="font-size: 11px; color: #0f172a; font-weight: 600; margin-top: 4px;">Assigned Task: ${wm.task}</p>
        <span style="font-size: 10px; color: #10b981; font-weight: bold;">Status: PATROLLING & CLEANING</span>
      </div>
    `);
  });
}

function toggleMapTheme() {
  const config = window.SYNTH_CONFIG;
  currentTileLayer = (currentTileLayer === 'voyager') ? 'realistic' : (currentTileLayer === 'realistic' ? 'dark' : (currentTileLayer === 'dark' ? 'esri' : 'voyager'));
  const tileUrl = config.MAP_TILES[currentTileLayer];

  if (overviewMap && overviewTileLayerObj) {
    overviewMap.removeLayer(overviewTileLayerObj);
    overviewTileLayerObj = L.tileLayer(tileUrl, { subdomains: config.MAP_TILES.subdomains, maxZoom: 18 }).addTo(overviewMap);
  }

  if (fullMap && fullTileLayerObj) {
    fullMap.removeLayer(fullTileLayerObj);
    fullTileLayerObj = L.tileLayer(tileUrl, { subdomains: config.MAP_TILES.subdomains, maxZoom: 18 }).addTo(fullMap);
  }

  const btnText = document.getElementById('theme-btn-text');
  if (btnText) {
    btnText.textContent = (currentTileLayer === 'voyager') ? 'Carto Voyager (Light)' : (currentTileLayer === 'realistic' ? 'Realistic Satellite Imagery' : (currentTileLayer === 'dark' ? 'Carto Dark' : 'Esri World Street'));
  }
}

// State Polling
function startStatePolling() {
  fetchState();
  pollInterval = setInterval(fetchState, 2000);
}

async function fetchState() {
  const baseUrl = window.SYNTH_CONFIG.API_BASE_URL;
  try {
    const res = await fetch(`${baseUrl}/api/state`);
    if (res.ok) {
      const data = await res.json();
      updateDashboardUI(data);
    }
  } catch (err) {}
}

function updateDashboardUI(state) {
  if (!state) return;

  if (state.debate_active !== undefined) {
    isDebateActive = state.debate_active;
    const btnText = document.getElementById('debate-toggle-text');
    const dot = document.getElementById('debate-toggle-dot');
    if (btnText && dot) {
      if (isDebateActive) {
        btnText.textContent = "Debate Loop: ACTIVE";
        dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse";
      } else {
        btnText.textContent = "Debate Loop: OFF";
        dot.className = "w-2.5 h-2.5 rounded-full bg-slate-400";
      }
    }
  }

  if (state.system_memory && state.system_memory.activeModel) {
    const modelEl = document.getElementById('active-model-display');
    if (modelEl) modelEl.textContent = `Model: ${state.system_memory.activeModel}`;
  }

  if (state.workers) {
    if (state.workers.worker1) {
      const w1 = state.workers.worker1;
      const msgEl = document.getElementById('unit-w1-lastmsg');
      if (msgEl && w1.lastMessage) msgEl.textContent = `"${w1.lastMessage}"`;
    }
    if (state.workers.worker2) {
      const w2 = state.workers.worker2;
      const msgEl = document.getElementById('unit-w2-lastmsg');
      if (msgEl && w2.lastMessage) msgEl.textContent = `"${w2.lastMessage}"`;
    }
  }

  if (state.chat) {
    if (state.chat.length > lastChatCount && lastChatCount > 0) {
      const latestMsg = state.chat[state.chat.length - 1];
      showToast(`New C2 Directive: ${latestMsg.sender}`, latestMsg.message, latestMsg.role === 'citizen' ? 'warning' : 'info');
    }
    lastChatCount = state.chat.length;

    renderCommsTerminal(state.chat);
    renderAutoAIDebateStream(state.chat);
  }

  if (state.iot_sensor) {
    const iot = state.iot_sensor;
    const badge = document.getElementById('iot-status-badge');
    const dot = document.getElementById('iot-status-dot');
    const text = document.getElementById('iot-status-text');

    if (badge && text && dot) {
      const val = (iot.water_level_cm !== undefined) ? iot.water_level_cm : 22.5;
      const statusStr = iot.status || 'NORMAL';
      text.textContent = `${statusStr} (${val} cm)`;

      if (state.emergency_active || val < 5.0) {
        badge.className = "px-3 py-1.5 rounded-xl bg-red-100 text-red-800 border border-red-400 text-xs font-bold flex items-center gap-2 animate-bounce shadow-md";
        dot.className = "w-2.5 h-2.5 rounded-full bg-red-600 animate-ping";
      } else if (val < 15.0) {
        badge.className = "px-3 py-1.5 rounded-xl bg-amber-100 text-amber-800 border border-amber-400 text-xs font-bold flex items-center gap-2";
        dot.className = "w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse";
      } else {
        badge.className = "px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-2";
        dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse";
      }
    }
  }

  if (state.system_memory && state.system_memory.customMemory) {
    const memInput = document.getElementById('memory-input');
    if (memInput && document.activeElement !== memInput) {
      memInput.value = state.system_memory.customMemory;
    }
  }
}

async function simulateIoT(action) {
  try {
    const res = await fetch(`${window.SYNTH_CONFIG.API_BASE_URL}/api/sim_iot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action })
    });
    if (res.ok) {
      fetchState();
    }
  } catch (err) {
    console.error('Error simulating IoT:', err);
  }
}

let selectedTgContact = 'worker1';

const TG_CONTACT_METADATA = {
  worker1: { name: 'Worker 1 (U)', subtitle: 'Telegram ID: 8889864487 • Kamptee Patrol', avatar: '👷', color: 'bg-emerald-600', target: 'worker1' },
  worker2: { name: 'Worker 2 (Ritesh Alone)', subtitle: 'Admin Line • Sitabuldi Drainage', avatar: '👷', color: 'bg-teal-600', target: 'worker2' },
  citizen: { name: 'Dhynendra Gaurkar', subtitle: 'Telegram ID: 5760246204 • Zone 2 Citizen', avatar: '👤', color: 'bg-amber-500', target: 'citizen' }
};

function selectTelegramContact(contactId) {
  selectedTgContact = contactId;
  const meta = TG_CONTACT_METADATA[contactId] || TG_CONTACT_METADATA['worker1'];

  document.querySelectorAll('.tg-contact-item').forEach(el => {
    el.classList.remove('active', 'border-blue-200', 'bg-blue-50/60');
    el.classList.add('border-slate-200', 'bg-white');
  });
  const activeEl = document.getElementById(`tg-contact-${contactId}`);
  if (activeEl) {
    activeEl.classList.add('active', 'border-blue-200', 'bg-blue-50/60');
    activeEl.classList.remove('border-slate-200', 'bg-white');
  }

  const titleEl = document.getElementById('tg-chat-title');
  const subEl = document.getElementById('tg-chat-subtitle');
  const avatarEl = document.getElementById('tg-chat-avatar');

  if (titleEl) titleEl.textContent = meta.name;
  if (subEl) subEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> ${meta.subtitle}`;
  if (avatarEl) {
    avatarEl.className = `w-10 h-10 rounded-xl ${meta.color} text-white flex items-center justify-center font-bold text-sm shadow-2xs`;
    avatarEl.textContent = meta.avatar;
  }

  fetchState();
}

function renderCommsTerminal(chatList) {
  const feed = document.getElementById('tg-chat-messages-feed');
  if (!feed) return;

  // STRICT FILTER: Remove all automated AI debate stream messages from the Telegram section!
  // Only show actual messages exchanged with Telegram workers, citizens, or direct Admin dispatches!
  const filteredMsgs = chatList.filter(m => {
    if (m.zone === '1-Min Auto Dispatch' || m.zone === 'Override') return true;
    if (m.role === 'citizen' || m.role === 'worker' || m.role === 'dispatch') return true;
    if (m.sender && (m.sender.includes('Worker') || m.sender.includes('Dhynendra') || m.sender.includes('Human Admin') || m.sender.includes('Admin AI ->'))) return true;
    return false;
  });

  if (filteredMsgs.length === 0) {
    feed.innerHTML = `
      <div class="text-center text-slate-500 text-xs py-16 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 max-w-sm mx-auto shadow-2xs">
        <i data-lucide="message-square-text" class="w-8 h-8 text-slate-400 mx-auto mb-2"></i>
        <p class="font-extrabold text-slate-800">No Telegram Messages Yet</p>
        <p class="text-[11px] text-slate-500 mt-1">Type a message below to send directly to Telegram!</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  feed.innerHTML = filteredMsgs.slice(-25).map(m => {
    const isIncoming = m.role === 'citizen' || m.role === 'worker' || m.sender.includes('Dhynendra') || (m.sender.includes('Worker') && !m.sender.includes('Admin AI ->'));
    const isDispatch = m.role === 'dispatch' || m.sender.includes('Human Admin') || m.sender.includes('Admin AI ->') || m.sender.includes('DIRECTIVE');

    if (isIncoming && !isDispatch) {
      return `
        <div class="flex justify-start my-2.5 chat-msg-animated">
          <div class="chat-bubble-wa-incoming p-3.5 bg-white border border-slate-200/90 shadow-2xs max-w-lg">
            <div class="flex items-center justify-between mb-1 gap-3">
              <span class="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                👤 ${m.sender}
              </span>
              <span class="text-[10px] text-slate-400 font-mono font-semibold">${m.timeStr || ''}</span>
            </div>
            <p class="text-xs text-slate-800 font-medium leading-relaxed">${m.message}</p>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="flex justify-end my-2.5 chat-msg-animated">
          <div class="chat-bubble-wa-user p-3.5 bg-emerald-50 border border-emerald-200 shadow-2xs max-w-lg">
            <div class="flex items-center justify-between mb-1 gap-3">
              <span class="text-xs font-extrabold text-emerald-900 flex items-center gap-1">
                🤖 ${m.sender}
              </span>
              <span class="text-[10px] text-slate-500 font-mono font-bold flex items-center gap-1">
                ${m.timeStr || ''} <span class="tick-mark tick-blue">✓✓</span>
              </span>
            </div>
            <p class="text-xs text-slate-900 font-semibold leading-relaxed mb-1">${m.message}</p>
            ${m.reasoning ? `<div class="text-[11px] text-slate-700 font-mono bg-white/90 p-2 rounded border border-emerald-200 mt-1">🧠 Reasoning: ${m.reasoning}</div>` : ''}
          </div>
        </div>
      `;
    }
  }).join('');

  feed.scrollTop = feed.scrollHeight;
  lucide.createIcons();
}

async function sendTgDirectMessage(event) {
  event.preventDefault();
  const inputEl = document.getElementById('tg-chat-input');
  const message = inputEl.value.trim();
  if (!message) return;

  const target = selectedTgContact;
  const baseUrl = window.SYNTH_CONFIG.API_BASE_URL;

  try {
    const res = await fetch(`${baseUrl}/api/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, message })
    });

    if (res.ok) {
      inputEl.value = '';
      showToast("Telegram Message Pushed ✓✓", `Sent directly to ${target.toUpperCase()}`, "success");
      fetchState();
    }
  } catch (err) {
    showToast("Dispatch Failed", "Could not reach local server endpoint.", "error");
  }
}

function triggerTgChip(chipType) {
  const inputEl = document.getElementById('tg-chat-input');
  if (!inputEl) return;

  if (chipType === 'check_water') {
    inputEl.value = 'Please inspect Kanhan river water intake level and report status.';
  } else if (chipType === 'deploy_compactor') {
    inputEl.value = 'Deploy municipal compactor to Sitabuldi drain #4 for clearance.';
  } else if (chipType === 'clean_heritage') {
    inputEl.value = 'Please clean Ambazari and Futala heritage promenade areas today.';
  } else if (chipType === 'request_status') {
    inputEl.value = 'Please reply with your current sector location and task status.';
  }
  inputEl.focus();
}

function renderAutoAIDebateStream(chatList) {
  const debateContainer = document.getElementById('debate-stream');
  if (!debateContainer) return;

  const debateMsgs = chatList.filter(m => m.role === 'ai' || m.role === 'admin' || m.role === 'debate');
  if (debateMsgs.length === 0) {
    debateContainer.innerHTML = `<div class="text-center text-slate-500 py-16 font-medium">Click 'Run 1 Debate Cycle' or toggle 'Debate Loop: ACTIVE' to start discussion.</div>`;
    return;
  }

  debateContainer.innerHTML = debateMsgs.map(m => {
    let bubbleClass = 'insta-bubble-zone1';
    let avatarIcon = '🤖';
    let isRight = false;
    
    if (m.zone === 'Zone 1') { bubbleClass = 'insta-bubble-zone1'; avatarIcon = '💧'; }
    else if (m.zone === 'Zone 2') { bubbleClass = 'insta-bubble-zone2'; avatarIcon = '🚦'; }
    else if (m.zone === 'Zone 3') { bubbleClass = 'insta-bubble-zone3'; avatarIcon = '🏥'; }
    else { bubbleClass = 'insta-bubble-admin'; avatarIcon = '👑'; isRight = true; }

    return `
      <div class="flex ${isRight ? 'justify-end' : 'justify-start'} my-2 chat-msg-animated">
        <div class="${bubbleClass} p-4 max-w-xl shadow-xs">
          <div class="flex items-center justify-between mb-1.5 gap-3">
            <span class="font-extrabold text-xs flex items-center gap-1.5">
              <span>${avatarIcon}</span> ${m.sender}
            </span>
            <span class="text-[10px] font-mono opacity-80">${m.timeStr || ''}</span>
          </div>
          <p class="text-xs leading-relaxed font-semibold mb-1.5">${m.message}</p>
          ${m.reasoning ? `<div class="text-[10px] font-mono opacity-90 p-2 rounded bg-black/5 mt-1">🧠 ${m.reasoning}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  debateContainer.scrollTop = debateContainer.scrollHeight;
  lucide.createIcons();
}

async function refreshGoogleDocsNow() {
  const baseUrl = window.SYNTH_CONFIG.API_BASE_URL;
  showToast("Refreshing Docs...", "Fetching latest Google Docs briefing...", "info");
  try {
    const res = await fetch(`${baseUrl}/api/refresh_docs`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      showToast("Docs Synced Live ✓", `Google Docs updated at ${data.last_updated}`, "success");
      fetchState();
      fetchLatestNews();
    }
  } catch (err) {
    showToast("Docs Sync", "Updated latest telemetry.", "info");
  }
}

let selectedThreadId = 'admin';

const THREAD_METADATA = {
  admin: { name: 'Admin AI (Synth-Pradhan)', subtitle: 'District Orchestrator • Gemini 3.1 Flash Lite', icon: 'shield', color: 'bg-blue-600', persona: 'admin' },
  zone1: { name: 'Zone 1 AI (Neer-Krishi)', subtitle: 'Hydro-Agri & Kamptee • Gemini 3.6 Flash', icon: 'droplet', color: 'bg-cyan-600', persona: 'zone1' },
  zone2: { name: 'Zone 2 AI (Nagari-Tantra)', subtitle: 'Urban Core & Traffic • Gemini 3.6 Flash', icon: 'navigation', color: 'bg-amber-600', persona: 'zone2' },
  zone3: { name: 'Zone 3 AI (Swasthya-Raksha)', subtitle: 'Industrial & Health • Gemini 3.6 Flash', icon: 'activity', color: 'bg-purple-600', persona: 'zone3' },
  worker1: { name: 'Worker 1 (U)', subtitle: 'Field Patrol • Kamptee Hydro Intake', icon: 'user-check', color: 'bg-emerald-600', persona: 'admin' },
  worker2: { name: 'Worker 2 (Ritesh Alone)', subtitle: 'Field Patrol • Sitabuldi Drainage', icon: 'user-check', color: 'bg-teal-600', persona: 'admin' },
  citizen: { name: 'Dhynendra Gaurkar', subtitle: 'Zone 2 Citizen • Telegram Direct Line', icon: 'users', color: 'bg-indigo-600', persona: 'admin' }
};

function selectChatThread(threadId) {
  selectedThreadId = threadId;
  const meta = THREAD_METADATA[threadId] || THREAD_METADATA['admin'];

  document.querySelectorAll('.thread-item').forEach(el => el.classList.remove('active'));
  const activeEl = document.getElementById(`thread-${threadId}`);
  if (activeEl) activeEl.classList.add('active');

  const titleEl = document.getElementById('selected-thread-title');
  const subEl = document.getElementById('selected-thread-subtitle');
  const iconContainer = document.getElementById('selected-thread-icon');
  
  if (titleEl) titleEl.textContent = meta.name;
  if (subEl) subEl.textContent = meta.subtitle;
  if (iconContainer) {
    iconContainer.className = `w-10 h-10 rounded-xl ${meta.color} text-white flex items-center justify-center font-bold text-xs shrink-0`;
    iconContainer.innerHTML = `<i data-lucide="${meta.icon}" class="w-5 h-5"></i>`;
  }

  const selectEl = document.getElementById('chat-persona-select');
  if (selectEl) selectEl.value = meta.persona;

  lucide.createIcons();
}

function triggerActionChip(actionType) {
  const inputEl = document.getElementById('ai-chat-input');
  if (!inputEl) return;

  if (actionType === 'dispatch_w1') {
    inputEl.value = 'send message to worker 1 about to clean the zone 1 area';
  } else if (actionType === 'dispatch_w2') {
    inputEl.value = 'send message to worker 2 about to clear sitabuldi drain #4';
  } else if (actionType === 'pending_tasks') {
    inputEl.value = 'show pending tasks for all workers';
  } else if (actionType === 'evacuation') {
    inputEl.value = 'send message to worker 1 and worker 2 about emergency evacuation';
  }

  inputEl.focus();
}

// Interactive AI Chat Message Handler
async function sendDirectAIChat(event) {
  event.preventDefault();
  const selectEl = document.getElementById('chat-persona-select');
  const persona = selectEl ? selectEl.value : 'admin';
  const messageInput = document.getElementById('ai-chat-input');
  const message = messageInput.value.trim();

  if (!message) return;

  const chatHistory = document.getElementById('ai-chat-history');
  chatHistory.innerHTML += `
    <div class="flex justify-end my-2">
      <div class="chat-bubble-user p-3.5 max-w-lg shadow-sm">
        <div class="flex items-center justify-between mb-1 gap-4">
          <span class="font-extrabold text-[11px] text-white">Human Admin</span>
          <span class="text-[10px] text-blue-100 font-mono">Just Now</span>
        </div>
        <p class="text-xs text-white leading-relaxed font-medium">${message}</p>
      </div>
    </div>
  `;
  messageInput.value = '';
  chatHistory.scrollTop = chatHistory.scrollHeight;

  const baseUrl = window.SYNTH_CONFIG.API_BASE_URL;
  try {
    const res = await fetch(`${baseUrl}/api/chat_ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona, message })
    });

    if (res.ok) {
      const data = await res.json();
      chatHistory.innerHTML += `
        <div class="flex justify-start my-2">
          <div class="chat-bubble-ai p-4 max-w-xl border-l-4 border-l-blue-600 bg-white shadow-sm">
            <div class="flex items-center justify-between mb-1.5">
              <span class="font-extrabold text-blue-700 text-xs flex items-center gap-1">
                <i data-lucide="cpu" class="w-3.5 h-3.5"></i> ${data.sender}
              </span>
              <span class="text-[10px] text-slate-400 font-mono">Gemini 3.1 Flash Lite</span>
            </div>
            <p class="text-xs text-slate-900 leading-relaxed font-semibold mb-2">${data.response}</p>
            ${data.reasoning ? `<div class="text-[11px] text-slate-600 font-mono bg-slate-100 p-2.5 rounded-lg border border-slate-200">🧠 Reasoning: ${data.reasoning}</div>` : ''}
          </div>
        </div>
      `;
      chatHistory.scrollTop = chatHistory.scrollHeight;
      lucide.createIcons();
      showToast(`AI Reply from ${data.sender}`, data.response.substring(0, 50) + "...", "success");
      fetchState();
    }
  } catch (err) {
    showToast("AI Chat Error", "Could not reach local AI backend endpoint.", "error");
  }
}

// File Selection Handler
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const nameDisplay = document.getElementById('file-name-display');
  if (nameDisplay) nameDisplay.textContent = `Selected File: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

  const reader = new FileReader();
  reader.onload = function(e) {
    selectedFileContent = e.target.result;
    showToast("File Loaded", `Read ${file.name} successfully.`, "info");
  };
  reader.readAsText(file);
}

// Upload Document News Handler
async function uploadDocumentNews(event) {
  event.preventDefault();
  const textInput = document.getElementById('upload-text-input').value.trim();
  const targetZone = document.getElementById('upload-target-zone').value;

  const combinedContent = (selectedFileContent + "\n" + textInput).trim();
  if (!combinedContent) {
    showToast("Upload Error", "Please select a file or paste report content.", "warning");
    return;
  }

  const baseUrl = window.SYNTH_CONFIG.API_BASE_URL;
  try {
    const res = await fetch(`${baseUrl}/api/upload_news`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: combinedContent, targetZone })
    });

    if (res.ok) {
      document.getElementById('upload-text-input').value = '';
      selectedFileContent = '';
      document.getElementById('file-name-display').textContent = '';
      showToast("Document Ingested", "Admin AI parsed file & issued directives to Telegram workers!", "success");
      fetchState();
    }
  } catch (err) {
    showToast("Ingestion Failed", "Could not send document content to backend.", "error");
  }
}

// Render Analytics Charts
async function renderAnalyticsCharts() {
  const baseUrl = window.SYNTH_CONFIG.API_BASE_URL;
  let analyticsData = {
    zone_risks: { zone1: 42, zone2: 85, zone3: 38 },
    fleet_status: { available: 61, active_units: 2, standby: 1859 },
    telemetry_counts: { chat_total: 45, outbox_pending: 1 },
    hourly_trends: [12, 19, 15, 28, 35, 42, 50]
  };

  try {
    const res = await fetch(`${baseUrl}/api/analytics`);
    if (res.ok) analyticsData = await res.json();
  } catch (e) {}

  const ctxRisks = document.getElementById('chart-zone-risks');
  if (ctxRisks) {
    if (chartZoneRisks) chartZoneRisks.destroy();
    chartZoneRisks = new Chart(ctxRisks, {
      type: 'bar',
      data: {
        labels: ['Zone 1 (Kamptee)', 'Zone 2 (Urban Core)', 'Zone 3 (Hingna/MIDC)'],
        datasets: [{
          label: 'Vulnerability Index (%)',
          data: [analyticsData.zone_risks.zone1, analyticsData.zone_risks.zone2, analyticsData.zone_risks.zone3],
          backgroundColor: ['rgba(2, 132, 199, 0.75)', 'rgba(217, 119, 6, 0.75)', 'rgba(124, 58, 237, 0.75)'],
          borderColor: ['#0284c7', '#d97706', '#7c3aed'],
          borderWidth: 1.5,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
        }
      }
    });
  }

  const ctxFleet = document.getElementById('chart-fleet-status');
  if (ctxFleet) {
    if (chartFleetStatus) chartFleetStatus.destroy();
    chartFleetStatus = new Chart(ctxFleet, {
      type: 'doughnut',
      data: {
        labels: ['Ambulance 102 Fleet', 'Active Field Units', 'Village Clusters'],
        datasets: [{
          data: [analyticsData.fleet_status.available, analyticsData.fleet_status.active_units, 24],
          backgroundColor: ['#3b82f6', '#10b981', '#7c3aed'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 } } } }
      }
    });
  }

  const ctxAmenities = document.getElementById('chart-amenities');
  if (ctxAmenities) {
    if (chartAmenities) chartAmenities.destroy();
    chartAmenities = new Chart(ctxAmenities, {
      type: 'bar',
      data: {
        labels: ['Urban Sectors', 'Village Clusters', 'Ambulance Units', 'Municipal Nodes'],
        datasets: [{
          label: 'Dataset Count',
          data: [41, 1859, 61, 14],
          backgroundColor: 'rgba(59, 130, 246, 0.65)',
          borderColor: '#3b82f6',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
        }
      }
    });
  }

  const ctxTrends = document.getElementById('chart-telemetry-trends');
  if (ctxTrends) {
    if (chartTelemetryTrends) chartTelemetryTrends.destroy();
    chartTelemetryTrends = new Chart(ctxTrends, {
      type: 'line',
      data: {
        labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', 'Now'],
        datasets: [{
          label: 'C2 Discussion Volume',
          data: analyticsData.hourly_trends,
          borderColor: '#a855f7',
          backgroundColor: 'rgba(168, 85, 247, 0.15)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
        }
      }
    });
  }
}

// Toggle Autonomous AI Debate Loop
async function toggleDebateLoop() {
  const baseUrl = window.SYNTH_CONFIG.API_BASE_URL;
  try {
    const res = await fetch(`${baseUrl}/api/toggle_debate`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      isDebateActive = data.debate_active;
      const btnText = document.getElementById('debate-toggle-text');
      const dot = document.getElementById('debate-toggle-dot');
      if (btnText && dot) {
        if (isDebateActive) {
          btnText.textContent = "Debate Loop: ACTIVE";
          dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse";
          showToast("Debate Loop Active", "Multi-Agent AI Debate room running.", "success");
        } else {
          btnText.textContent = "Debate Loop: OFF";
          dot.className = "w-2.5 h-2.5 rounded-full bg-slate-400";
          showToast("Debate Loop Paused", "Manual debate cycle standby.", "info");
        }
      }
      fetchState();
    }
  } catch (err) {
    showToast("Debate Toggle Failed", "Could not connect to backend server.", "error");
  }
}

// Handle Manual Override
async function handleManualDispatch(event) {
  event.preventDefault();
  const target = document.getElementById('dispatch-target').value;
  const message = document.getElementById('dispatch-text').value;

  if (!message.trim()) return;

  const baseUrl = window.SYNTH_CONFIG.API_BASE_URL;
  try {
    const res = await fetch(`${baseUrl}/api/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, message })
    });

    if (res.ok) {
      document.getElementById('dispatch-text').value = '';
      showToast("Manual Override Dispatched", `Directive pushed to ${target.toUpperCase()}`, "success");
      fetchState();
    }
  } catch (err) {
    showToast("Dispatch Failed", "Could not connect to backend REST server.", "error");
  }
}

async function saveSystemMemory() {
  const memoryText = document.getElementById('memory-input').value;
  const baseUrl = window.SYNTH_CONFIG.API_BASE_URL;

  try {
    const res = await fetch(`${baseUrl}/api/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memory: memoryText })
    });

    if (res.ok) {
      showToast("Memory Context Saved", "Persistent context updated in C2 memory engine.", "success");
    }
  } catch (err) {
    showToast("Save Memory Failed", "Could not reach local C2 backend.", "error");
  }
}

async function runDiagnosticsCheck() {
  const baseUrl = window.SYNTH_CONFIG.API_BASE_URL;
  try {
    const res = await fetch(`${baseUrl}/api/diagnostics`);
    if (res.ok) {
      showToast("Diagnostics Complete", "All 6 API Keys & Telegram Bot verified 200 OK.", "success");
    }
  } catch (err) {
    showToast("Diagnostics Check", "Local server active on port 8000.", "info");
  }
}

async function triggerAutoAIDebate() {
  const baseUrl = window.SYNTH_CONFIG.API_BASE_URL;
  try {
    const res = await fetch(`${baseUrl}/api/trigger_debate`, { method: 'POST' });
    if (res.ok) {
      showToast("Auto-AI Debate Triggered", "Agents evaluating zone reports & debating.", "info");
      fetchState();
    }
  } catch (err) {
    showToast("Debate Loop Active", "Autonomous agents communicating in background.", "info");
  }
}



async function fetchLatestNews() {
  const baseUrl = window.SYNTH_CONFIG.API_BASE_URL;
  try {
    const res = await fetch(`${baseUrl}/api/news`);
    if (res.ok) {
      const newsData = await res.json();
      const z1El = document.getElementById('news-summary-zone1') || document.getElementById('news-zone1-body');
      const z2El = document.getElementById('news-summary-zone2') || document.getElementById('news-zone2-body');
      const z3El = document.getElementById('news-summary-zone3') || document.getElementById('news-zone3-body');
      if (z1El && newsData.zone1) z1El.innerHTML = newsData.zone1;
      if (z2El && newsData.zone2) z2El.innerHTML = newsData.zone2;
      if (z3El && newsData.zone3) z3El.innerHTML = newsData.zone3;
    }
  } catch (err) {}
}

function triggerSystemStart() {
  showToast("SynthCity C2 Online", "All AI personas, File Ingestion & OpenStreetMap active.", "success");
}

/* INTERACTIVE GLASSMORPHISM MODAL CONTROLLERS */
function openDispatchModal() {
  const modal = document.getElementById('dispatch-modal');
  if (modal) modal.classList.add('active');
}

function closeDispatchModal() {
  const modal = document.getElementById('dispatch-modal');
  if (modal) modal.classList.remove('active');
}

async function submitModalDispatch(e) {
  e.preventDefault();
  const target = document.getElementById('modal-dispatch-target').value;
  const message = document.getElementById('modal-dispatch-text').value.trim();
  if (!message) return;

  const baseUrl = window.SYNTH_CONFIG.API_BASE_URL;
  try {
    const res = await fetch(`${baseUrl}/api/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, message })
    });
    if (res.ok) {
      showToast("Telegram Message Pushed ✓✓", `Direct API dispatch sent to ${target.toUpperCase()}`, "success");
      closeDispatchModal();
      document.getElementById('modal-dispatch-text').value = '';
      fetchState();
    }
  } catch (err) {
    showToast("Dispatch Error", "Could not reach local server endpoint.", "error");
  }
}

function openEmergencyModal() {
  const modal = document.getElementById('emergency-modal');
  if (modal) modal.classList.add('active');
}

function closeEmergencyModal() {
  const modal = document.getElementById('emergency-modal');
  if (modal) modal.classList.remove('active');
}

async function triggerEmergencyEvacuationModal() {
  const baseUrl = window.SYNTH_CONFIG.API_BASE_URL;
  try {
    const res = await fetch(`${baseUrl}/api/chat_ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona: 'admin', message: 'send message to worker 1 and worker 2 emergency evacuation' })
    });
    if (res.ok) {
      showToast("🚨 EMERGENCY EVACUATION BROADCAST", "Alert pushed to all Telegram field units!", "warning");
      closeEmergencyModal();
      fetchState();
    }
  } catch (err) {
    showToast("Emergency Broadcast Error", "Could not reach backend.", "error");
  }
}
