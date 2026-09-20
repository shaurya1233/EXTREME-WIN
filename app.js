import { analyze, health, startDownload, status, cancel } from './api.js';
import { addHistory, getHistory, clearHistoryLocal } from './storage.js';
const $ = (s) => document.querySelector(s);
let current = null;
let activeJob = null;
let timer;
let started = 0;
let lastBytes = 0;
let lastTime = 0;
const fmtBytes = (n) => n == null ? 'Size unknown' : `${n < 1024 ? Math.round(n) : n / 1024 < 1024 ? (n / 1024).toFixed(1) + ' KB' : n / 1048576 < 1024 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1073741824).toFixed(2) + ' GB'}`;
const fmtTime = (s) => s == null || !Number.isFinite(s) ? '—' : `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
function badge(el, text, kind = 'neutral') { el.textContent = text; el.className = `badge ${kind}`; }
function renderAnalysis(a) { current = a; badge($('#sourceType'), a.sourceType || 'Unknown', a.downloadSupported ? 'ok' : 'warn'); const body = $('#resultBody'); if (!a.success) {
    body.innerHTML = `<div class="badtext"><strong>${escapeHtml(a.reason || 'Analysis failed.')}</strong></div>`;
    return;
} const formats = (a.formats || []).filter(f => f.downloadable); body.innerHTML = `<div class="media">${a.thumbnail ? `<img class="thumb" src="${escapeAttr(a.thumbnail)}" alt="">` : '<div class="thumb"></div>'}<div><div class="title">${escapeHtml(a.title || 'Untitled media')}</div><div class="meta"><div><span>Duration</span><b>${a.duration == null ? 'Unavailable' : fmtTime(a.duration)}</b></div><div><span>Size</span><b>${fmtBytes(a.filesize)}</b></div><div><span>Resume</span><b>${a.resumeSupported ? 'Available' : 'Unavailable'}</b></div></div></div></div><div class="formats">${formats.length ? formats.map((f, i) => `<div class="format"><div class="format-info"><strong>${escapeHtml((f.resolution || 'Resolution unavailable') + ' · ' + f.format.toUpperCase())}</strong><small>${escapeHtml(f.codec || 'Codec unavailable')} · ${f.fps ? f.fps + ' FPS' : 'FPS unavailable'} · ${fmtBytes(f.size)}</small></div><button data-format="${i}">Download</button></div>`).join('') : '<div class="notice">No directly downloadable MP4/WebM representation was exposed. The source may still be playable through a protected or unsupported streaming system.</div>'}</div>`; body.querySelectorAll('button[data-format]').forEach(b => b.onclick = () => download(Number(b.dataset.format))); }
async function download(index) { if (!current?.formats?.[index])
    return; const f = current.formats[index]; if (!f.downloadable)
    return; setTransfer('Queued', 0, 0, null); try {
    const j = await startDownload({ url: f.url, mediaUrl: f.url, requestedFormat: f.format, title: current.title || 'media' });
    activeJob = j.jobId;
    started = performance.now();
    lastTime = started;
    lastBytes = 0;
    $('#cancelBtn').disabled = false;
    $('#retryBtn').disabled = true;
    setTransfer('Downloading', 0, 0, j.totalBytes ?? f.size);
    poll();
}
catch (e) {
    fail(e instanceof Error ? e.message : String(e));
} }
async function poll() { if (!activeJob)
    return; try {
    const s = await status(activeJob);
    const bytes = Number(s.bytesReceived || 0), total = s.totalBytes == null ? null : Number(s.totalBytes), pct = total && total > 0 ? Math.min(100, bytes / total * 100) : null;
    const now = performance.now();
    const elapsed = (now - started) / 1000;
    const dt = (now - lastTime) / 1000;
    const instant = dt > 0 ? Math.max(0, (bytes - lastBytes) / dt) : 0;
    const average = elapsed > 0 ? (bytes / elapsed) : 0;
    const remain = total != null ? Math.max(0, total - bytes) : null;
    const eta = remain != null && average > 0 ? remain / average : null;
    setTransfer(s.state || 'Downloading', bytes, pct, total, instant, eta, elapsed, average);
    if (s.state === 'completed') {
        setTransfer('Completed', bytes, 100, total, instant, 0, elapsed, average);
        $('#cancelBtn').disabled = true;
        $('#retryBtn').disabled = false;
        const a = document.createElement('a');
        a.href = `/api/download/${encodeURIComponent(activeJob)}/file`;
        a.download = s.filename || 'media';
        document.body.appendChild(a);
        a.click();
        a.remove();
        await addHistory({ title: current?.title || 'Media', source: current?.finalUrl || '', format: current?.formats?.[0]?.format || '', resolution: current?.formats?.[0]?.resolution || null, size: bytes, date: new Date().toISOString(), status: 'completed' });
        activeJob = null;
        renderHistory();
        return;
    }
    if (['failed', 'cancelled'].includes(s.state)) {
        fail(s.error || s.state);
        $('#cancelBtn').disabled = true;
        $('#retryBtn').disabled = false;
        activeJob = null;
        return;
    }
    lastBytes = bytes;
    lastTime = now;
    timer = window.setTimeout(poll, 300);
}
catch (e) {
    fail(e instanceof Error ? e.message : String(e));
    activeJob = null;
} }
function setTransfer(state, bytes, pct, total, speed = 0, eta = null, elapsed = (performance.now() - started) / 1000, average = speed) { badge($('#transferState'), state, state === 'Completed' ? 'ok' : state === 'Error' ? 'bad' : state === 'Downloading' ? 'ok' : 'neutral'); $('#transferAmount').textContent = `${fmtBytes(bytes)} / ${fmtBytes(total)}`; $('#transferPercent').textContent = pct == null ? '—' : `${pct.toFixed(1)}%`; $('#transferFill').style.width = pct == null ? '0%' : `${pct}%`; $('#speed').textContent = speed ? `${fmtBytes(speed)}/s` : '—'; $('#avgSpeed').textContent = average ? `${fmtBytes(average)}/s` : '—'; $('#eta').textContent = eta == null ? '—' : fmtTime(eta); $('#elapsed').textContent = fmtTime(elapsed); $('#snake').classList.toggle('snake-on', state === 'Downloading' && pct != null && pct < 100); lastBytes = bytes; }
function fail(message) { $('#cancelBtn').disabled = true; $('#retryBtn').disabled = false; badge($('#transferState'), 'Error', 'bad'); $('#transferError').textContent = message; $('#snake').classList.remove('snake-on'); }
$('#analyzeForm').addEventListener('submit', async (e) => { e.preventDefault(); const url = $('#url').value.trim(); $('#sourceStatus').textContent = 'Analyzing actual source…'; badge($('#sourceType'), 'Analyzing…', 'warn'); try {
    const a = await analyze(url);
    renderAnalysis(a);
    $('#sourceStatus').textContent = a.success ? 'Analysis complete.' : (a.reason || 'Analysis failed.');
}
catch (err) {
    $('#sourceStatus').textContent = err instanceof Error ? err.message : String(err);
    badge($('#sourceType'), 'Error', 'bad');
} });
$('#cancelBtn').onclick = async () => { if (activeJob)
    try {
        await cancel(activeJob);
    }
    catch { } ; activeJob = null; fail('Download cancelled.'); };
$('#retryBtn').onclick = () => { if (current?.formats?.length)
    download(0); };
$('#clearHistory').onclick = async () => { await clearHistoryLocal(); renderHistory(); };
function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function escapeAttr(s) { return escapeHtml(s); }
async function renderHistory() { try {
    const h = await getHistory();
    $('#history').innerHTML = h.length ? h.map((x) => `<div class="history-row"><div><strong>${escapeHtml(x.title || 'Media')}</strong><small>${escapeHtml(x.format || '')} · ${escapeHtml(x.resolution || 'Resolution unavailable')} · ${fmtBytes(x.size)} · ${new Date(x.date).toLocaleString()}</small></div><span class="badge ok">${escapeHtml(x.status)}</span></div>`).join('') : 'No downloads yet.';
}
catch {
    $('#history').textContent = 'History unavailable in this browser.';
} }
async function boot() { renderHistory(); try {
    const h = await health();
    badge($('#backendBadge'), 'Backend Online', 'ok');
    const map = { Backend: h.ok, Analyzer: h.capabilities?.analyzer, Downloader: h.capabilities?.downloader, FFmpeg: h.capabilities?.ffmpeg, Storage: h.capabilities?.storage };
    $('#healthGrid').innerHTML = Object.entries(map).map(([k, v]) => `<div><span>${k}</span><b class="${v ? 'oktext' : 'badtext'}">${v ? 'Online' : 'Unavailable'}</b></div>`).join('');
}
catch {
    badge($('#backendBadge'), 'Backend Offline', 'bad');
    $('#healthGrid').innerHTML = ['Backend', 'Analyzer', 'Downloader', 'FFmpeg', 'Storage'].map(k => `<div><span>${k}</span><b class="badtext">Unavailable</b></div>`).join('');
} }
boot();
