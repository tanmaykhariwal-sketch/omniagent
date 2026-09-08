import { useRef, useState } from 'react';
import { sendChat, logout } from './api.js';

const QUICK_ACTIONS = [
  { label: 'Summarize', key: '1', prefill: 'Summarize the following:\n\n' },
  { label: 'Explain code', key: '2', prefill: 'Explain what this code does:\n\n' },
  { label: 'Draft email', key: '3', prefill: 'Draft a professional email about:\n\n' },
];

function Ticks({ stage }) {
  // stage: 1 = sent, 2 = routed, 3 = answered
  return (
    <span className="ticks" aria-label={`status: ${stage === 1 ? 'sent' : stage === 2 ? 'routed' : 'answered'}`}>
      <span className={stage >= 1 ? 'lit' : ''} />
      <span className={stage >= 2 ? 'lit' : ''} />
      <span className={stage >= 3 ? 'lit' : ''} />
    </span>
  );
}

export default function ChatPage({ onLoggedOut }) {
  const [input, setInput] = useState('');
  const [rows, setRows] = useState([]);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef(null);

  function prefill(text) {
    setInput(text);
    textareaRef.current?.focus();
  }

  async function submit(e) {
    e.preventDefault();
    const prompt = input.trim();
    if (!prompt || sending) return;

    const id = crypto.randomUUID();
    setInput('');
    setSending(true);
    setRows((r) => [...r, { id, role: 'you', text: prompt }, { id: `${id}-status`, role: 'status', stage: 1 }]);

    setTimeout(() => {
      setRows((r) => r.map((row) => (row.id === `${id}-status` ? { ...row, stage: 2 } : row)));
    }, 220);

    try {
      const { response } = await sendChat(prompt);
      setRows((r) =>
        r.map((row) => (row.id === `${id}-status` ? { id: row.id, role: 'omni', text: response } : row))
      );
    } catch (err) {
      setRows((r) =>
        r.map((row) => (row.id === `${id}-status` ? { id: row.id, role: 'error', text: err.message } : row))
      );
    } finally {
      setSending(false);
    }
  }

  async function handleLogout() {
    await logout();
    onLoggedOut();
  }

  return (
    <div className="screen">
      <div className="palette-shell">
        <div className="palette-topbar">
          <p className="wordmark">OmniAgent</p>
          <button className="icon-btn" onClick={handleLogout}>
            Sign out
          </button>
        </div>

        <div className="palette">
          <form className="palette-input-row" onSubmit={submit}>
            <span className="prompt-caret">›</span>
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="Ask OmniAgent…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit(e);
                }
              }}
            />
            <button className="send-btn" type="submit" disabled={sending || !input.trim()}>
              Send
            </button>
          </form>

          <div className="quick-row">
            {QUICK_ACTIONS.map((qa) => (
              <button key={qa.label} className="chip" type="button" onClick={() => prefill(qa.prefill)}>
                {qa.label}
                <kbd>⌥{qa.key}</kbd>
              </button>
            ))}
          </div>

          <div className="log">
            {rows.length === 0 && (
              <div className="log-empty">Type a message, or pick a quick action above.</div>
            )}
            {rows.map((row) => {
              if (row.role === 'status') {
                return (
                  <div className="row omni" key={row.id}>
                    <div className="row-meta">
                      <span className="row-who">OmniAgent</span>
                      <Ticks stage={row.stage} />
                    </div>
                  </div>
                );
              }
              return (
                <div className={`row ${row.role}`} key={row.id}>
                  <div className="row-meta">
                    <span className="row-who">{row.role === 'you' ? 'You' : 'OmniAgent'}</span>
                  </div>
                  <p className="row-text">{row.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
