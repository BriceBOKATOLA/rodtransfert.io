/* =========================================================
   RodTransfert · HTML / CSS / JS uniquement
   Stockage des fichiers : API publique Gofile (sans compte)
   ========================================================= */

const MAX_BYTES = 3 * 1024 ** 3;                       // 3 Go
const UPLOAD_URL = 'https://upload.gofile.io/uploadfile';
const HISTORY_KEY = 'rodtransfert:history';

const $ = (id) => document.getElementById(id);
const el = {
  drop: $('drop'), fileInput: $('fileInput'), folderBtn: $('folderBtn'), folderInput: $('folderInput'),
  clearBtn: $('clearBtn'), list: $('fileList'), meterFill: $('meterFill'), meterUsed: $('meterUsed'),
  fileCount: $('fileCount'), sendBtn: $('sendBtn'),
  ringFill: $('ringFill'), pct: $('pct'), uploadName: $('uploadName'),
  statSent: $('statSent'), statSpeed: $('statSpeed'), statEta: $('statEta'), cancelBtn: $('cancelBtn'),
  shareLink: $('shareLink'), copyBtn: $('copyBtn'), openLink: $('openLink'), shareBtn: $('shareBtn'),
  doneSummary: $('doneSummary'), newBtn: $('newBtn'),
  errorMsg: $('errorMsg'), retryBtn: $('retryBtn'), backBtn: $('backBtn'),
  overlay: $('overlay'), toast: $('toast'),
  history: $('history'), historyList: $('historyList'), clearHistory: $('clearHistory'),
};
const states = ['stateSelect', 'stateUpload', 'stateDone', 'stateError'].map($);

let files = [];
let currentXhr = null;
let cancelled = false;
let uploading = false;

/* ---------- Utilitaires ---------- */
function formatBytes(b) {
  if (!b) return '0 o';
  const u = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), u.length - 1);
  const v = b / 1024 ** i;
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1).replace('.', ',')} ${u[i]}`;
}
function formatTime(s) {
  if (!isFinite(s) || s < 0) return '…';
  if (s < 60) return `${Math.ceil(s)} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${Math.ceil(s % 60)} s`;
  return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
}
const totalSize = () => files.reduce((n, f) => n + f.size, 0);
const fileKey = (f) => `${f.webkitRelativePath || f.name}|${f.size}|${f.lastModified}`;

function show(id) { states.forEach((s) => s.classList.toggle('hidden', s.id !== id)); }

let toastTimer;
function toast(msg, isError = false) {
  el.toast.textContent = msg;
  el.toast.classList.toggle('err', isError);
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 3200);
}

const TYPES = [
  { re: /^(jpe?g|png|gif|webp|svg|heic|bmp|avif)$/, label: 'IMG', color: '#7b5cff' },
  { re: /^(mp4|mov|avi|mkv|webm|m4v)$/, label: 'VID', color: '#ff5a36' },
  { re: /^(mp3|wav|flac|aac|ogg|m4a)$/, label: 'AUD', color: '#18b67a' },
  { re: /^(pdf)$/, label: 'PDF', color: '#e5484d' },
  { re: /^(zip|rar|7z|tar|gz)$/, label: 'ZIP', color: '#ffb23f' },
  { re: /^(docx?|odt|txt|rtf|md)$/, label: 'DOC', color: '#2f7bf5' },
  { re: /^(xlsx?|csv|ods)$/, label: 'XLS', color: '#13a35a' },
  { re: /^(pptx?|odp|key)$/, label: 'PPT', color: '#f07c24' },
];
function typeOf(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return TYPES.find((t) => t.re.test(ext)) || { label: ext.slice(0, 4) || 'FIC', color: '#17131f' };
}

/* ---------- Gestion de la sélection ---------- */
function addFiles(list) {
  let refused = 0;
  const known = new Set(files.map(fileKey));
  let size = totalSize();
  for (const f of list) {
    if (known.has(fileKey(f))) continue;
    if (size + f.size > MAX_BYTES) { refused++; continue; }
    files.push(f); known.add(fileKey(f)); size += f.size;
  }
  if (refused) toast(`${refused} fichier${refused > 1 ? 's' : ''} ignoré${refused > 1 ? 's' : ''} : limite de 3 Go atteinte`, true);
  render();
}

function render() {
  el.list.innerHTML = '';
  files.forEach((f, i) => {
    const t = typeOf(f.name);
    const li = document.createElement('li');
    li.className = 'file';
    li.innerHTML = `
      <span class="file-ico" style="background:${t.color}">${t.label}</span>
      <div class="file-meta">
        <p class="file-name"></p>
        <p class="file-size">${formatBytes(f.size)}</p>
      </div>
      <button class="file-rm" type="button" aria-label="Retirer">
        <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>`;
    li.querySelector('.file-name').textContent = f.webkitRelativePath || f.name;
    li.querySelector('.file-rm').onclick = () => { files.splice(i, 1); render(); };
    el.list.appendChild(li);
  });

  const size = totalSize();
  const ratio = size / MAX_BYTES;
  el.meterFill.style.width = `${Math.min(ratio * 100, 100)}%`;
  el.meterFill.classList.toggle('warn', ratio > 0.9);
  el.meterUsed.textContent = formatBytes(size);
  el.fileCount.textContent = files.length
    ? `${files.length} fichier${files.length > 1 ? 's' : ''}`
    : 'Aucun fichier';
  el.sendBtn.disabled = files.length === 0;
  el.clearBtn.hidden = files.length === 0;
}

/* Lecture récursive des dossiers glissés */
function readEntry(entry, path = '') {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file((f) => {
        if (path) Object.defineProperty(f, 'webkitRelativePath', { value: path + f.name });
        resolve([f]);
      }, () => resolve([]));
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const all = [];
      const readBatch = () => reader.readEntries(async (entries) => {
        if (!entries.length) {
          const nested = await Promise.all(all.map((e) => readEntry(e, `${path}${entry.name}/`)));
          resolve(nested.flat());
        } else { all.push(...entries); readBatch(); }
      }, () => resolve([]));
      readBatch();
    } else resolve([]);
  });
}

async function handleDrop(dt) {
  const items = [...(dt.items || [])].filter((it) => it.kind === 'file');
  const entries = items.map((it) => it.webkitGetAsEntry && it.webkitGetAsEntry()).filter(Boolean);
  if (entries.length) {
    const nested = await Promise.all(entries.map((e) => readEntry(e)));
    addFiles(nested.flat());
  } else {
    addFiles(dt.files);
  }
}

/* ---------- Glisser-déposer ---------- */
let dragDepth = 0;
const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');

window.addEventListener('dragenter', (e) => {
  if (!hasFiles(e) || uploading) return;
  e.preventDefault();
  dragDepth++;
  el.overlay.classList.add('show');
  el.drop.classList.add('is-over');
});
window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener('dragleave', (e) => {
  if (!hasFiles(e)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) { el.overlay.classList.remove('show'); el.drop.classList.remove('is-over'); }
});
window.addEventListener('drop', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  el.overlay.classList.remove('show');
  el.drop.classList.remove('is-over');
  if (uploading) return;
  show('stateSelect');
  handleDrop(e.dataTransfer);
});

el.drop.addEventListener('click', () => el.fileInput.click());
el.drop.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.fileInput.click(); }
});
el.fileInput.addEventListener('change', () => { addFiles(el.fileInput.files); el.fileInput.value = ''; });
el.folderBtn.addEventListener('click', () => el.folderInput.click());
el.folderInput.addEventListener('change', () => { addFiles(el.folderInput.files); el.folderInput.value = ''; });
el.clearBtn.addEventListener('click', () => { files = []; render(); });

/* Coller des fichiers (Ctrl+V) */
window.addEventListener('paste', (e) => {
  if (uploading || !e.clipboardData?.files?.length) return;
  addFiles(e.clipboardData.files);
});

/* ---------- Envoi ---------- */
function uploadOne(file, opts, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    if (opts.token) form.append('token', opts.token);
    if (opts.folderId) form.append('folderId', opts.folderId);
    form.append('file', file, file.webkitRelativePath || file.name);

    const xhr = new XMLHttpRequest();
    currentXhr = xhr;
    xhr.open('POST', UPLOAD_URL);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded); };
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && res.status === 'ok') resolve(res.data);
        else reject(new Error(res.status || `Erreur serveur (${xhr.status})`));
      } catch { reject(new Error(`Réponse inattendue du serveur (${xhr.status})`)); }
    };
    xhr.onerror = () => reject(new Error('Connexion perdue. Vérifiez votre réseau.'));
    xhr.onabort = () => reject(new Error('cancelled'));
    xhr.send(form);
  });
}

function setProgress(ratio) {
  const c = 326.73;
  el.ringFill.style.strokeDashoffset = c - c * ratio;
  el.pct.textContent = Math.floor(ratio * 100);
}

async function startUpload() {
  if (!files.length) return;
  uploading = true;
  cancelled = false;
  show('stateUpload');
  setProgress(0);
  el.statSent.textContent = '0 o';
  el.statSpeed.textContent = '…';
  el.statEta.textContent = '…';

  const total = totalSize();
  const startedAt = performance.now();
  let done = 0;
  let speed = 0;
  let lastT = startedAt;
  let lastBytes = 0;
  const opts = { token: null, folderId: null };
  let downloadPage = null;

  try {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      el.uploadName.textContent = files.length > 1
        ? `${i + 1}/${files.length} · ${f.webkitRelativePath || f.name}`
        : f.name;

      const data = await uploadOne(f, opts, (loaded) => {
        const sent = done + loaded;
        const now = performance.now();
        const dt = (now - lastT) / 1000;
        if (dt > 0.4) {
          const inst = (sent - lastBytes) / dt;
          speed = speed ? speed * 0.7 + inst * 0.3 : inst;
          lastT = now; lastBytes = sent;
          el.statSpeed.textContent = `${formatBytes(speed)}/s`;
          el.statEta.textContent = formatTime((total - sent) / speed);
        }
        el.statSent.textContent = formatBytes(sent);
        setProgress(total ? sent / total : 1);
      });

      done += f.size;
      if (!opts.token) {
        opts.token = data.guestToken || null;
        opts.folderId = data.parentFolder || null;
        downloadPage = data.downloadPage;
      }
    }

    setProgress(1);
    finish(downloadPage, total, files.length, (performance.now() - startedAt) / 1000);
  } catch (err) {
    uploading = false;
    currentXhr = null;
    if (cancelled || err.message === 'cancelled') {
      show('stateSelect');
      toast('Transfert annulé');
      return;
    }
    el.errorMsg.textContent = err.message || 'Une erreur est survenue.';
    show('stateError');
  }
}

function finish(link, total, count, seconds) {
  uploading = false;
  currentXhr = null;
  el.shareLink.value = link;
  el.openLink.href = link;
  el.doneSummary.textContent =
    `${count} fichier${count > 1 ? 's' : ''} · ${formatBytes(total)} · envoyé en ${formatTime(seconds)}`;
  el.copyBtn.textContent = 'Copier';
  el.copyBtn.classList.remove('ok');
  el.shareBtn.hidden = !navigator.share;
  show('stateDone');
  saveHistory({ link, count, total, date: Date.now(), name: files[0]?.name || 'Transfert' });
  files = [];
  render();
}

el.sendBtn.addEventListener('click', startUpload);
el.retryBtn.addEventListener('click', startUpload);
el.backBtn.addEventListener('click', () => show('stateSelect'));
el.newBtn.addEventListener('click', () => show('stateSelect'));
el.cancelBtn.addEventListener('click', () => {
  cancelled = true;
  if (currentXhr) currentXhr.abort();
});

el.copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(el.shareLink.value);
  } catch {
    el.shareLink.select();
    document.execCommand('copy');
  }
  el.copyBtn.textContent = 'Copié !';
  el.copyBtn.classList.add('ok');
  toast('Lien copié dans le presse-papiers');
});
el.shareLink.addEventListener('focus', () => el.shareLink.select());
el.shareBtn.addEventListener('click', () => {
  navigator.share({ title: 'RodTransfert', text: 'Voici mes fichiers', url: el.shareLink.value }).catch(() => {});
});

window.addEventListener('beforeunload', (e) => {
  if (uploading) { e.preventDefault(); e.returnValue = ''; }
});

/* ---------- Historique local ---------- */
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
}
function saveHistory(item) {
  const list = [item, ...loadHistory()].slice(0, 5);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch {}
  renderHistory();
}
function renderHistory() {
  const list = loadHistory();
  el.history.hidden = !list.length;
  el.historyList.innerHTML = '';
  list.forEach((h) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = h.link; a.target = '_blank'; a.rel = 'noopener';
    const label = document.createElement('span');
    label.textContent = h.count > 1 ? `${h.name} + ${h.count - 1}` : h.name;
    const meta = document.createElement('small');
    meta.textContent = `${formatBytes(h.total)} · ${new Date(h.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
    a.append(label, meta);
    li.appendChild(a);
    el.historyList.appendChild(li);
  });
}
el.clearHistory.addEventListener('click', () => {
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
  renderHistory();
});

/* ---------- Init ---------- */
$('year').textContent = new Date().getFullYear();
render();
renderHistory();
