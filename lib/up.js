// Shared helpers for the supplier tools: talking to the API, shrinking photos, and uploading straight to storage.
window.RR = (() => {
  const API = "https://obgedilcyvaaewpvvdzi.supabase.co/functions/v1/shop";
  // the link's own key; pages opened from the home screen or by sharing photos use the one saved last time
  const tok = new URLSearchParams(location.search).get("c") || (() => { try { return localStorage.getItem("rr_sup_tok") || ""; } catch { return ""; } })();

  async function call(act, body) {
    const r = await fetch(`${API}?c=${encodeURIComponent(tok)}&act=${act}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `failed ${r.status}`);
    return j;
  }
  async function info() {
    const r = await fetch(`${API}?c=${encodeURIComponent(tok)}&days=1`, { cache: "no-store" });
    if (!r.ok) throw new Error(r.status === 404 ? "badlink" : "failed");
    return r.json();
  }

  // Phone photos are often 4000 px and 5 MB. Shrink to a sharp 1600 px JPEG before upload:
  // faster on mobile data, and the price-stamping step stays quick.
  async function shrink(file, max = 1600, keepPng = false) {
    if (!/^image\//.test(file.type) || file.type === "image/gif") return file;
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { return file; }
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const g = c.getContext("2d");
    const png = keepPng && file.type === "image/png";
    if (!png) { g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); }
    g.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, png ? "image/png" : "image/jpeg", 0.86));
    return blob || file;
  }

  // Asks the API for upload slots, then sends each file straight to storage, a few at a time.
  async function upload(blobs, purpose, onEach) {
    const { slots } = await call("sign", { purpose, files: blobs.map((b) => ({ mime: b.type || "image/jpeg" })) });
    const out = new Array(blobs.length).fill(null);
    let next = 0, done = 0;
    async function worker() {
      while (next < blobs.length) {
        const i = next++;
        const s = slots[i];
        if (s) {
          for (let tries = 0; tries < 3 && !out[i]; tries++) {
            try {
              const fd = new FormData();
              fd.append("cacheControl", "3600");
              fd.append("", blobs[i]);
              const r = await fetch(s.url, { method: "PUT", body: fd, headers: { "x-upsert": "false" } });
              if (r.ok) out[i] = s.path;
            } catch { /* try again */ }
          }
        }
        onEach && onEach(++done, blobs.length);
      }
    }
    await Promise.all([worker(), worker(), worker()]);
    return out;
  }

  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }

  // Rows from an Excel or CSV file, with lower-case header names.
  async function readSheet(file) {
    if (!window.XLSX) await loadScript("lib/xlsx.mini.min.js");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: "", raw: false }).map((row) => {
      const o = {};
      for (const [k, v] of Object.entries(row)) o[String(k).trim().toLowerCase()] = String(v ?? "").trim();
      return o;
    });
  }

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  return { API, tok, call, info, shrink, upload, readSheet, loadScript, esc };
})();
