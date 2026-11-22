/* Wklase — интерфейс. Чистый JS, без сборки. */
let lang = (() => { try { return localStorage.getItem("wklase_lang") || "lv"; } catch (e) { return "lv"; } })();
if (!I18N[lang]) lang = "lv";
const t = k => (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (s, r = document) => r.querySelector(s);
const root = document.getElementById("root");
const state = { tab: null, msg: null, err: null, navOpen: false };

/* SVG-иконки (встроенные) */
const IC = {
  logo: `<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#0f5c4d"/><path d="M12 20l10 26 10-18 10 18 10-26" fill="none" stroke="#f6b93b" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  chev: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8l5 5 5-5"/></svg>`,
  menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  grade: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>`,
  book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19a2 2 0 012-2h13"/></svg>`,
  cal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>`
};

const MONTHS = { lv: ["jan","feb","mar","apr","mai","jūn","jūl","aug","sep","okt","nov","dec"], ru: ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"], en: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] };
const maxFile = () => (Store.canWrite() ? 5 : 1.5) * 1024 * 1024;
const fileLink = f => f && f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.name)}</a>` : f && f.data ? `<a href="${f.data}" download="${esc(f.name)}">${esc(f.name)}</a>` : "—";
const readFile = input => new Promise((res, rej) => {
  const f = input && input.files && input.files[0]; if (!f) return res(null);
  if (f.size > maxFile()) return rej("big");
  const r = new FileReader();
  r.onload = () => res({ name: f.name, type: f.type, data: r.result }); r.onerror = () => rej("read"); r.readAsDataURL(f);
});
const roleLabel = r => t(r);
const today = () => new Date().toISOString().slice(0, 10);

function flash(msg, err) { state.msg = err ? null : msg; state.err = err ? msg : null; }
function takeFlash() {
  const h = (state.err ? `<div class="err">${esc(state.err)}</div>` : "") + (state.msg ? `<div class="ok">${esc(state.msg)}</div>` : "");
  state.err = state.msg = null; return h;
}

/* ---------- общие части ---------- */
function header(user) {
  const langs = { lv: "LV", ru: "RU", en: "EN" };
  return `<header class="header"><div class="container">
    <a class="logo" href="#" data-go="home">${IC.logo}<span>Wklase</span></a>
    <nav class="nav ${state.navOpen ? "open" : ""}" id="nav">
      <a href="#" data-go="home">${t("home")}</a>
      <a href="#features" data-scroll="features">${t("features")}</a>
      <a href="#news" data-scroll="news">${t("news")}</a>
      <a href="#contacts" data-scroll="contacts">${t("contacts")}</a>
    </nav>
    <span class="spacer"></span>
    <div class="dd" data-dd>
      <button class="dd-btn" aria-haspopup="true">${langs[lang]} ${IC.chev}</button>
      <div class="dd-menu">${Object.entries(langs).map(([k, v]) => `<button data-lang="${k}" class="${k === lang ? "active" : ""}">${v} — ${{ lv: "Latviešu", ru: "Русский", en: "English" }[k]}</button>`).join("")}</div>
    </div>
    ${user ? `<div class="dd" data-dd>
      <button class="dd-btn">${esc(user.name || user.email)} ${IC.chev}</button>
      <div class="dd-menu"><button data-go="dash">${t("dashboard")}</button><button data-logout>${t("logout")}</button></div>
    </div>` : `<a class="btn sm" href="#login" data-scroll="login">${t("login")}</a>`}
    <button class="burger" id="burger" aria-label="Menu">${IC.menu}</button>
  </div></header>`;
}

const WD_ICON = {
  tg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 3.2L2.8 10.4c-1 .4-1 1.1-.2 1.3l4.8 1.5 1.8 5.6c.2.6.4.8.8.8.4 0 .6-.2.9-.5l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8L22.9 4.6c.3-1.2-.4-1.7-1.4-1.4zM9 13.2l9-5.7c.4-.3.8-.1.5.2l-7.4 6.7-.3 3.1z"/></svg>`,
  bolt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>`,
  cal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`
};
function vpnAd(a) {
  const tag = /^https?:\/\//i.test(a.url) ? "a" : "div";
  const attrs = tag === "a" ? ` href="${esc(a.url)}" target="_blank" rel="noopener sponsored"` : "";
  const feats = [["bolt", "vpn_f1"], ["shield", "vpn_f2"], ["cal", "vpn_f3"], ["phone", "vpn_f4"]];
  return `<${tag} class="wd"${attrs}>
    <div class="wd-main">
      <div class="wd-brand"><img src="assets/windecs-logo.png" alt="Windecs VPN"></div>
      <div class="wd-sub"><i>${WD_ICON.tg}</i>${t("vpn_tg")}</div>
      <div class="wd-get">${t("vpn_get")}</div>
      <div class="wd-gb">10 GB</div>
      <div class="wd-for"><b>${t("vpn_days")}</b> ${t("vpn_dev")}</div>
      <div class="wd-feats">${feats.map(([i, k]) => `<div><i>${WD_ICON[i]}</i>${t(k)}</div>`).join("")}</div>
      <span class="wd-cta"><i>${WD_ICON.tg}</i>${t("vpn_bot")} <b>@windecs_vpnbot</b></span>
    </div>
    <div class="wd-phone" aria-hidden="true"><div class="wd-screen">
      <div class="wd-top"><i><img src="assets/windecs-shield.png" alt=""></i><div><b>Windecs VPN</b><small>${t("vpn_bot")}</small></div></div>
      <div class="wd-bubble">🎁 ${t("vpn_msg")}</div>
      <div class="wd-card"><div class="wd-big">10 GB</div><div class="wd-ok"><i>${WD_ICON.check}</i>${t("vpn_on")}</div></div>
      <div class="wd-btn">${t("vpn_instr")} ›</div>
    </div></div>
  </${tag}>`;
}

function adsBlock() {
  const ads = Store.db.ads || [];
  if (!ads.length) return "";
  return `<section class="ads"><div class="container"><span class="ads-label">${t("ads")}</span><div class="ads-grid">${ads.map(a => {
    if (a.id === "a_windecs") return vpnAd(a);
    const img = a.image && /^(https:\/\/|assets\/|data:image\/)/i.test(a.image);
    const inner = img ? `<img src="${esc(a.image)}" alt="${esc(a.title)}" loading="lazy">` : `<b>${esc(a.title)}</b><span>${esc(a.text)}</span>`;
    const cls = img ? "ad ad-img" : "ad";
    return /^https?:\/\//i.test(a.url) ? `<a class="${cls}" href="${esc(a.url)}" target="_blank" rel="noopener sponsored">${inner}</a>` : `<div class="${cls}">${inner}</div>`;
  }).join("")}</div></div></section>`;
}

function footer() {
  return `<footer class="footer" id="contacts"><div class="container">
    <div class="cols">
      <div><a class="logo" href="#" data-go="home">${IC.logo}<span>Wklase</span></a><p>${t("about")}</p></div>
      <div><h4>${t("links")}</h4><a href="#" data-go="home">${t("home")}</a><a href="#features" data-scroll="features">${t("features")}</a><a href="#news" data-scroll="news">${t("news")}</a></div>
      <div><h4>${t("contacts")}</h4><a href="mailto:zap22@inbox.lv">zap22@inbox.lv</a><a href="#">Rīga, Latvija</a></div>
    </div>
    <div class="copy">© ${new Date().getFullYear()} Wklase. ${t("rights")}</div>
  </div></footer>`;
}

/* ---------- публичная главная ---------- */
function home() {
  const m = MONTHS[lang];
  const news = Store.db.news.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return `<section class="hero"><div class="container">
    <div><span class="pill">${t("pill")}</span><h1>${t("heroTitle")}</h1><p class="lead">${t("heroText")}</p></div>
    <form class="card" id="login" autocomplete="on">
      <h2>${t("signInTitle")}</h2>
      ${takeFlash()}
      <label class="field"><span>${t("email")}</span><input type="email" name="email" required autocomplete="username"></label>
      <label class="field"><span>${t("password")}</span><input type="password" name="pw" required autocomplete="current-password"></label>
      <button class="btn" style="width:100%">${t("signIn")}</button>
          </form>
  </div></section>
  <section class="block" id="features"><div class="container">
    <h2>${t("features")}</h2>
    <div class="grid2">
      <div class="card feature"><div class="ico">${IC.grade}</div><h3>${t("f1t")}</h3><p>${t("f1d")}</p></div>
      <div class="card feature"><div class="ico">${IC.book}</div><h3>${t("f2t")}</h3><p>${t("f2d")}</p></div>
    </div>
  </div></section>
  <section class="block" id="news"><div class="container"><div class="card">
    <h2>${t("newsTitle")}</h2>
    ${news.length ? news.map(n => { const [y, mo, d] = n.date.split("-"); return `<div class="news-item"><div class="date">${+d}<small>${m[+mo - 1]}</small></div><div><b>${esc(n.title)}</b><p style="margin:4px 0 0;white-space:pre-line">${esc(n.text)}</p></div></div>`; }).join("") : `<p class="note">${t("noNews")}</p>`}
  </div></div></section>`;
}

/* ---------- панели ---------- */
const avg = a => a.length ? (a.reduce((s, g) => s + g.value, 0) / a.length).toFixed(1) : "—";
const gradeRows = (list, withTeacher) => list.length ? `<div class="tbl-wrap"><table><thead><tr><th>${t("date")}</th><th>${t("subject")}</th><th>${t("topic")}</th><th>${t("grade")}</th>${withTeacher ? `<th>${t("teacherCol")}</th>` : `<th>${t("pickStudent")}</th>`}<th>${t("comment")}</th><th>${t("file")}</th></tr></thead><tbody>
  ${list.slice().sort((a, b) => b.date.localeCompare(a.date)).map(g => `<tr><td>${esc(g.date)}</td><td>${esc(g.subject)}</td><td style="white-space:normal">${esc(g.topic || "—")}</td><td><span class="grade">${g.value}</span></td><td>${esc(withTeacher ? (Store.byId(g.teacherId)?.name || "—") : (Store.byId(g.studentId)?.name || "—"))}</td><td>${esc(g.comment || "")}</td><td>${fileLink(g.file)}</td></tr>`).join("")}
  </tbody></table></div>` : `<p class="note">${t("noData")}</p>`;
const hwRows = list => list.length ? `<div class="tbl-wrap"><table><thead><tr><th>${t("due")}</th><th>${t("subject")}</th><th>${t("text")}</th><th>${t("teacherCol")}</th><th>${t("file")}</th></tr></thead><tbody>
  ${list.slice().sort((a, b) => a.due.localeCompare(b.due)).map(h => `<tr><td>${esc(h.due)}</td><td>${esc(h.subject)}</td><td style="white-space:normal">${esc(h.text)}</td><td>${esc(Store.byId(h.teacherId)?.name || "—")}</td><td>${fileLink(h.file)}</td></tr>`).join("")}
  </tbody></table></div>` : `<p class="note">${t("noData")}</p>`;

const SUBJECTS = ["Latviešu valoda", "English", "Русский язык"];
const subjectSelect = () => `<select name="subject">${SUBJECTS.map(s => `<option>${s}</option>`).join("")}</select>`;

function studentDash(u) {
  const mine = Store.db.grades.filter(g => g.studentId === u.id);
  const tab = state.tab || "grades";
  return `<div class="stats"><div class="stat"><b>${avg(mine)}</b>${t("average")}</div><div class="stat"><b>${mine.length}</b>${t("gradesCount")}</div><div class="stat"><b>${Store.db.homework.length}</b>${t("homework")}</div></div>
  <div class="tabs">${[["grades", "myGrades"], ["hw", "homework"]].map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? "on" : ""}">${t(l)}</button>`).join("")}</div>
  <div class="card">${tab === "grades" ? gradeRows(mine, true) : tab === "hw" ? hwRows(Store.db.homework) : ""}</div>`;
}

function teacherDash(u) {
  const students = Store.db.users.filter(x => x.role === "student");
  const given = Store.db.grades.filter(g => g.teacherId === u.id);
  const hw = Store.db.homework.filter(h => h.teacherId === u.id);
  const tab = state.tab || "grades";
  return `<div class="stats"><div class="stat"><b>${students.length}</b>${t("student")}</div><div class="stat"><b>${given.length}</b>${t("gradesCount")}</div><div class="stat"><b>${hw.length}</b>${t("homework")}</div></div>
  ${takeFlash()}
  <div class="tabs">${[["grades", "addGrade"], ["hw", "addHw"]].map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? "on" : ""}">${t(l)}</button>`).join("")}</div>
  ${tab === "grades" ? `<form class="card" id="gradeForm"><div class="row">
      <label class="field"><span>${t("pickStudent")}</span><select name="student" required>${students.map(s => `<option value="${s.id}">${esc(s.name || s.email)}</option>`).join("")}</select></label>
      <label class="field"><span>${t("subject")}</span>${subjectSelect()}</label>
      <label class="field" style="flex:2 1 220px"><span>${t("topic")}</span><input name="topic" maxlength="200"></label>
      <label class="field" style="flex:0 1 100px"><span>${t("grade")}</span><input type="number" name="value" min="1" max="10" required></label>
      <label class="field"><span>${t("comment")}</span><input name="comment"></label>
      <label class="field"><span>${t("attach")}</span><input type="file" name="file"></label>
      <button class="btn">${t("add")}</button></div></form>
    <div class="card" style="margin-top:16px"><h3>${t("myEntries")}</h3>${gradeRows(given, false)}</div>`
  : `<form class="card" id="hwForm"><div class="row">
      <label class="field"><span>${t("subject")}</span>${subjectSelect()}</label>
      <label class="field" style="flex:2 1 260px"><span>${t("text")}</span><input name="text" required></label>
      <label class="field"><span>${t("due")}</span><input type="date" name="due" required value="${today()}"></label>
      <label class="field"><span>${t("attach")}</span><input type="file" name="file"></label>
      <button class="btn">${t("add")}</button></div></form>
    <div class="card" style="margin-top:16px">${hwRows(hw)}</div>`}`;
}

function adminDash(u) {
  const us = Store.db.users;
  const tab = state.tab || "users";
  return `<div class="stats">${["admin", "teacher", "student"].map(r => `<div class="stat"><b>${us.filter(x => x.role === r).length}</b>${roleLabel(r)}</div>`).join("")}</div>
  ${takeFlash()}
  <div class="tabs">${[["users", "users"], ["news", "news_admin"], ["ads", "adsAdmin"], ["backup", "backup"]].map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? "on" : ""}">${t(l)}</button>`).join("")}</div>
  ${tab === "users" ? `
  <form class="card" id="userForm"><h3>${t("addUser")}</h3><div class="row">
    <label class="field"><span>${t("name")}</span><input name="name" required></label>
    <label class="field"><span>${t("email")}</span><input type="email" name="email" required></label>
    <label class="field"><span>${t("password")}</span><input name="pw" required minlength="6"></label>
    <label class="field" style="flex:0 1 170px"><span>${t("role")}</span><select name="role"><option value="student">${t("student")}</option><option value="teacher">${t("teacher")}</option><option value="admin">${t("admin")}</option></select></label>
    <button class="btn">${t("create")}</button></div></form>
  <div class="card" style="margin-top:16px"><div class="tbl-wrap"><table><thead><tr><th>${t("name")}</th><th>${t("email")}</th><th>${t("role")}</th><th>${t("actions")}</th></tr></thead><tbody>
  ${us.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.email)}</td>
    <td><select data-role="${x.id}" style="width:auto">${["student", "teacher", "admin"].map(r => `<option value="${r}" ${x.role === r ? "selected" : ""}>${t(r)}</option>`).join("")}</select></td>
    <td><button class="btn ghost sm" data-pw="${x.id}">${t("resetPw")}</button> <button class="btn danger sm" data-del="${x.id}">${t("del")}</button></td></tr>`).join("")}
  </tbody></table></div></div>` : tab === "news" ? `
  <form class="card" id="newsForm"><h3>${t("news_admin")}</h3>
    <label class="field"><span>${t("newsHead")}</span><input name="title" required maxlength="120"></label>
    <label class="field"><span>${t("newsBody")}</span><textarea name="text" rows="4" required maxlength="2000"></textarea></label>
    <button class="btn">${t("publish")}</button></form>
  <div class="card" style="margin-top:16px">${Store.db.news.length ? Store.db.news.slice().reverse().map(n => `<div class="news-item"><div style="flex:1"><b>${esc(n.title)}</b> <span class="note">${esc(n.date)}</span><p style="margin:4px 0 0;white-space:pre-line">${esc(n.text)}</p></div><button class="btn danger sm" data-delnews="${n.id}">${t("del")}</button></div>`).join("") : `<p class="note">${t("noNews")}</p>`}</div>` : tab === "ads" ? `
  <form class="card" id="adForm"><h3>${t("adsAdmin")}</h3>
    <label class="field"><span>${t("adTitle")}</span><input name="title" required maxlength="80"></label>
    <label class="field"><span>${t("adText")}</span><input name="text" maxlength="200"></label>
    <label class="field"><span>${t("adImage")}</span><input type="file" name="image" accept="image/*"></label>
    <label class="field"><span>${t("adLink")}</span><input name="url" placeholder="https://"></label>
    <button class="btn">${t("add")}</button></form>
  <div class="card" style="margin-top:16px">${Store.db.ads.length ? Store.db.ads.map(a => `<div class="news-item"><div style="flex:1"><b>${esc(a.title)}</b>${a.image ? " 🖼" : ""}<p style="margin:4px 0 0">${esc(a.text)} <span class="note">${esc(a.url)}</span></p></div><button class="btn danger sm" data-delad="${a.id}">${t("del")}</button></div>`).join("") : `<p class="note">${t("noData")}</p>`}</div>` : `
  <div class="card"><h3>${t("backup")}</h3><div class="row" style="align-items:center">
    <button class="btn" id="exportBtn">${t("exportJson")}</button>
    <label class="btn ghost" style="cursor:pointer">${t("importJson")}<input type="file" id="importFile" accept="application/json,.json" hidden></label></div>
    <p class="note" style="margin-top:12px">localStorage → JSON</p></div>`}`;
}

function syncCard() {
  if (!Store.ghEnabled) return "";
  const c = Store.cfg;
  return `<div class="card" style="margin-top:16px">
    <label class="field"><span>GitHub token</span><input type="password" id="ghToken" placeholder="${Store.token() ? "••••••••••••" : "github_pat_…"}" autocomplete="off"></label>
    <div class="row" style="align-items:center"><button class="btn" id="ghSave">${t("gh_save")}</button>
    <button class="btn ghost" id="ghClear">${t("gh_clear")}</button>
    <button class="btn ghost" id="ghPull">${t("gh_pull")}</button>
    <button class="btn ghost" id="ghPush">${t("gh_push")}</button></div></div>`;
}

function dash(u) {
  const body = u.role === "admin" ? adminDash(u) : u.role === "teacher" ? teacherDash(u) : studentDash(u);
  return `<section class="dash"><div class="container">
    <div class="dash-head"><h1 style="margin:0">${t("hello")}, ${esc(u.name || u.email)}</h1><span class="badge ${u.role}">${roleLabel(u.role)}</span>${Store.ghEnabled && u.role === "admin" ? `<span class="badge" id="syncStatus" style="background:#eee;color:#444">${t("sync_" + Store.status)}</span>` : ""}</div>${body}${(u.role === "admin" && state.tab === "backup") ? syncCard() : ""}</div></section>`;
}

/* ---------- рендер и события ---------- */
let view = "home";
function render() {
  const user = Store.current();
  if (view === "dash" && !user) view = "home";
  if (user && view === "home" && !render.firstDone) { view = "dash"; }
  render.firstDone = true;
  document.documentElement.lang = lang;
  root.innerHTML = header(user) + `<main>${view === "dash" && user ? dash(user) : home()}</main>` + (view === "dash" && user ? "" : adsBlock()) + footer();
  bind(user);
}

function go(v) { view = v; state.tab = null; state.navOpen = false; render(); window.scrollTo(0, 0); }

function bind(user) {
  document.querySelectorAll("[data-dd]").forEach(dd => $(".dd-btn", dd).onclick = e => {
    e.stopPropagation(); const was = dd.classList.contains("open");
    document.querySelectorAll("[data-dd]").forEach(x => x.classList.remove("open")); if (!was) dd.classList.add("open");
  });
  document.querySelectorAll("[data-lang]").forEach(b => b.onclick = () => { lang = b.dataset.lang; try { localStorage.setItem("wklase_lang", lang); } catch (e) {} render(); });
  document.querySelectorAll("[data-go]").forEach(a => a.onclick = e => { e.preventDefault(); go(a.dataset.go); });
  document.querySelectorAll("[data-scroll]").forEach(a => a.onclick = e => {
    e.preventDefault(); state.navOpen = false; $("#nav")?.classList.remove("open");
    const id = a.dataset.scroll;
    if (view !== "home") { view = "home"; render(); }
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  });
  document.querySelectorAll("[data-logout]").forEach(b => b.onclick = () => { Store.logout(); go("home"); });
  $("#burger").onclick = () => { state.navOpen = !state.navOpen; $("#nav").classList.toggle("open", state.navOpen); };
  document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { state.tab = b.dataset.tab; render(); });

  const lf = $("#login");
  if (lf) lf.onsubmit = async e => {
    e.preventDefault();
    const u = await Store.login(lf.email.value, lf.pw.value);
    if (u) { go("dash"); } else { flash(t("badLogin"), true); render(); }
  };

  if (!user) return;
  const gf = $("#gradeForm");
  if (gf) gf.onsubmit = async e => {
    e.preventDefault(); const v = +gf.value.value;
    if (!gf.student.value || !(v >= 1 && v <= 10)) return;
    let file; try { file = await readFile(gf.file); } catch (x) { flash(t("tooBig"), true); return render(); }
    if (file && Store.canWrite()) { try { file = await Store.uploadFile(file); } catch (x) { flash(t("saveFail"), true); return render(); } }
    const rec = { id: "g_" + Date.now(), studentId: gf.student.value, teacherId: user.id, subject: gf.subject.value, value: v, topic: gf.topic.value.trim(), date: today(), comment: gf.comment.value };
    if (file) rec.file = file;
    Store.db.grades.push(rec);
    if (Store.save()) flash(t("saved")); else { Store.db.grades.pop(); flash(t("saveFail"), true); }
    render();
  };
  const hf = $("#hwForm");
  if (hf) hf.onsubmit = async e => {
    e.preventDefault();
    let file; try { file = await readFile(hf.file); } catch (x) { flash(t("tooBig"), true); return render(); }
    if (file && Store.canWrite()) { try { file = await Store.uploadFile(file); } catch (x) { flash(t("saveFail"), true); return render(); } }
    const rec = { id: "h_" + Date.now(), teacherId: user.id, subject: hf.subject.value, text: hf.text.value, due: hf.due.value };
    if (file) rec.file = file;
    Store.db.homework.push(rec);
    if (Store.save()) flash(t("saved")); else { Store.db.homework.pop(); flash(t("saveFail"), true); }
    render();
  };
  const uf = $("#userForm");
  if (uf) uf.onsubmit = async e => {
    e.preventDefault();
    const d = { name: uf.name.value, email: uf.email.value, pass: uf.pw.value, role: uf.role.value };
    if (!d.name.trim() || !d.email.trim() || !d.pass) flash(t("fill"), true);
    else if (d.pass.length < 6) flash(t("pwShort"), true);
    else { const r = await Store.addUser(d); r === "ok" ? flash(t("created")) : flash(t("exists"), true); }
    render();
  };
  document.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    if (!confirm(t("confirmDel"))) return;
    if (b.dataset.del === user.id || !Store.deleteUser(b.dataset.del)) flash(t("cantSelf"), true); else flash(t("saved"));
    render();
  });
  document.querySelectorAll("[data-role]").forEach(s => s.onchange = () => {
    if (!Store.setRole(s.dataset.role, s.value)) flash(t("cantSelf"), true); else flash(t("saved"));
    render();
  });
  document.querySelectorAll("[data-pw]").forEach(b => b.onclick = async () => {
    const p = prompt(t("newPw"));
    if (p === null) return;
    if (p.length < 6) flash(t("pwShort"), true); else { await Store.setPass(b.dataset.pw, p); flash(t("pwChanged")); }
    render();
  });
  const gs = $("#ghSave");
  if (gs) gs.onclick = () => { const v = $("#ghToken").value.trim(); if (!v) return; Store.setToken(v); flash(t("saved")); Store.push(); render(); };
  const gc = $("#ghClear"); if (gc) gc.onclick = () => { Store.setToken(""); render(); };
  const gl = $("#ghPull"); if (gl) gl.onclick = () => Store.pull({ force: true, notify: true });
  const gp = $("#ghPush"); if (gp) gp.onclick = () => Store.push();
  const af = $("#adForm");
  if (af) af.onsubmit = async e => {
    e.preventDefault(); const u = af.url.value.trim();
    if (u && !/^https?:\/\//i.test(u)) { flash(t("adBadLink"), true); return render(); }
    let img = ""; 
    try {
      let f = await readFile(af.image);
      if (f && !/^image\//.test(f.type)) throw "type";
      if (f && Store.canWrite()) f = await Store.uploadFile(f);
      if (f) img = f.url || f.data;
    } catch (x) { flash(x === "big" || x === "type" ? t("tooBig") : t("saveFail"), true); return render(); }
    Store.addAd(af.title.value, af.text.value, u, img);
    if (Store.saveLocal()) flash(t("saved")); else { Store.db.ads.pop(); flash(t("saveFail"), true); }
    render();
  };
  document.querySelectorAll("[data-delad]").forEach(b => b.onclick = () => { Store.deleteAd(b.dataset.delad); render(); });
  const nf = $("#newsForm");
  if (nf) nf.onsubmit = e => {
    e.preventDefault();
    if (!nf.title.value.trim() || !nf.text.value.trim()) return;
    Store.addNews(user.id, nf.title.value, nf.text.value); flash(t("saved")); render();
  };
  document.querySelectorAll("[data-delnews]").forEach(b => b.onclick = () => { Store.deleteNews(b.dataset.delnews); render(); });
  const ex = $("#exportBtn");
  if (ex) ex.onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([Store.exportJson()], { type: "application/json" }));
    a.download = "wklase-backup-" + today() + ".json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const im = $("#importFile");
  if (im) im.onchange = () => {
    const f = im.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { Store.importJson(r.result); if (!Store.current()) Store.logout(); flash(t("imported")); } catch (e) { flash(t("badFile"), true); }
      render();
    };
    r.readAsText(f);
  };
}

document.addEventListener("click", () => document.querySelectorAll("[data-dd]").forEach(x => x.classList.remove("open")));
Store.onStatus = st => { const el = $("#syncStatus"); if (el) el.textContent = t("sync_" + st); };
Store.onChange = () => { if (!Store.current()) Store.logout(); render(); };
setInterval(() => {
  const a = document.activeElement;
  if (Store.ghEnabled && Store.current() && !(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) Store.pull({ force: true, notify: true });
}, 180000);
Store.init().then(render);
