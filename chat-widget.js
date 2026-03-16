/*!
 * Condo Super Live Chat Widget
 * Powered by Firebase Realtime Database
 * Drop this script on any page to enable live chat
 */
(function() {
  'use strict';

  // ─── CONFIG ────────────────────────────────────────────────────────────────
  const FB_URL = 'https://condo-super-app-web-default-rtdb.firebaseio.com'; // Firebase Realtime DB URL
  const BRAND  = { name: 'Condo Super', color: '#FF5722', navy: '#1a1a2e' };

  // ─── STATE ─────────────────────────────────────────────────────────────────
  let sessionId    = null;
  let pollInterval = null;
  let lastMsgCount = 0;
  let isOpen       = false;
  let visitorName  = '';
  let visitorEmail = '';
  let step         = 'intro'; // intro → chat

  // ─── SESSION ID ────────────────────────────────────────────────────────────
  function getSessionId() {
    let id = sessionStorage.getItem('cs_chat_session');
    if (!id) {
      id = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('cs_chat_session', id);
    }
    return id;
  }

  // ─── FIREBASE HELPERS ──────────────────────────────────────────────────────
  async function fbPush(path, data) {
    try {
      const res = await fetch(`${FB_URL}/${path}.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.ok;
    } catch(e) { return false; }
  }

  async function fbSet(path, data) {
    try {
      await fetch(`${FB_URL}/${path}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch(e) {}
  }

  async function fbGet(path) {
    try {
      const res = await fetch(`${FB_URL}/${path}.json`);
      return res.ok ? await res.json() : null;
    } catch(e) { return null; }
  }

  // ─── STYLES ────────────────────────────────────────────────────────────────
  function injectStyles() {
    const css = `
      #cs-chat-bubble {
        position: fixed; bottom: 24px; right: 24px; z-index: 99999;
        width: 56px; height: 56px; border-radius: 50%;
        background: ${BRAND.color}; border: none; cursor: pointer;
        box-shadow: 0 4px 20px rgba(255,87,34,.45);
        display: flex; align-items: center; justify-content: center;
        transition: transform .2s, box-shadow .2s;
        font-size: 24px;
      }
      #cs-chat-bubble:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(255,87,34,.55); }
      #cs-chat-bubble .cs-badge {
        position: absolute; top: -4px; right: -4px;
        background: #16A34A; color: #fff; border-radius: 99px;
        font-size: 10px; font-weight: 700; padding: 2px 6px;
        font-family: -apple-system, sans-serif; line-height: 1.4;
        border: 2px solid #fff; display: none;
      }
      #cs-chat-window {
        position: fixed; bottom: 92px; right: 24px; z-index: 99998;
        width: 360px; height: 520px; border-radius: 20px;
        background: #fff; box-shadow: 0 12px 48px rgba(0,0,0,.2);
        display: none; flex-direction: column; overflow: hidden;
        font-family: -apple-system, 'Inter', sans-serif;
        border: 1px solid rgba(0,0,0,.08);
        animation: csSlideUp .25s ease;
      }
      @keyframes csSlideUp {
        from { opacity: 0; transform: translateY(16px) scale(.97); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      #cs-chat-header {
        background: ${BRAND.navy}; padding: 16px 20px;
        display: flex; align-items: center; gap: 12px; flex-shrink: 0;
      }
      .cs-avatar {
        width: 40px; height: 40px; border-radius: 50%;
        background: ${BRAND.color}; display: flex; align-items: center;
        justify-content: center; font-size: 18px; flex-shrink: 0;
      }
      .cs-header-info { flex: 1; }
      .cs-header-name { font-size: 15px; font-weight: 600; color: #fff; }
      .cs-header-status { font-size: 12px; color: rgba(255,255,255,.6); display: flex; align-items: center; gap: 5px; margin-top: 2px; }
      .cs-status-dot { width: 7px; height: 7px; border-radius: 50%; background: #4ade80; animation: csPulse 2s infinite; }
      @keyframes csPulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      .cs-close-btn {
        background: rgba(255,255,255,.1); border: none; color: #fff;
        width: 30px; height: 30px; border-radius: 50%; cursor: pointer;
        font-size: 16px; display: flex; align-items: center; justify-content: center;
        transition: background .2s;
      }
      .cs-close-btn:hover { background: rgba(255,255,255,.2); }
      #cs-chat-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; background: #F8F8F5; }
      #cs-chat-body::-webkit-scrollbar { width: 4px; }
      #cs-chat-body::-webkit-scrollbar-track { background: transparent; }
      #cs-chat-body::-webkit-scrollbar-thumb { background: #ddd; border-radius: 99px; }
      .cs-msg { max-width: 80%; display: flex; flex-direction: column; gap: 3px; }
      .cs-msg.cs-msg-visitor { align-self: flex-end; align-items: flex-end; }
      .cs-msg.cs-msg-agent   { align-self: flex-start; align-items: flex-start; }
      .cs-msg-bubble {
        padding: 9px 14px; border-radius: 16px; font-size: 14px; line-height: 1.5;
        word-break: break-word;
      }
      .cs-msg-visitor .cs-msg-bubble { background: ${BRAND.color}; color: #fff; border-bottom-right-radius: 4px; }
      .cs-msg-agent   .cs-msg-bubble { background: #fff; color: #1a1a2e; border: 1px solid #EEEEEA; border-bottom-left-radius: 4px; }
      .cs-msg-time { font-size: 10px; color: #aaa; padding: 0 4px; }
      .cs-system-msg { text-align: center; font-size: 12px; color: #aaa; padding: 4px 0; }
      .cs-typing { display: flex; align-items: center; gap: 4px; padding: 10px 14px; background: #fff; border: 1px solid #EEEEEA; border-radius: 16px; border-bottom-left-radius: 4px; width: fit-content; }
      .cs-typing span { width: 6px; height: 6px; border-radius: 50%; background: #bbb; animation: csTyping 1.2s infinite; }
      .cs-typing span:nth-child(2) { animation-delay: .2s; }
      .cs-typing span:nth-child(3) { animation-delay: .4s; }
      @keyframes csTyping { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
      #cs-chat-footer {
        padding: 12px 16px; background: #fff; border-top: 1px solid #EEEEEA;
        display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0;
      }
      #cs-chat-input {
        flex: 1; border: 1.5px solid #E5E5DC; border-radius: 12px;
        padding: 10px 14px; font-size: 14px; outline: none; resize: none;
        font-family: inherit; max-height: 100px; min-height: 40px;
        transition: border .2s; line-height: 1.5; background: #fff; color: #1a1a2e;
      }
      #cs-chat-input:focus { border-color: ${BRAND.color}; }
      #cs-send-btn {
        width: 38px; height: 38px; border-radius: 10px; border: none;
        background: ${BRAND.color}; color: #fff; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0; transition: background .2s; font-size: 16px;
      }
      #cs-send-btn:hover { background: #E64A19; }
      #cs-send-btn:disabled { background: #ccc; cursor: not-allowed; }
      /* INTRO FORM */
      #cs-intro { padding: 24px 20px; display: flex; flex-direction: column; gap: 14px; }
      .cs-intro-title { font-size: 18px; font-weight: 700; color: #1a1a2e; }
      .cs-intro-sub { font-size: 14px; color: #666; line-height: 1.5; margin-top: -6px; }
      .cs-intro-input {
        padding: 11px 14px; border: 1.5px solid #E5E5DC; border-radius: 10px;
        font-size: 14px; outline: none; font-family: inherit; transition: border .2s;
        color: #1a1a2e; background: #fff;
      }
      .cs-intro-input:focus { border-color: ${BRAND.color}; }
      .cs-start-btn {
        background: ${BRAND.color}; color: #fff; border: none; border-radius: 10px;
        padding: 12px; font-size: 15px; font-weight: 600; cursor: pointer;
        font-family: inherit; transition: background .2s; margin-top: 4px;
      }
      .cs-start-btn:hover { background: #E64A19; }
      @media(max-width: 400px) {
        #cs-chat-window { width: calc(100vw - 24px); right: 12px; bottom: 80px; }
        #cs-chat-bubble { right: 12px; }
      }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── BUILD HTML ────────────────────────────────────────────────────────────
  function buildWidget() {
    // Bubble
    const bubble = document.createElement('button');
    bubble.id = 'cs-chat-bubble';
    bubble.innerHTML = `<span style="font-size:22px">💬</span><span class="cs-badge" id="cs-notif-badge">1</span>`;
    bubble.onclick = toggleChat;
    document.body.appendChild(bubble);

    // Window
    const win = document.createElement('div');
    win.id = 'cs-chat-window';
    win.innerHTML = `
      <div id="cs-chat-header">
        <div class="cs-avatar">🏢</div>
        <div class="cs-header-info">
          <div class="cs-header-name">Condo Super Support</div>
          <div class="cs-header-status"><span class="cs-status-dot"></span>We typically reply within a few minutes</div>
        </div>
        <button class="cs-close-btn" onclick="window.__csChat.close()">✕</button>
      </div>
      <div id="cs-intro">
        <div class="cs-intro-title">👋 Hi there!</div>
        <div class="cs-intro-sub">Start a conversation — we're here to help with anything about Condo Super.</div>
        <input class="cs-intro-input" id="cs-visitor-name" type="text" placeholder="Your name *" />
        <input class="cs-intro-input" id="cs-visitor-email" type="email" placeholder="Your email *" />
        <input class="cs-intro-input" id="cs-first-msg" type="text" placeholder="How can we help you?" />
        <button class="cs-start-btn" onclick="window.__csChat.startChat()">Start Chat →</button>
      </div>
      <div id="cs-chat-body" style="display:none"></div>
      <div id="cs-chat-footer" style="display:none">
        <textarea id="cs-chat-input" rows="1" placeholder="Type a message..." onkeydown="window.__csChat.handleKey(event)"></textarea>
        <button id="cs-send-btn" onclick="window.__csChat.send()">➤</button>
      </div>
    `;
    document.body.appendChild(win);
  }

  // ─── CHAT FUNCTIONS ────────────────────────────────────────────────────────
  function toggleChat() {
    isOpen ? closeChat() : openChat();
  }

  function openChat() {
    isOpen = true;
    document.getElementById('cs-chat-window').style.display = 'flex';
    document.getElementById('cs-notif-badge').style.display = 'none';
    if (step === 'chat') {
      document.getElementById('cs-chat-input').focus();
      scrollToBottom();
    } else {
      setTimeout(() => document.getElementById('cs-visitor-name')?.focus(), 100);
    }
  }

  function closeChat() {
    isOpen = false;
    document.getElementById('cs-chat-window').style.display = 'none';
  }

  async function startChat() {
    const name  = document.getElementById('cs-visitor-name').value.trim();
    const email = document.getElementById('cs-visitor-email').value.trim();
    const msg   = document.getElementById('cs-first-msg').value.trim();

    if (!name)  { highlight('cs-visitor-name'); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { highlight('cs-visitor-email'); return; }

    visitorName  = name;
    visitorEmail = email;
    sessionId    = getSessionId();

    // Create session in Firebase
    await fbSet(`chats/${sessionId}`, {
      visitorName, visitorEmail,
      page: window.location.href,
      startedAt: new Date().toISOString(),
      status: 'open',
      unreadByAgent: true,
    });

    // Switch to chat view
    document.getElementById('cs-intro').style.display        = 'none';
    document.getElementById('cs-chat-body').style.display    = 'flex';
    document.getElementById('cs-chat-footer').style.display  = 'flex';
    step = 'chat';

    // Add welcome system message
    addSystemMsg('Chat started • ' + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));

    // Send first message if provided
    if (msg) {
      await sendMessage(msg);
    } else {
      addAgentMsg("Hi " + name.split(' ')[0] + "! 👋 How can we help you today?", 'Condo Super');
    }

    startPolling();
    document.getElementById('cs-chat-input').focus();
  }

  async function sendMessage(text) {
    if (!text.trim() || !sessionId) return;
    const input = document.getElementById('cs-chat-input');
    if (input) input.value = '';

    const msg = {
      text: text.trim(),
      sender: 'visitor',
      senderName: visitorName,
      timestamp: new Date().toISOString(),
    };

    addVisitorMsg(text.trim());
    await fbPush(`chats/${sessionId}/messages`, msg);
    await fbSet(`chats/${sessionId}/lastMessage`, { text: text.trim(), timestamp: msg.timestamp });
    await fbSet(`chats/${sessionId}/unreadByAgent`, true);
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      window.__csChat.send();
    }
  }

  function send() {
    const input = document.getElementById('cs-chat-input');
    if (input && input.value.trim()) sendMessage(input.value.trim());
  }

  // ─── POLLING FOR AGENT REPLIES ─────────────────────────────────────────────
  function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
      if (!sessionId) return;
      const msgs = await fbGet(`chats/${sessionId}/messages`);
      if (!msgs) return;
      const all = Object.values(msgs);
      if (all.length > lastMsgCount) {
        const newMsgs = all.slice(lastMsgCount);
        newMsgs.forEach(m => {
          if (m.sender === 'agent') {
            addAgentMsg(m.text, m.senderName || 'Support');
            if (!isOpen) showNotification();
          }
        });
        lastMsgCount = all.length;
      }
    }, 2000); // Poll every 2 seconds
  }

  // ─── UI HELPERS ────────────────────────────────────────────────────────────
  function addVisitorMsg(text) {
    const body = document.getElementById('cs-chat-body');
    const time = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    const el = document.createElement('div');
    el.className = 'cs-msg cs-msg-visitor';
    el.innerHTML = `<div class="cs-msg-bubble">${escHtml(text)}</div><div class="cs-msg-time">${time}</div>`;
    body.appendChild(el);
    scrollToBottom();
    lastMsgCount++;
  }

  function addAgentMsg(text, name) {
    const body = document.getElementById('cs-chat-body');
    const time = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    const el = document.createElement('div');
    el.className = 'cs-msg cs-msg-agent';
    el.innerHTML = `<div class="cs-msg-bubble">${escHtml(text)}</div><div class="cs-msg-time">${name} · ${time}</div>`;
    body.appendChild(el);
    scrollToBottom();
  }

  function addSystemMsg(text) {
    const body = document.getElementById('cs-chat-body');
    const el = document.createElement('div');
    el.className = 'cs-system-msg';
    el.textContent = text;
    body.appendChild(el);
  }

  function scrollToBottom() {
    const body = document.getElementById('cs-chat-body');
    if (body) setTimeout(() => body.scrollTop = body.scrollHeight, 50);
  }

  function showNotification() {
    const badge = document.getElementById('cs-notif-badge');
    if (badge) badge.style.display = 'block';
  }

  function highlight(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.borderColor = '#DC2626';
    el.focus();
    setTimeout(() => el.style.borderColor = '#E5E5DC', 3000);
  }

  function escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ─── PUBLIC API ────────────────────────────────────────────────────────────
  window.__csChat = { open: openChat, close: closeChat, startChat, send, handleKey };

  // ─── INIT ──────────────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    buildWidget();
    // Restore existing session
    const existing = sessionStorage.getItem('cs_chat_session');
    if (existing) {
      sessionId = existing;
      // Could restore chat history here if needed
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
