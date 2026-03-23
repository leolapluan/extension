// popup.js — UI logic for Personal Tips Extension (Global Random Interval)

// ─── State ────────────────────────────────────────────────────────────────────

let tips = [];
let globalConfig = { intervalMs: 1800000, scrollSpeed: 150 }; // default 30 min, 150 px/s
let currentTab = 'active';
let countdownTimer = null;
let editingId = null;

// ─── Utilities ────────────────────────────────────────────────────────────────

function uuid() {
    return crypto.randomUUID
        ? crypto.randomUUID()
        : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
            (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
        );
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatCountdown(ms) {
    if (ms <= 0) return 'now';
    const totalSec = Math.floor(ms / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

// ─── Storage ─────────────────────────────────────────────────────────────────

async function load() {
    const data = await chrome.storage.sync.get(null);
    tips = [];
    let hasLegacyTipsArray = false;

    if (data.globalConfig) {
        globalConfig = { ...globalConfig, ...data.globalConfig };
    }

    for (const [key, value] of Object.entries(data)) {
        if (key.startsWith('tip-')) {
            tips.push(value);
        } else if (key === 'tips' && Array.isArray(value)) {
            hasLegacyTipsArray = true;
        }
    }

    tips.sort((a, b) => a.id.localeCompare(b.id));

    if (hasLegacyTipsArray && data.tips.length > 0) {
        const legacyTips = data.tips;
        const migrationData = {};
        for (const t of legacyTips) {
            migrationData[`tip-${t.id}`] = t;
            if (!tips.some(existing => existing.id === t.id)) {
                tips.push(t);
            }
        }
        await chrome.storage.sync.set(migrationData);
        await chrome.storage.sync.remove('tips');
    }
}

async function saveTip(tip) {
    const data = {};
    data[`tip-${tip.id}`] = tip;
    await chrome.storage.sync.set(data);
}

async function saveConfig() {
    await chrome.storage.sync.set({ globalConfig });
}

// ─── Interval Config UI ───────────────────────────────────────────────────────

function loadIntervalUI() {
    const ms = globalConfig.intervalMs;
    const units = [
        { value: 60000,    label: 'minutes' },
        { value: 3600000,  label: 'hours' },
        { value: 86400000, label: 'days' },
    ];

    // Find the best matching unit
    let bestUnit = units[0];
    let bestValue = ms / units[0].value;
    for (const u of units) {
        if (ms % u.value === 0) {
            bestUnit = u;
            bestValue = ms / u.value;
        }
    }

    document.getElementById('interval-value').value = bestValue;
    const sel = document.getElementById('interval-unit');
    for (const opt of sel.options) {
        if (parseInt(opt.value) === bestUnit.value) opt.selected = true;
    }
}

async function applyInterval() {
    const val = parseInt(document.getElementById('interval-value').value, 10);
    const unit = parseInt(document.getElementById('interval-unit').value, 10);
    if (!val || isNaN(val) || val < 1) return;

    globalConfig.intervalMs = val * unit;
    await saveConfig();

    // Visual feedback
    const btn = document.getElementById('btn-save-interval');
    btn.textContent = '✓ Saved';
    btn.classList.add('saved');
    setTimeout(() => {
        btn.textContent = 'Apply';
        btn.classList.remove('saved');
    }, 1800);

    updateGlobalCountdown();
}

function loadSpeedUI() {
    document.getElementById('speed-value').value = globalConfig.scrollSpeed || 150;
}

async function applySpeed() {
    const val = parseInt(document.getElementById('speed-value').value, 10);
    if (!val || isNaN(val) || val < 10) return;

    globalConfig.scrollSpeed = val;
    await saveConfig();

    const btn = document.getElementById('btn-save-speed');
    btn.textContent = '✓ Saved';
    btn.classList.add('saved');
    setTimeout(() => {
        btn.textContent = 'Apply';
        btn.classList.remove('saved');
    }, 1800);
}

// ─── Global Countdown ─────────────────────────────────────────────────────────

async function updateGlobalCountdown() {
    const el = document.getElementById('global-countdown');
    try {
        const alarm = await chrome.alarms.get('tips-global-interval');
        if (!alarm) { el.textContent = '—'; return; }
        const msLeft = alarm.scheduledTime - Date.now();
        el.textContent = `in ${formatCountdown(Math.max(0, msLeft))}`;
    } catch {
        el.textContent = '—';
    }
}

function startCountdownTimer() {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(updateGlobalCountdown, 1000);
}

// ─── Render ───────────────────────────────────────────────────────────────────

function render() {
    const active   = tips.filter(t => t.status === 'active');
    const inactive = tips.filter(t => t.status === 'inactive');

    document.getElementById('badge-active').textContent   = active.length;
    document.getElementById('badge-inactive').textContent = inactive.length;

    const shown = currentTab === 'active' ? active : inactive;
    const listEl = document.getElementById('tip-list');

    if (shown.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">${currentTab === 'active' ? '🔴' : '💤'}</div>
                <p>${currentTab === 'active'
                    ? 'No active tips.<br>Add one above to get started.'
                    : 'No inactive tips.'}</p>
            </div>`;
        return;
    }

    listEl.innerHTML = '';

    for (const tip of shown) {
        const card = document.createElement('div');
        card.className = `tip-card${tip.status === 'inactive' ? ' inactive' : ''}`;
        card.dataset.id = tip.id;

        const isActive = tip.status === 'active';
        card.innerHTML = `
            <div class="tip-dot ${tip.status}"></div>
            <div class="tip-text">${escapeHtml(tip.text)}</div>
            <div class="tip-actions">
                <button class="icon-btn edit-btn" data-id="${tip.id}" title="Edit">✏️</button>
                ${isActive
                    ? `<button class="icon-btn pause-btn"  data-id="${tip.id}" title="Pause">⏸</button>`
                    : `<button class="icon-btn toggle-btn" data-id="${tip.id}" title="Activate">▶</button>`
                }
                <button class="icon-btn delete-btn" data-id="${tip.id}" title="Delete">✕</button>
            </div>`;

        listEl.appendChild(card);
    }

    listEl.querySelectorAll('.edit-btn').forEach(btn =>
        btn.addEventListener('click', () => startEdit(btn.dataset.id)));
    listEl.querySelectorAll('.pause-btn').forEach(btn =>
        btn.addEventListener('click', () => setStatus(btn.dataset.id, 'inactive')));
    listEl.querySelectorAll('.toggle-btn').forEach(btn =>
        btn.addEventListener('click', () => setStatus(btn.dataset.id, 'active')));
    listEl.querySelectorAll('.delete-btn').forEach(btn =>
        btn.addEventListener('click', () => deleteTip(btn.dataset.id)));
}

// ─── Actions ─────────────────────────────────────────────────────────────────

async function addTip() {
    const textEl = document.getElementById('tip-input');
    const text = textEl.value.trim();
    if (!text) {
        textEl.focus();
        textEl.style.borderColor = 'var(--accent)';
        setTimeout(() => textEl.style.borderColor = '', 900);
        return;
    }

    if (editingId) {
        const idx = tips.findIndex(t => t.id === editingId);
        if (idx !== -1) {
            tips[idx].text = text;
            await saveTip(tips[idx]);
        }
        cancelEdit();
    } else {
        const newTip = { id: uuid(), text, status: 'active' };
        tips.push(newTip);
        await saveTip(newTip);

        currentTab = 'active';
        setActiveTab('active');
        textEl.value = '';
    }

    render();
}

function startEdit(id) {
    const tip = tips.find(t => t.id === id);
    if (!tip) return;
    editingId = id;
    const textEl = document.getElementById('tip-input');
    textEl.value = tip.text;
    textEl.focus();
    
    document.getElementById('btn-add').textContent = 'Save';
    document.getElementById('btn-add').style.height = '26px';
    document.getElementById('btn-cancel').style.display = 'block';
}

function cancelEdit() {
    editingId = null;
    const textEl = document.getElementById('tip-input');
    textEl.value = '';
    
    document.getElementById('btn-add').textContent = '+ Add';
    document.getElementById('btn-add').style.height = '58px';
    document.getElementById('btn-cancel').style.display = 'none';
}

async function setStatus(id, status) {
    const idx = tips.findIndex(t => t.id === id);
    if (idx === -1) return;
    tips[idx].status = status;
    await saveTip(tips[idx]);
    render();
}

async function deleteTip(id) {
    const idx = tips.findIndex(t => t.id === id);
    if (idx === -1) return;
    tips[idx].status = 'deleted';
    await saveTip(tips[idx]);
    render();
}

function setActiveTab(tab) {
    currentTab = tab;
    document.getElementById('tab-active').classList.toggle('active', tab === 'active');
    document.getElementById('tab-inactive').classList.toggle('active', tab === 'inactive');
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
    await load();
    loadIntervalUI();
    loadSpeedUI();
    render();
    updateGlobalCountdown();
    startCountdownTimer();

    document.getElementById('btn-add').addEventListener('click', addTip);
    document.getElementById('btn-cancel').addEventListener('click', cancelEdit);
    document.getElementById('btn-save-interval').addEventListener('click', applyInterval);
    document.getElementById('btn-save-speed').addEventListener('click', applySpeed);

    document.getElementById('btn-test').addEventListener('click', async () => {
        const btn = document.getElementById('btn-test');
        btn.textContent = '⏳ ...';
        btn.disabled = true;
        chrome.runtime.sendMessage({ type: 'MANUAL_TEST' });
        setTimeout(() => {
            btn.textContent = '▶ Test';
            btn.disabled = false;
        }, 1500);
    });

    document.getElementById('tip-input').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addTip(); }
    });

    document.getElementById('tab-active').addEventListener('click', () => {
        setActiveTab('active'); render();
    });
    document.getElementById('tab-inactive').addEventListener('click', () => {
        setActiveTab('inactive'); render();
    });

    // Live sync from other devices
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'sync') return;
        
        let shouldRender = false;

        // Check for tip updates
        for (const [key, change] of Object.entries(changes)) {
            if (key.startsWith('tip-')) {
                const idx = tips.findIndex(t => t.id === key.replace('tip-', ''));
                if (change.newValue) {
                    if (idx > -1) tips[idx] = change.newValue;
                    else tips.push(change.newValue);
                } else {
                    if (idx > -1) tips.splice(idx, 1);
                }
                shouldRender = true;
            }
            if (key === 'globalConfig') {
                globalConfig = { ...globalConfig, ...change.newValue };
                loadIntervalUI();
                loadSpeedUI();
                updateGlobalCountdown();
            }
        }
        
        if (shouldRender) {
            tips.sort((a, b) => a.id.localeCompare(b.id));
            render();
        }
    });
}

init();
