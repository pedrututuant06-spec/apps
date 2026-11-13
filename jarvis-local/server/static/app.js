"use strict";
/* Jarvis Local — interface da família */

const $ = (s) => document.querySelector(s);
const state = {
  me: null, profiles: [], conversations: [], convId: null, messages: [],
  busy: false, controller: null, seated: false, hbTimer: null, pinTarget: null,
  section: "chat", engine: "jarvis", engines: [],
};
try { state.engine = localStorage.getItem("jarvis-engine") === "turbo" ? "turbo" : "jarvis"; } catch (_) {}
const ENGINE_LABEL = { jarvis: "🧠 Jarvis 1.0", turbo: "⚡ Jarvis Turbo 1.0", code: "</> Jarvis Code 1.0" };

const SUGGESTIONS = {
  adult: [
    "Escreva um e-mail profissional pedindo uma reunião",
    "Me explique um conceito difícil como se eu tivesse 12 anos",
    "Crie um plano de estudos de 4 semanas",
    "Revise e melhore este texto para mim",
  ],
  code: [
    "Crie um site simples em HTML e CSS para uma loja",
    "Explique este erro e como corrigir",
    "Escreva um script em Python que organize arquivos por tipo",
    "Me ensine o básico de JavaScript com exemplos",
  ],
  kid: [
    "Me explica por que o céu é azul?",
    "Me ajuda a entender frações?",
    "Conta uma história curtinha de aventura",
    "Me dá um desafio de matemática divertido",
  ],
};

// ---------------------------------------------------------------- utilidades
async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || (opts.body ? "POST" : "GET"),
    headers: opts.body ? { "Content-Type": "application/json" } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) {
    const err = new Error(data.error || "Erro " + res.status);
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}

function show(id) {
  for (const s of document.querySelectorAll(".screen")) s.classList.add("hidden");
  $(id).classList.remove("hidden");
}

function toast(text) {
  const t = $("#toast");
  t.textContent = text; t.classList.remove("hidden");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add("hidden"), 2200);
}

function esc(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function ordinal(n) { return n + "º"; }

function nameList(names) {
  if (!names.length) return "outra pessoa";
  if (names.length === 1) return names[0];
  return names.slice(0, -1).join(", ") + " e " + names[names.length - 1];
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast("Copiado!"); }
  catch (_) { prompt("Copie:", text); }
}

// ---------------------------------------------------------------- markdown seguro
function inline(s) {
  // s já está escapado
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

function markdown(src) {
  const parts = src.split(/```/);
  let html = "";
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      const nl = part.indexOf("\n");
      const code = nl >= 0 ? part.slice(nl + 1) : part;
      const lang = nl >= 0 ? part.slice(0, nl).trim().slice(0, 20) : "";
      html += '<div class="pre-wrap">' + (lang ? `<span class="lang">${esc(lang)}</span>` : "") +
        '<button class="copy-code" type="button">Copiar código</button><pre><code>' +
        esc(code.replace(/\n$/, "")) + "</code></pre></div>";
      return;
    }
    const lines = esc(part).split("\n");
    let list = null, para = [], table = [];
    const flushPara = () => { if (para.length) { html += "<p>" + inline(para.join("<br>")) + "</p>"; para = []; } };
    const flushList = () => { if (list) { html += `<${list.type}>` + list.items.map((x) => "<li>" + inline(x) + "</li>").join("") + `</${list.type}>`; list = null; } };
    const flushTable = () => {
      if (!table.length) return;
      const rows = table.filter((r) => !/^\s*\|?\s*:?-{2,}/.test(r));
      html += "<table>" + rows.map((r, idx) => {
        const cells = r.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|");
        const tag = idx === 0 ? "th" : "td";
        return "<tr>" + cells.map((c) => `<${tag}>${inline(c.trim())}</${tag}>`).join("") + "</tr>";
      }).join("") + "</table>";
      table = [];
    };
    for (const line of lines) {
      let m;
      if (/^\s*\|.*\|\s*$/.test(line)) { flushPara(); flushList(); table.push(line); continue; }
      flushTable();
      if ((m = line.match(/^(#{1,4})\s+(.*)/))) {
        flushPara(); flushList();
        const lvl = Math.min(4, m[1].length + 2);
        html += `<h${lvl}>${inline(m[2])}</h${lvl}>`;
      } else if ((m = line.match(/^\s*[-*•]\s+(.*)/))) {
        flushPara();
        if (!list || list.type !== "ul") { flushList(); list = { type: "ul", items: [] }; }
        list.items.push(m[1]);
      } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) {
        flushPara();
        if (!list || list.type !== "ol") { flushList(); list = { type: "ol", items: [] }; }
        list.items.push(m[1]);
      } else if ((m = line.match(/^&gt;\s?(.*)/))) {
        flushPara(); flushList();
        html += "<blockquote>" + inline(m[1]) + "</blockquote>";
      } else if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
        flushPara(); flushList(); html += "<hr>";
      } else if (!line.trim()) {
        flushPara(); flushList();
      } else {
        flushList(); para.push(line);
      }
    }
    flushPara(); flushList(); flushTable();
  });
  return html;
}

// ---------------------------------------------------------------- inicialização
async function boot() {
  try {
    const me = await api("/api/me");
    state.profiles = me.profiles;
    state.me = me.profile;
    state.engines = me.engines || [];
    if (!state.me) return showProfiles();
    enterChat();
  } catch (e) {
    if (e.status === 401) return show("#screen-code");
    document.body.innerHTML = '<div class="screen center"><div class="card narrow"><h2>Jarvis está desligado</h2><p class="muted">Abra o app Jarvis no Mac e tente de novo.</p><button class="btn primary" onclick="location.reload()">Tentar de novo</button></div></div>';
  }
}

$("#code-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  $("#code-error").textContent = "";
  try {
    await api("/api/login", { body: { code: $("#code-input").value } });
    boot();
  } catch (e) { $("#code-error").textContent = e.message; }
});

// ---------------------------------------------------------------- perfis
function avatarHTML(p) { return esc(p.emoji || "🙂"); }

function showProfiles() {
  stopHeartbeat();
  const grid = $("#profile-grid");
  grid.innerHTML = "";
  for (const p of state.profiles) {
    const b = document.createElement("button");
    b.className = "profile";
    b.innerHTML = `<div class="avatar" style="border-color:${esc(p.color)}">${avatarHTML(p)}</div>
      <b>${esc(p.name)}</b><small>${p.has_pin ? "🔒 protegido" : "criar senha"}${p.kid ? " · jovem" : ""}</small>`;
    b.onclick = () => pickProfile(p);
    grid.appendChild(b);
  }
  show("#screen-profiles");
}

function openPinModal(p, create) {
  state.pinTarget = p; state.pinCreate = create;
  $("#pin-avatar").innerHTML = avatarHTML(p);
  $("#pin-avatar").style.borderColor = p.color;
  $("#pin-title").textContent = create ? `Olá, ${p.name}! Crie sua senha` : `Senha de ${p.name}`;
  $("#pin-hint").textContent = create
    ? "É o primeiro acesso deste perfil. Escolha uma senha (mínimo 4 letras ou números) para que só você veja suas conversas."
    : "";
  $("#pin-confirm").classList.toggle("hidden", !create);
  $("#pin-input").value = ""; $("#pin-confirm").value = ""; $("#pin-error").textContent = "";
  $("#pin-modal").classList.remove("hidden");
  setTimeout(() => $("#pin-input").focus(), 50);
}

function pickProfile(p) { openPinModal(p, !p.has_pin); }

async function submitPin() {
  const p = state.pinTarget, pw = $("#pin-input").value;
  if (pw.length < 4) { $("#pin-error").textContent = "A senha precisa ter pelo menos 4 caracteres."; return; }
  const body = { id: p.id };
  if (state.pinCreate) {
    if (pw !== $("#pin-confirm").value) { $("#pin-error").textContent = "As senhas não são iguais."; return; }
    body.new_pin = pw;
  } else body.pin = pw;
  try {
    const r = await api("/api/profile/select", { body });
    $("#pin-modal").classList.add("hidden");
    state.me = r.profile;
    state.convId = null; state.messages = [];
    enterChat();
  } catch (e) {
    if (e.status === 428) return openPinModal(p, true);
    $("#pin-error").textContent = e.message;
  }
}

$("#pin-form").addEventListener("submit", (ev) => { ev.preventDefault(); submitPin(); });
$("#pin-cancel").onclick = () => $("#pin-modal").classList.add("hidden");

async function leaveProfile() {
  if (state.controller) state.controller.abort();
  try { await api("/api/profile/leave", { body: {} }); } catch (_) {}
  state.me = null;
  const me = await api("/api/me"); state.profiles = me.profiles;
  showProfiles();
}
$("#me-btn").onclick = leaveProfile;
$("#wait-leave").onclick = leaveProfile;

// ---------------------------------------------------------------- vagas (máx. 4 pessoas)
async function heartbeat() {
  try {
    const r = await api("/api/heartbeat", { body: {} });
    state.seated = r.seated;
    if (!r.seated) {
      $("#wait-text").innerHTML =
        `O Jarvis já está com <b>${r.max_users} pessoas</b> conectadas (${esc(nameList(r.online || []))}).<br>` +
        `Você é o(a) <b>${ordinal(r.position)} da fila</b> e entra automaticamente assim que uma vaga abrir.`;
      show("#screen-wait");
    } else if (!$("#screen-wait").classList.contains("hidden")) {
      show("#screen-chat"); toast("Sua vez! Pode conversar 😊");
    }
    updatePresence(r);
  } catch (e) {
    if (e.status === 403) return showProfiles();
    if (e.status === 401) return show("#screen-code");
  }
}

function updatePresence(r) {
  const others = (r.busy_with || []).filter((n) => n !== state.me?.name);
  let html;
  if (others.length && !state.busy) html = `<span class="dot busy"></span>respondendo ${esc(nameList(others))}`;
  else html = `<span class="dot"></span>${(r.online || []).length || 1} de ${r.max_users} online`;
  $("#presence").innerHTML = html;
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeat();
  state.hbTimer = setInterval(() => { if (document.visibilityState === "visible" || state.busy) heartbeat(); }, 10000);
}
function stopHeartbeat() { clearInterval(state.hbTimer); state.hbTimer = null; }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && state.me) heartbeat(); });

// ---------------------------------------------------------------- chat
function enterChat() {
  const p = state.me;
  $("#me-avatar").innerHTML = avatarHTML(p);
  $("#me-avatar").style.borderColor = p.color;
  $("#me-name").textContent = p.name;
  show("#screen-chat");
  startHeartbeat();
  newChat();
  loadConversations();
}

function renderSuggestions() {
  const p = state.me;
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const code = state.section === "code";
  $("#hello").textContent = code ? `Jarvis Code, ${p.name}. O que vamos programar?` : `${greet}, ${p.name}! Como posso ajudar?`;
  $("#hello-sub").textContent = code
    ? "Peça sites, scripts, apps, correções de erros ou explicações de código. Tudo roda no seu Mac."
    : "Pergunte qualquer coisa: textos, estudos, planos, ideias. Sem limites, 100% no seu Mac.";
  const box = $("#suggestions"); box.innerHTML = "";
  for (const s of SUGGESTIONS[code ? "code" : p.kid ? "kid" : "adult"]) {
    const b = document.createElement("button");
    b.textContent = s; b.onclick = () => send(s);
    box.appendChild(b);
  }
}

async function loadConversations() {
  try {
    const r = await api("/api/conversations");
    state.conversations = r.conversations;
    renderConvList();
  } catch (_) {}
}

function renderConvList() {
  const box = $("#conv-list"); box.innerHTML = "";
  const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()) / 1000;
  let group = null;
  const list = state.conversations.filter((c) => (c.kind || "chat") === state.section);
  for (const c of list) {
    const g = c.updated >= today ? "Hoje" : c.updated >= today - 86400 ? "Ontem" : c.updated >= today - 7 * 86400 ? "Últimos 7 dias" : "Mais antigas";
    if (g !== group) { group = g; const h = document.createElement("div"); h.className = "conv-group"; h.textContent = g; box.appendChild(h); }
    const d = document.createElement("div");
    d.className = "conv" + (c.id === state.convId ? " active" : "");
    d.innerHTML = `<span>${esc(c.title)}</span><button class="del" title="Apagar">🗑</button>`;
    d.onclick = () => openConversation(c.id);
    d.querySelector(".del").onclick = async (ev) => {
      ev.stopPropagation();
      if (!confirm("Apagar esta conversa?")) return;
      await api("/api/conversations/" + c.id, { method: "DELETE" });
      if (state.convId === c.id) newChat();
      loadConversations();
    };
    box.appendChild(d);
  }
  if (!list.length) box.innerHTML = '<p class="muted" style="padding:12px;font-size:.9rem">Suas conversas aparecem aqui. Só você vê as suas.</p>';
}

function newChat() {
  if (state.busy) return;
  state.convId = null; state.messages = [];
  renderMessages(); renderConvList(); closeSidebar();
  $("#input").focus();
}

async function openConversation(id) {
  if (state.busy) return toast("Espere a resposta terminar.");
  try {
    const c = await api("/api/conversations/" + id);
    state.convId = c.id; state.messages = c.messages;
    setSection(c.kind === "code" ? "code" : "chat", true);
    if (c.kind !== "code" && (c.engine === "turbo" || c.engine === "jarvis")) setEngine(c.engine);
    renderMessages(); renderConvList(); closeSidebar();
  } catch (e) { toast(e.message); }
}

function msgEl(m) {
  const d = document.createElement("div");
  d.className = "msg " + (m.role === "user" ? "user" : "bot");
  const av = m.role === "user"
    ? `<div class="avatar" style="border-color:${esc(state.me.color)}">${avatarHTML(state.me)}</div>`
    : `<div class="avatar"><img src="/favicon.png" alt=""></div>`;
  d.innerHTML = av + '<div class="bubble"></div>';
  const b = d.querySelector(".bubble");
  if (m.role === "user") b.textContent = m.content;
  else {
    b.innerHTML = markdown(m.content);
    if (m.stopped) b.insertAdjacentHTML("beforeend", '<div class="note">(resposta interrompida)</div>');
    addActions(b, m.content, m.engine ? { engine: m.engine } : null);
  }
  return d;
}

function addActions(bubble, text, engine) {
  const a = document.createElement("div");
  a.className = "msg-actions";
  a.innerHTML = '<button>📋 Copiar</button>' + (engine && ENGINE_LABEL[engine.engine]
    ? `<span class="engine">${esc(ENGINE_LABEL[engine.engine])}${engine.speed ? ` · ${engine.speed} palavras/s` : ""}</span>` : "");
  a.firstChild.onclick = () => copy(text);
  bubble.appendChild(a);
}

function renderMessages() {
  const box = $("#messages");
  box.querySelectorAll(".msg").forEach((n) => n.remove());
  $("#empty").classList.toggle("hidden", state.messages.length > 0);
  if (!state.messages.length) renderSuggestions();
  for (const m of state.messages) box.appendChild(msgEl(m));
  scrollDown(true);
}

function scrollDown(force) {
  const box = $("#messages");
  if (force || box.scrollHeight - box.scrollTop - box.clientHeight < 160) box.scrollTop = box.scrollHeight;
}

function setBusy(b) {
  state.busy = b;
  $("#send-btn").classList.toggle("hidden", b);
  $("#stop-btn").classList.toggle("hidden", !b);
}

function queueBanner(text) {
  const q = $("#queue-banner");
  if (!text) return q.classList.add("hidden");
  q.innerHTML = text; q.classList.remove("hidden");
}

async function send(text) {
  text = (text ?? $("#input").value).trim();
  if (!text || state.busy) return;
  $("#input").value = ""; autosize();
  $("#empty").classList.add("hidden");
  const userMsg = { role: "user", content: text };
  state.messages.push(userMsg);
  $("#messages").appendChild(msgEl(userMsg));

  const bot = document.createElement("div");
  bot.className = "msg bot";
  bot.innerHTML = '<div class="avatar"><img src="/favicon.png" alt=""></div><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>';
  $("#messages").appendChild(bot);
  const bubble = bot.querySelector(".bubble");
  scrollDown(true);

  setBusy(true);
  const controller = new AbortController();
  state.controller = controller;
  let answer = "", failed = null, frame = null, engine = null;
  const paint = () => { frame = null; bubble.innerHTML = markdown(answer); scrollDown(); };

  try {
    const res = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
      body: JSON.stringify({ conversation_id: state.convId, message: text,
        engine: state.section === "code" ? "code" : state.engine }), signal: controller.signal,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.error === "seats_full") { state.messages.pop(); bot.remove(); heartbeat(); throw new Error("Aguarde sua vez."); }
      if (res.status === 403) { showProfiles(); throw new Error("Escolha um perfil."); }
      throw new Error(data.error || "Erro " + res.status);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const raw = buf.slice(0, idx); buf = buf.slice(idx + 2);
        let ev = "message", data = "";
        for (const line of raw.split("\n")) {
          if (line.startsWith("event: ")) ev = line.slice(7);
          else if (line.startsWith("data: ")) data += line.slice(6);
        }
        if (!data) continue;
        const d = JSON.parse(data);
        if (ev === "conv") {
          if (!state.convId) { state.convId = d.id; loadConversations(); }
        } else if (ev === "queue") {
          const who = nameList(d.serving || []);
          queueBanner(`⏳ <b>Espere um momento</b> — o Jarvis está respondendo ${esc(who)}. ` +
            `Você é o(a) <b>${ordinal(d.position)} da fila</b>${d.position === 1 ? " e é o(a) próximo(a)!" : "."}`);
        } else if (ev === "engine") {
          engine = d;
        } else if (ev === "start") {
          queueBanner(null);
        } else if (ev === "token") {
          answer += d.t;
          if (!frame) frame = requestAnimationFrame(paint);
        } else if (ev === "done") {
          const st = d.stats || {};
          if (engine && st.eval_count && st.eval_duration) engine.speed = Math.round(st.eval_count / (st.eval_duration / 1e9));
        } else if (ev === "error") {
          failed = d.error;
        }
      }
    }
  } catch (e) {
    if (e.name !== "AbortError") failed = e.message;
  } finally {
    queueBanner(null);
    setBusy(false);
    state.controller = null;
    if (frame) cancelAnimationFrame(frame);
    if (answer) {
      const stopped = controller.signal.aborted;
      bubble.innerHTML = markdown(answer);
      if (stopped) bubble.insertAdjacentHTML("beforeend", '<div class="note">(resposta interrompida)</div>');
      addActions(bubble, answer, engine);
      state.messages.push({ role: "assistant", content: answer, stopped, engine: engine && engine.engine });
    } else if (failed) {
      bubble.innerHTML = `<div class="error">⚠️ ${esc(failed)}</div>`;
    } else if (controller.signal.aborted) {
      bubble.innerHTML = '<div class="note">(cancelado)</div>';
    } else if (bot.isConnected) {
      bubble.innerHTML = '<div class="note">(sem resposta)</div>';
    }
    if (failed && answer) bubble.insertAdjacentHTML("beforeend", `<div class="error">⚠️ ${esc(failed)}</div>`);
    scrollDown();
    loadConversations();
  }
}

function setSection(sec, keepConversation) {
  state.section = sec;
  document.body.classList.toggle("code-mode", sec === "code");
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.section === sec));
  $("#input").placeholder = sec === "code" ? "Descreva o que quer programar ou cole seu código/erro…" : "Escreva sua mensagem…";
  if (!keepConversation) newChat();
  renderConvList();
}
function setEngine(e) {
  state.engine = e;
  try { localStorage.setItem("jarvis-engine", e); } catch (_) {}
  document.querySelectorAll("#engine-pick button").forEach((b) => b.classList.toggle("active", b.dataset.engine === e));
}
document.querySelectorAll("#tabs button").forEach((b) => (b.onclick = () => {
  if (state.busy) return toast("Espere a resposta terminar.");
  setSection(b.dataset.section);
}));
document.querySelectorAll("#engine-pick button").forEach((b) => (b.onclick = () => setEngine(b.dataset.engine)));
setEngine(state.engine);
$("#messages").addEventListener("click", (ev) => {
  const btn = ev.target.closest(".copy-code");
  if (btn) copy(btn.parentElement.querySelector("code").textContent);
});

$("#composer").addEventListener("submit", (ev) => { ev.preventDefault(); send(); });
$("#stop-btn").onclick = () => state.controller && state.controller.abort();
$("#new-chat").onclick = newChat;

const input = $("#input");
function autosize() { input.style.height = "auto"; input.style.height = Math.min(200, input.scrollHeight) + "px"; }
input.addEventListener("input", autosize);
input.addEventListener("keydown", (ev) => {
  const mobile = matchMedia("(pointer: coarse)").matches;
  if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing && !mobile) { ev.preventDefault(); send(); }
});

// barra lateral no celular
function closeSidebar() { $("#sidebar").classList.remove("open"); $("#backdrop").classList.add("hidden"); }
$("#menu-btn").onclick = () => { $("#sidebar").classList.add("open"); $("#backdrop").classList.remove("hidden"); };
$("#backdrop").onclick = closeSidebar;

// ---------------------------------------------------------------- configurações
$("#settings-btn").onclick = openSettings;
$("#settings-close").onclick = () => $("#settings-modal").classList.add("hidden");

async function openSettings() {
  const s = await api("/api/settings");
  const p = s.profile;
  let html = `
  <section>
    <h3>Meu perfil</h3>
    <label>Nome</label><input id="st-name" type="text" maxlength="24" value="${esc(p.name)}">
    <label>Emoji / avatar</label><input id="st-emoji" type="text" maxlength="8" value="${esc(p.emoji)}">
    <label>Cor</label><input id="st-color" type="color" value="${esc(p.color)}" style="height:44px;padding:4px">
    <label>Nova senha (deixe vazio para manter a atual)</label>
    <input id="st-pin" type="password" maxlength="32" placeholder="••••••" autocomplete="new-password">
    <div class="row" style="margin-top:12px">
      <button class="btn primary" id="st-save">Salvar</button>
    </div>
  </section>`;

  if (p.admin) {
    html += `
    <section>
      <h3>Acesso da família</h3>
      <p class="muted">No Wi-Fi de casa (celulares, tablets, outros computadores):</p>
      ${(s.lan_links || []).map((l) => `<div class="copy-line"><code>${esc(l)}</code><button class="btn small" data-copy="${esc(l)}">Copiar</button></div>`).join("") || '<p class="muted">Desativado.</p>'}
      <p class="muted" style="margin-top:12px">Fora de casa (4G, casa de amigos):</p>
      ${s.public_link
        ? `<div class="copy-line"><code>${esc(s.public_link)}</code><button class="btn small" data-copy="${esc(s.public_link)}">Copiar</button></div>
           <p class="muted" style="font-size:.85rem">Esse link muda quando o Mac reinicia. Abra esta tela para pegar o novo.</p>`
        : '<p class="muted">Link externo desligado ou iniciando. Rode <code>jarvis link</code> no Terminal.</p>'}
      <label>Código da família (pedido em aparelhos novos)</label>
      <div class="copy-line"><code>${esc(s.family_code)}</code><button class="btn small" data-copy="${esc(s.family_code)}">Copiar</button>
      <button class="btn small danger" id="st-newcode">Trocar</button></div>
    </section>
    <section>
      <h3>Perfis da família</h3>
      ${s.profiles.map((q) => `
        <div class="prof-row" data-id="${esc(q.id)}">
          <input class="emoji" type="text" maxlength="8" value="${esc(q.emoji)}">
          <input type="text" maxlength="24" value="${esc(q.name)}">
          <label class="check"><input type="checkbox" ${q.kid ? "checked" : ""}> criança/jovem</label>
          ${q.has_pin && q.id !== p.id ? `<button class="btn small" data-clearpin="${esc(q.id)}">Redefinir senha</button>` : ""}
          <button class="btn small primary" data-saveprof="${esc(q.id)}">Salvar</button>
        </div>`).join("")}
      <p class="muted" style="font-size:.85rem">"Criança/jovem" deixa o Jarvis com linguagem simples e conteúdo adequado à idade. Se alguém esquecer a senha, use "Redefinir senha".</p>
    </section>
    <section>
      <h3>Motor de IA</h3>
      <p>Ollama: ${s.ollama ? "✅ funcionando" : "❌ desligado"}</p>
      <p class="muted" style="font-size:.9rem">Tudo roda no seu Mac, sem internet e sem depender de nenhuma empresa.</p>
      ${["jarvis", "turbo", "code"].map((k) => {
        const cur = s.models_cfg[k];
        const opts = Array.from(new Set([cur, ...s.models]));
        return `<label>${esc(s.engines[k].label)} — ${esc(s.engines[k].desc)}</label>
          <select class="st-model" data-engine="${k}">${opts.map((m) => `<option ${m === cur ? "selected" : ""}>${esc(m)}</option>`).join("")}</select>`;
      }).join("")}
      <label>Máximo de pessoas conectadas ao mesmo tempo</label>
      <input id="st-max" type="number" min="1" max="10" value="${s.max_users}">
      <div class="row" style="margin-top:12px"><button class="btn primary" id="st-engine">Salvar</button></div>
    </section>
    <section>
      <h3>Integração com o projeto Jarvis</h3>
      <p class="muted">API compatível com OpenAI. Use no projeto Jarvis no lugar do Gemini/Claude:</p>
      <label>Endereço base (no Mac)</label>
      <div class="copy-line"><code>http://localhost:8080/v1</code><button class="btn small" data-copy="http://localhost:8080/v1">Copiar</button></div>
      ${s.public_link ? `<label>Endereço base (de qualquer lugar)</label><div class="copy-line"><code>${esc(s.public_link)}/v1</code><button class="btn small" data-copy="${esc(s.public_link)}/v1">Copiar</button></div>` : ""}
      <label>Chave da API</label>
      <div class="copy-line"><code>${esc(s.api_key)}</code><button class="btn small" data-copy="${esc(s.api_key)}">Copiar</button>
      <button class="btn small danger" id="st-newkey">Trocar</button></div>
      <label>Modelos</label><p><code>jarvis</code> (1.0) · <code>jarvis-turbo</code> (rápido) · <code>jarvis-code</code> (programação)</p>
    </section>`;
  }
  html += `<section><p class="muted" style="font-size:.85rem">${Object.values(s.engine_labels || {}).map(esc).join(" · ")}<br>Tudo roda no seu Mac — independente, sem internet.</p></section>`;
  $("#settings-body").innerHTML = html;
  $("#settings-modal").classList.remove("hidden");

  const body = $("#settings-body");
  body.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => copy(b.dataset.copy)));
  $("#st-save").onclick = async () => {
    const payload = { name: $("#st-name").value, emoji: $("#st-emoji").value, color: $("#st-color").value };
    if ($("#st-pin").value) payload.pin = $("#st-pin").value;
    try { const r = await api("/api/settings/profile", { body: payload }); afterProfileChange(r.profile); toast("Salvo!"); }
    catch (e) { toast(e.message); }
  };
  if (!p.admin) return;

  body.querySelectorAll("[data-saveprof]").forEach((b) => (b.onclick = async () => {
    const row = b.closest(".prof-row");
    const [emoji, name] = row.querySelectorAll("input[type=text]");
    const kid = row.querySelector("input[type=checkbox]").checked;
    try {
      const r = await api("/api/settings/profile", { body: { id: row.dataset.id, name: name.value, emoji: emoji.value, kid } });
      if (r.profile.id === state.me.id) afterProfileChange(r.profile);
      toast("Perfil salvo!");
    } catch (e) { toast(e.message); }
  }));
  body.querySelectorAll("[data-clearpin]").forEach((b) => (b.onclick = async () => {
    if (!confirm("Redefinir a senha deste perfil? A pessoa vai criar uma nova no próximo acesso.")) return;
    await api("/api/settings/profile", { body: { id: b.dataset.clearpin, reset_pin: true } }); toast("Senha redefinida."); openSettings();
  }));
  $("#st-newcode").onclick = async () => {
    if (!confirm("Trocar o código? Todos os aparelhos fora deste Mac vão precisar do código novo.")) return;
    await api("/api/settings/admin", { body: { new_family_code: true } }); openSettings();
  };
  $("#st-newkey").onclick = async () => {
    if (!confirm("Trocar a chave da API? O projeto Jarvis vai precisar da chave nova.")) return;
    await api("/api/settings/admin", { body: { new_api_key: true } }); openSettings();
  };
  $("#st-engine").onclick = async () => {
    const models = {};
    body.querySelectorAll(".st-model").forEach((el) => (models[el.dataset.engine] = el.value));
    await api("/api/settings/admin", { body: { models, max_users: Number($("#st-max").value) } });
    toast("Salvo!");
  };
}

function afterProfileChange(p) {
  state.me = p;
  $("#me-avatar").innerHTML = avatarHTML(p);
  $("#me-avatar").style.borderColor = p.color;
  $("#me-name").textContent = p.name;
  if (!state.messages.length) renderSuggestions();
}

window.addEventListener("pagehide", () => { try { navigator.sendBeacon && stopHeartbeat(); } catch (_) {} });

boot();
