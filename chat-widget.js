/*!
 * Condo Super Live Chat Widget
 * AI-powered with seamless live chat escalation
 */
(function() {
  'use strict';

  const FB_URL        = 'https://condo-super-default-rtdb.firebaseio.com';
  const CHATBOT_URL   = 'https://us-central1-condo-super.cloudfunctions.net/chatbot';
  const BRAND         = { color: '#FF5722', navy: '#1a1a2e' };

  let mode         = 'ai';
  let sessionId    = null;
  let pollInterval = null;
  let lastMsgCount = 0;
  let isOpen       = false;
  let visitorName  = '';
  let visitorEmail = '';
  let aiHistory    = [];
  let step         = 'intro';

  function getSessionId() {
    let id = sessionStorage.getItem('cs_session');
    if (!id) { id = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2,9); sessionStorage.setItem('cs_session', id); }
    return id;
  }

  async function fbSet(path, data) { try { await fetch(`${FB_URL}/${path}.json`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }); } catch(e){} }
  async function fbPush(path, data) { try { await fetch(`${FB_URL}/${path}.json`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }); } catch(e){} }
  async function fbGet(path) { try { const r = await fetch(`${FB_URL}/${path}.json`); return r.ok ? await r.json() : null; } catch(e){ return null; } }

  function injectStyles() {
    document.head.insertAdjacentHTML('beforeend', `<style>
      #cs-bubble{position:fixed;bottom:24px;right:24px;z-index:99999;width:56px;height:56px;border-radius:50%;background:${BRAND.color};border:none;cursor:pointer;box-shadow:0 4px 20px rgba(255,87,34,.45);display:flex;align-items:center;justify-content:center;font-size:22px;transition:transform .2s,box-shadow .2s}
      #cs-bubble:hover{transform:scale(1.08);box-shadow:0 6px 28px rgba(255,87,34,.55)}
      #cs-badge{position:absolute;top:-4px;right:-4px;background:#16A34A;color:#fff;border-radius:99px;font-size:10px;font-weight:700;padding:2px 6px;border:2px solid #fff;display:none;font-family:sans-serif;line-height:1.4}
      #cs-win{position:fixed;bottom:92px;right:24px;z-index:99998;width:360px;height:540px;border-radius:20px;background:#fff;box-shadow:0 12px 48px rgba(0,0,0,.2);display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,'Inter',sans-serif;border:1px solid rgba(0,0,0,.08);animation:csUp .25s ease}
      @keyframes csUp{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}
      #cs-head{padding:14px 18px;display:flex;align-items:center;gap:10px;flex-shrink:0}
      .ai-mode{background:linear-gradient(135deg,${BRAND.navy},#2d2060)}
      .live-mode{background:${BRAND.navy}}
      .cs-av{width:38px;height:38px;border-radius:50%;background:${BRAND.color};display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
      .cs-hi{flex:1}.cs-hn{font-size:14px;font-weight:600;color:#fff}
      .cs-hs{font-size:11px;color:rgba(255,255,255,.6);display:flex;align-items:center;gap:4px;margin-top:2px}
      .cs-dot{width:6px;height:6px;border-radius:50%;background:#4ade80;animation:csPulse 2s infinite}
      @keyframes csPulse{0%,100%{opacity:1}50%{opacity:.4}}
      .cs-x{background:rgba(255,255,255,.1);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center}
      .cs-x:hover{background:rgba(255,255,255,.2)}
      #cs-body{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:#F8F8F5}
      #cs-body::-webkit-scrollbar{width:3px}
      #cs-body::-webkit-scrollbar-thumb{background:#ddd;border-radius:99px}
      .cs-msg{max-width:82%;display:flex;flex-direction:column;gap:3px}
      .cs-v{align-self:flex-end;align-items:flex-end}.cs-a{align-self:flex-start;align-items:flex-start}
      .cs-bbl{padding:9px 13px;border-radius:16px;font-size:13.5px;line-height:1.5;word-break:break-word}
      .cs-v .cs-bbl{background:${BRAND.color};color:#fff;border-bottom-right-radius:4px}
      .cs-a .cs-bbl{background:#fff;color:#1a1a2e;border:1px solid #EEEEEA;border-bottom-left-radius:4px}
      .cs-t{font-size:10px;color:#bbb;padding:0 3px}
      .cs-sys{text-align:center;font-size:11px;color:#bbb;padding:2px 0}
      .cs-typing{display:flex;align-items:center;gap:3px;padding:9px 13px;background:#fff;border:1px solid #EEEEEA;border-radius:16px;border-bottom-left-radius:4px;width:fit-content}
      .cs-typing span{width:5px;height:5px;border-radius:50%;background:#bbb;animation:csDot 1.2s infinite}
      .cs-typing span:nth-child(2){animation-delay:.2s}.cs-typing span:nth-child(3){animation-delay:.4s}
      @keyframes csDot{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}
      #cs-foot{padding:10px 14px;background:#fff;border-top:1px solid #EEEEEA;flex-shrink:0}
      .cs-hbar{display:flex;justify-content:center;margin-bottom:8px}
      .cs-hbtn{background:none;border:1px solid #E5E5DC;border-radius:99px;padding:5px 14px;font-size:12px;color:#888;cursor:pointer;font-family:inherit;transition:all .2s}
      .cs-hbtn:hover{border-color:${BRAND.color};color:${BRAND.color}}
      .cs-irow{display:flex;gap:8px;align-items:flex-end}
      #cs-inp{flex:1;border:1.5px solid #E5E5DC;border-radius:12px;padding:9px 13px;font-size:14px;outline:none;resize:none;font-family:inherit;max-height:90px;min-height:38px;transition:border .2s;line-height:1.5;color:#1a1a2e;background:#fff}
      #cs-inp:focus{border-color:${BRAND.color}}
      #cs-send{width:36px;height:36px;border-radius:9px;border:none;background:${BRAND.color};color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;transition:background .2s}
      #cs-send:hover{background:#E64A19}#cs-send:disabled{background:#ddd;cursor:not-allowed}
      #cs-intro{padding:20px;display:flex;flex-direction:column;gap:12px}
      .cs-ii{font-size:17px;font-weight:700;color:#1a1a2e}.cs-is{font-size:13px;color:#666;line-height:1.5;margin-top:-4px}
      .cs-in{padding:10px 13px;border:1.5px solid #E5E5DC;border-radius:10px;font-size:14px;outline:none;font-family:inherit;transition:border .2s;color:#1a1a2e;width:100%}
      .cs-in:focus{border-color:${BRAND.color}}
      .cs-sb{background:${BRAND.color};color:#fff;border:none;border-radius:10px;padding:11px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .2s;margin-top:2px;width:100%}
      .cs-sb:hover{background:#E64A19}
      .cs-ecard{background:#FFF3EE;border:1px solid #FFCCBC;border-radius:12px;padding:12px 14px;font-size:13px;color:#555;line-height:1.6;align-self:stretch;text-align:center}
      .cs-ecard b{color:${BRAND.color}}
      @media(max-width:400px){#cs-win{width:calc(100vw - 20px);right:10px;bottom:78px}#cs-bubble{right:10px}}
    </style>`);
  }

  function buildWidget() {
    document.body.insertAdjacentHTML('beforeend', `
      <button id="cs-bubble" onclick="window.__cs.toggle()">💬<span id="cs-badge"></span></button>
      <div id="cs-win">
        <div id="cs-head" class="ai-mode">
          <div class="cs-av">🤖</div>
          <div class="cs-hi">
            <div class="cs-hn">Condo Super AI Support</div>
            <div class="cs-hs"><span class="cs-dot"></span><span id="cs-st">AI-powered · instant answers</span></div>
          </div>
          <button class="cs-x" onclick="window.__cs.close()">✕</button>
        </div>
        <div id="cs-intro">
          <div class="cs-ii">👋 Hi there!</div>
          <div class="cs-is">Ask our AI anything about Condo Super — features, pricing, getting started. We'll connect you to a human if needed.</div>
          <input class="cs-in" id="cs-name" type="text" placeholder="Your name *"/>
          <input class="cs-in" id="cs-email" type="email" placeholder="Your email *"/>
          <input class="cs-in" id="cs-first" type="text" placeholder="What's your question?"/>
          <button class="cs-sb" onclick="window.__cs.start()">Start Chat →</button>
        </div>
        <div id="cs-body" style="display:none"></div>
        <div id="cs-foot" style="display:none">
          <div class="cs-hbar" id="cs-hbar">
            <button class="cs-hbtn" onclick="window.__cs.escalate('manual')">👤 Talk to a human instead</button>
          </div>
          <div class="cs-irow">
            <textarea id="cs-inp" rows="1" placeholder="Type a message..." onkeydown="window.__cs.key(event)"></textarea>
            <button id="cs-send" onclick="window.__cs.send()">➤</button>
          </div>
        </div>
      </div>
    `);
  }

  function toggle() { isOpen ? close() : open(); }
  function open() {
    isOpen = true;
    document.getElementById('cs-win').style.display = 'flex';
    document.getElementById('cs-badge').style.display = 'none';
    if (step === 'chat') { document.getElementById('cs-inp')?.focus(); scrollBottom(); }
    else setTimeout(() => document.getElementById('cs-name')?.focus(), 100);
  }
  function close() { isOpen = false; document.getElementById('cs-win').style.display = 'none'; }

  async function start() {
    const name  = document.getElementById('cs-name').value.trim();
    const email = document.getElementById('cs-email').value.trim();
    const first = document.getElementById('cs-first').value.trim();
    if (!name)  { hl('cs-name'); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { hl('cs-email'); return; }
    visitorName = name; visitorEmail = email; sessionId = getSessionId();
    document.getElementById('cs-intro').style.display = 'none';
    document.getElementById('cs-body').style.display  = 'flex';
    document.getElementById('cs-foot').style.display  = 'block';
    step = 'chat';
    addSys('Chat started · ' + now());
    if (first) await handleMsg(first);
    else addAgent("Hi " + name.split(' ')[0] + "! 👋 I'm Condo Super AI Support. Ask me anything about our app — features, pricing, getting started, and more!", true);
  }

  function send() { const i = document.getElementById('cs-inp'); const t = i?.value.trim(); if (!t) return; i.value = ''; handleMsg(t); }
  function key(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }

  async function handleMsg(text) {
    addVisitor(text);
    if (mode === 'live') { await liveMsg(text); return; }
    aiHistory.push({ role: 'user', content: text });
    const typ = showTyping();
    try {
      const res  = await fetch(CHATBOT_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ messages: aiHistory }) });
      const data = await res.json();
      removeTyping(typ);
      if (data.error) { addAgent("I'm having trouble right now. Let me connect you with our support team.", true); setTimeout(() => escalate('error'), 1500); return; }
      aiHistory.push({ role: 'assistant', content: data.reply });
      addAgent(data.reply, true);
      if (data.escalate) setTimeout(() => escalate('ai'), 1500);
    } catch(e) { removeTyping(typ); addAgent("I'm having connectivity issues. Let me connect you with our support team.", true); setTimeout(() => escalate('error'), 1500); }
  }

  async function escalate(reason) {
    if (mode === 'live') return;
    mode = 'live';
    document.getElementById('cs-head').className = 'live-mode';
    document.querySelector('.cs-av').textContent  = '🏢';
    document.querySelector('.cs-hn').textContent  = 'Condo Super Support';
    document.getElementById('cs-st').textContent  = 'Live support · connecting you now';
    document.getElementById('cs-hbar').style.display = 'none';
    addSys('── Connecting to support team ──');
    const msg = reason === 'manual'
      ? "You've requested to speak with our support team. We'll reply to your email at <b>" + esc(visitorEmail) + "</b> if you close this chat."
      : "I'll connect you with our support team who can help with this. We'll reply shortly.";
    body().insertAdjacentHTML('beforeend', `<div class="cs-ecard">🧑‍💼 ${msg}</div>`);
    scrollBottom();
    await fbSet(`chats/${sessionId}`, { visitorName, visitorEmail, page: window.location.href, startedAt: new Date().toISOString(), status: 'open', unreadByAgent: true, escalatedFrom: 'ai', escalateReason: reason });
    for (const m of aiHistory) {
      await fbPush(`chats/${sessionId}/messages`, { text: m.content, sender: m.role === 'user' ? 'visitor' : 'agent', senderName: m.role === 'user' ? visitorName : 'Condo Super AI', timestamp: new Date().toISOString(), isAiMessage: m.role === 'assistant' });
    }
    startPolling();
    addSys('Support team notified · we\'ll reply shortly');
  }

  async function liveMsg(text) {
    await fbPush(`chats/${sessionId}/messages`, { text, sender: 'visitor', senderName: visitorName, timestamp: new Date().toISOString() });
    await fbSet(`chats/${sessionId}/lastMessage`, { text, timestamp: new Date().toISOString() });
    await fbSet(`chats/${sessionId}/unreadByAgent`, true);
  }

  function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
      if (!sessionId) return;
      const msgs = await fbGet(`chats/${sessionId}/messages`);
      if (!msgs) return;
      const agentMsgs = Object.values(msgs).filter(m => m.sender === 'agent' && !m.isAiMessage);
      if (agentMsgs.length > lastMsgCount) {
        agentMsgs.slice(lastMsgCount).forEach(m => { addAgent(m.text, false); if (!isOpen) document.getElementById('cs-badge').style.display = 'block'; });
        lastMsgCount = agentMsgs.length;
      }
    }, 2000);
  }

  function addVisitor(t) { body().insertAdjacentHTML('beforeend', `<div class="cs-msg cs-v"><div class="cs-bbl">${esc(t)}</div><div class="cs-t">${now()}</div></div>`); scrollBottom(); }
  function addAgent(t, isAI) { body().insertAdjacentHTML('beforeend', `<div class="cs-msg cs-a"><div class="cs-bbl">${esc(t)}</div><div class="cs-t">${isAI ? 'AI Support' : 'Support'} · ${now()}</div></div>`); scrollBottom(); }
  function addSys(t) { body().insertAdjacentHTML('beforeend', `<div class="cs-sys">${esc(t)}</div>`); scrollBottom(); }
  function showTyping() { const el = document.createElement('div'); el.className = 'cs-msg cs-a'; el.innerHTML = '<div class="cs-typing"><span></span><span></span><span></span></div>'; body().appendChild(el); scrollBottom(); return el; }
  function removeTyping(el) { el?.remove(); }
  function body() { return document.getElementById('cs-body'); }
  function scrollBottom() { const b = body(); if (b) setTimeout(() => b.scrollTop = b.scrollHeight, 50); }
  function now() { return new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }); }
  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'); }
  function hl(id) { const el = document.getElementById(id); if (!el) return; el.style.borderColor = '#DC2626'; el.focus(); setTimeout(() => el.style.borderColor = '#E5E5DC', 3000); }

  window.__cs = { toggle, open, close, start, send, key, escalate };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', () => { injectStyles(); buildWidget(); }) : (injectStyles(), buildWidget());
})();
