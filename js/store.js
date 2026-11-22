/* Хранилище: localStorage + синхронизация с файлом data/db.json в репозитории GitHub. */
const KEY = "wklase_db_v1";
const SESSION = "wklase_session";
const TOKEN = "wklase_gh_token";

const CFG = Object.assign({ owner: "", repo: "", branch: "main", path: "data/db.json" }, window.WKLASE_CONFIG || {});
if (!CFG.owner && /\.github\.io$/i.test(location.hostname)) {
  CFG.owner = location.hostname.split(".")[0];
  const seg = location.pathname.split("/")[1];
  CFG.repo = seg && !/\.html?$/i.test(seg) ? seg : location.hostname;
}
const GH = !!(CFG.owner && CFG.repo);

const uid = () => Math.random().toString(36).slice(2, 10);
const toB64 = s => btoa(unescape(encodeURIComponent(s)));
const fromB64 = s => decodeURIComponent(escape(atob(String(s).replace(/\s/g, ""))));
const hex = u8 => [...u8].map(b => b.toString(16).padStart(2, "0")).join("");
const unhex = h => new Uint8Array((h.match(/../g) || []).map(x => parseInt(x, 16)));
const tok = () => { try { return localStorage.getItem(TOKEN) || ""; } catch (e) { return ""; } };

/* Пароли: PBKDF2-SHA256 с индивидуальной солью (старые SHA-256 хэши тоже читаются). */
async function legacyHash(s) {
  try {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("wklase:" + s));
      return "s2:" + hex(new Uint8Array(buf));
    }
  } catch (e) {}
  let h = 5381; for (const c of "wklase:" + s) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return "d1:" + h.toString(16);
}
async function pbkdf2(pw, saltHex) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: unhex(saltHex), iterations: 100000, hash: "SHA-256" }, key, 256);
  return "p1:" + saltHex + ":" + hex(new Uint8Array(bits));
}
async function hashNew(pw) {
  try { if (window.crypto && crypto.subtle) return await pbkdf2(pw, hex(crypto.getRandomValues(new Uint8Array(16)))); } catch (e) {}
  return legacyHash(pw);
}
async function verify(pw, stored) {
  if (String(stored).startsWith("p1:")) { try { return (await pbkdf2(pw, stored.split(":")[1])) === stored; } catch (e) { return false; } }
  return (await legacyHash(pw)) === stored;
}

const valid = d => d && Array.isArray(d.users) && d.users.some(u => u.role === "admin" && u.email && u.pass);
const normalize = d => { d.grades = Array.isArray(d.grades) ? d.grades : []; d.homework = Array.isArray(d.homework) ? d.homework : []; d.news = Array.isArray(d.news) ? d.news : []; d.ads = Array.isArray(d.ads) ? d.ads : [{ id: "a_windecs", title: "Windecs VPN", text: "", image: "", url: "https://t.me/windecs_vpnbot" }]; return d; };

const Store = {
  db: null, sha: null, status: GH ? "loading" : "local", cfg: CFG, ghEnabled: GH,
  onStatus: null, onChange: null, _last: 0, _pushing: false, _again: false, _tm: null,

  setStatus(s) { this.status = s; if (this.onStatus) this.onStatus(s); },
  token: tok,
  setToken(v) { try { v ? localStorage.setItem(TOKEN, v) : localStorage.removeItem(TOKEN); } catch (e) {} this.setStatus(GH ? (v ? "saving" : "needtoken") : "local"); },
  canWrite() { return GH && !!tok(); },

  async init() {
    try { this.db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { this.db = null; }
    if (!valid(this.db)) {
      this.db = { users: [{ id: "u_admin", email: "admin@wklase.lv", name: "Admin", role: "admin", pass: await hashNew("admin123") }], grades: [], homework: [], news: [] };
    }
    normalize(this.db); this.saveLocal();
    if (GH) await this.pull(); else this.setStatus("local");
  },

  saveLocal() { try { localStorage.setItem(KEY, JSON.stringify(this.db)); return true; } catch (e) { return false; } },
  save() {
    const ok = this.saveLocal();
    if (GH) { clearTimeout(this._tm); this._tm = setTimeout(() => this.push(), 600); }
    return ok;
  },

  /* ----- GitHub ----- */
  _api(path, opt = {}) {
    const h = Object.assign({ Accept: "application/vnd.github+json" }, tok() ? { Authorization: "Bearer " + tok() } : {}, opt.headers || {});
    return fetch(`https://api.github.com/repos/${CFG.owner}/${CFG.repo}/${path}`, Object.assign({}, opt, { headers: h, cache: "no-store" }));
  },
  async pull(o = {}) {
    if (!GH) return "off";
    if (!o.force && Date.now() - this._last < 20000) return "skip";
    this._last = Date.now();
    let res = "fail";
    try {
      const r = await this._api(`contents/${CFG.path}?ref=${encodeURIComponent(CFG.branch)}`);
      if (r.status === 404) { this.sha = null; this.setStatus(tok() ? "nofile" : "local"); return "nofile"; }
      if (!r.ok) throw new Error("api");
      const j = await r.json();
      const d = JSON.parse(fromB64(j.content));
      if (!valid(d)) throw new Error("bad");
      this.db = normalize(d); this.sha = j.sha; this.saveLocal();
      this.setStatus(tok() ? "synced" : "readonly"); res = "ok";
    } catch (e) {
      try { /* запасной вариант: файл с самого сайта (только чтение) */
        const r = await fetch(CFG.path + "?t=" + Date.now(), { cache: "no-store" });
        if (r.ok) { const d = await r.json(); if (valid(d)) { this.db = normalize(d); this.saveLocal(); this.setStatus("readonly"); res = "ok"; } }
      } catch (e2) {}
      if (res !== "ok") this.setStatus("offline");
    }
    if (res === "ok" && o.notify && this.onChange) this.onChange();
    return res;
  },
  async push() {
    if (!GH) return;
    if (!tok()) { this.setStatus("needtoken"); return; }
    if (this._pushing) { this._again = true; return; }
    this._pushing = true; this.setStatus("saving");
    try {
      const body = { message: "Wklase: update data", content: toB64(JSON.stringify(this.db, null, 1)), branch: CFG.branch };
      if (this.sha) body.sha = this.sha;
      const r = await this._api(`contents/${CFG.path}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) { this.sha = (await r.json()).content.sha; this.setStatus("synced"); }
      else if (r.status === 409 || r.status === 422) { await this.pull({ force: true, notify: true }); this.setStatus("conflict"); }
      else if (r.status === 401 || r.status === 403 || r.status === 404) this.setStatus("denied");
      else this.setStatus("error");
    } catch (e) { this.setStatus("error"); }
    this._pushing = false;
    if (this._again) { this._again = false; this.push(); }
  },
  /* Загрузка вложения отдельным файлом в репозиторий (data/files/...) */
  async uploadFile(f) {
    const safe = f.name.replace(/[^\w.\-]+/g, "_");
    const path = `data/files/${Date.now().toString(36)}-${uid()}-${safe}`;
    const r = await this._api(`contents/${path}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Wklase: file", content: f.data.split(",")[1], branch: CFG.branch }) });
    if (!r.ok) throw new Error("upload");
    return { name: f.name, type: f.type, url: `https://raw.githubusercontent.com/${CFG.owner}/${CFG.repo}/${CFG.branch}/${path}` };
  },

  /* ----- данные ----- */
  byEmail(e) { return this.db.users.find(u => u.email.toLowerCase() === e.trim().toLowerCase()); },
  byId(id) { return this.db.users.find(u => u.id === id); },
  async login(email, pw) {
    await this.pull();
    const u = this.byEmail(email);
    if (u && await verify(pw, u.pass)) { try { localStorage.setItem(SESSION, u.id); } catch (e) {} return u; }
    return null;
  },
  current() { try { return this.byId(localStorage.getItem(SESSION)); } catch (e) { return null; } },
  logout() { try { localStorage.removeItem(SESSION); } catch (e) {} },
  async addUser({ email, name, pass, role }) {
    if (this.byEmail(email)) return "exists";
    this.db.users.push({ id: "u_" + uid(), email: email.trim(), name: name.trim(), role, pass: await hashNew(pass) });
    this.save(); return "ok";
  },
  deleteUser(id) {
    const u = this.byId(id); if (!u) return false;
    if (u.role === "admin" && this.db.users.filter(x => x.role === "admin").length < 2) return false;
    this.db.users = this.db.users.filter(x => x.id !== id);
    this.db.grades = this.db.grades.filter(g => g.studentId !== id);
    this.save(); return true;
  },
  setRole(id, role) {
    const u = this.byId(id); if (!u) return false;
    if (u.role === "admin" && role !== "admin" && this.db.users.filter(x => x.role === "admin").length < 2) return false;
    u.role = role; this.save(); return true;
  },
  async setPass(id, pw) { const u = this.byId(id); if (u) { u.pass = await hashNew(pw); this.save(); } },
  addNews(authorId, title, text) {
    this.db.news.push({ id: "n_" + uid(), authorId, title: title.trim(), text: text.trim(), date: new Date().toISOString().slice(0, 10) });
    this.save();
  },
  addAd(title, text, url, image) {
    this.db.ads.push({ id: "a_" + uid(), title: title.trim(), text: text.trim(), url: url.trim(), image: image || "" });
    this.save();
  },
  deleteAd(id) { this.db.ads = this.db.ads.filter(a => a.id !== id); this.save(); },
  deleteNews(id) { this.db.news = this.db.news.filter(n => n.id !== id); this.save(); },
  exportJson() { return JSON.stringify(this.db, null, 2); },
  importJson(text) {
    const d = JSON.parse(text);
    if (!valid(d)) throw new Error("bad");
    this.db = normalize(d); this.save();
  }
};
