const statusEl  = document.getElementById('status');
const launcher  = document.getElementById('launcher');
const tilesEl   = document.getElementById('tiles');
const remote    = document.getElementById('remote');
const touchpad  = document.getElementById('touchpad');
const padCursor = document.getElementById('pad-cursor');
const kbInput   = document.getElementById('kb-input');

// ── API ──

function setHeight() {
    document.getElementById('app').style.height = window.innerHeight + 'px';
}
window.addEventListener('resize', setHeight);
setHeight();

async function post(path, data) {
  try {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    setStatus(r.ok ? 'ok' : 'error ' + r.status, r.ok ? 'ok' : 'err');
  } catch(e) {
    setStatus('unreachable', 'err');
  }
}

function setStatus(msg, cls='') {
  statusEl.textContent = msg;
  statusEl.className = cls;
  if (cls === 'ok') setTimeout(() => {
    statusEl.textContent = 'ready';
    statusEl.className = '';
  }, 1200);
}

// ── Load tiles from pitv.ini ──
async function loadTiles() {
  try {
    const r = await fetch('/tiles');
    const tiles = await r.json();
    tilesEl.innerHTML = '';
    tiles.forEach(t => {
      const div = document.createElement('div');
      div.className = 'tile';
      div.innerHTML = `
        <img src="/icons/${t.icon}" alt="${t.title}"
             onerror="this.style.display='none'">
        <div class="tile-label">${t.title}</div>
      `;
      div.addEventListener('click', () => launch(t.url));
      tilesEl.appendChild(div);
    });
  } catch(e) {
    setStatus('ini load failed', 'err');
  }
}

// ── Views ──
function launch(url) {
  post('/navigate', { url });
  showRemote();
}

function showRemote() {
  launcher.style.display = 'none';
  remote.classList.add('active');
}

document.getElementById('home-btn').addEventListener('click', () => {
  remote.classList.remove('active');
  launcher.style.display = 'flex';
});

// ── Control buttons ──
document.getElementById('btn-vol-up').addEventListener('click',   () => post('/volume', { direction: 'up' }));
document.getElementById('btn-vol-down').addEventListener('click', () => post('/volume', { direction: 'down' }));
document.getElementById('btn-up').addEventListener('click',     () => post('/scroll', { direction: 'up' }));
document.getElementById('btn-down').addEventListener('click',   () => post('/scroll', { direction: 'down' }));
document.getElementById('btn-lclick').addEventListener('click', () => post('/click',  { button: 1 }));
document.getElementById('btn-rclick').addEventListener('click', () => post('/click',  { button: 3 }));
document.getElementById('kb-send').addEventListener('click',    sendText);
document.getElementById('kb-enter').addEventListener('click',   () => post('/key', { key: 'Return' }));

kbInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') sendText();
});

function sendText() {
  const text = kbInput.value;
  if (!text) return;
  post('/type', { text });
  kbInput.value = '';
}

// ── Touchpad — relative movement ──
let lastTouch = null;
const SENSITIVITY = 2.5;

touchpad.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.touches[0];
  lastTouch = { x: t.clientX, y: t.clientY };
  padCursor.style.opacity = '1';
  const rect = touchpad.getBoundingClientRect();
  padCursor.style.left = (t.clientX - rect.left) + 'px';
  padCursor.style.top  = (t.clientY - rect.top)  + 'px';
}, { passive: false });

touchpad.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!lastTouch) return;
  const t = e.touches[0];
  const dx = Math.round((t.clientX - lastTouch.x) * SENSITIVITY);
  const dy = Math.round((t.clientY - lastTouch.y) * SENSITIVITY);
  lastTouch = { x: t.clientX, y: t.clientY };
  if (dx !== 0 || dy !== 0) post('/move', { dx, dy });
  const rect = touchpad.getBoundingClientRect();
  padCursor.style.left = (t.clientX - rect.left) + 'px';
  padCursor.style.top  = (t.clientY - rect.top)  + 'px';
}, { passive: false });

touchpad.addEventListener('touchend', e => {
  e.preventDefault();
  lastTouch = null;
  setTimeout(() => { padCursor.style.opacity = '0'; }, 500);
}, { passive: false });

// ── Shutdown (two-tap) ──
let shutdownArmed = false;
let shutdownTimer = null;

document.getElementById('shutdown-btn').addEventListener('contextmenu', e => e.preventDefault());
document.getElementById('shutdown-btn').addEventListener('click', () => {
  if (!shutdownArmed) {
    shutdownArmed = true;
    document.getElementById('shutdown-btn').classList.add('armed');
    shutdownTimer = setTimeout(() => {
      shutdownArmed = false;
      document.getElementById('shutdown-btn').classList.remove('armed');
    }, 3000);
  } else {
    clearTimeout(shutdownTimer);
    post('/shutdown', {});
  }
});

// ── Init ──
loadTiles();
