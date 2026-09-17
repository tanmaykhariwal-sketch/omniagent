import { useEffect, useRef, useState } from 'react';
import { sendChat, generateImage, transcribeAudio, getQuote, searchNews, getHistory, analyzeFile, getPinned, togglePin } from './api.js';
import { speak, isSpeechSynthesisSupported, AudioRecorder, isRecordingSupported } from './speech.js';
import { initTheme, applyTheme } from './theme.js';

const QUICK_ACTIONS = [
  { label: 'Summarize', prefill: 'Summarize the following:\n\n' },
  { label: 'Explain code', prefill: 'Explain what this code does:\n\n' },
  { label: 'Draft email', prefill: 'Draft a professional email about:\n\n' },
];

const MODE_ACTIONS = [
  { mode: 'image', label: 'Image' },
  { mode: 'finance', label: 'Finance' },
  { mode: 'news', label: 'News' },
];

const PERSONAS = [
  { id: 'professional', label: 'Professional' },
  { id: 'casual', label: 'Casual' },
  { id: 'creative', label: 'Creative' },
  { id: 'technical', label: 'Technical' },
];

const STARTER_PROMPTS = [
  { emoji: '💡', label: 'Explain a concept', mode: 'chat', text: 'Explain quantum computing in simple terms' },
  { emoji: '🧑‍💻', label: 'Debug some code', mode: 'chat', text: 'Explain what this code does:\n\n' },
  { emoji: '✍️', label: 'Draft an email', mode: 'chat', text: 'Draft a professional email about:\n\n' },
  { emoji: '🎨', label: 'Generate an image', mode: 'image', text: 'A cozy cabin in a snowy forest, warm light in the windows' },
  { emoji: '📈', label: 'Check a stock', mode: 'finance', text: 'AAPL' },
  { emoji: '📰', label: "Today's news", mode: 'news', text: 'technology' },
];

const MODE_PLACEHOLDERS = {
  chat: 'Message OmniAgent…',
  image: 'Describe an image to generate…',
  finance: 'Enter a stock symbol, e.g. AAPL…',
  news: 'Search a news topic…',
};

// Caps how much chat history we keep in memory. Without this, a long-running
// session (especially one with generated images held as base64 data URLs)
// grows the `rows` array and re-render cost without bound.
const MAX_ROWS = 200;

function appendRows(rows, ...newRows) {
  const next = [...rows, ...newRows];
  return next.length > MAX_ROWS ? next.slice(next.length - MAX_ROWS) : next;
}

function TypingDots() {
  return (
    <span className="typing-dots" aria-label="OmniAgent is responding">
      <span />
      <span />
      <span />
    </span>
  );
}

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4.5 5.5 10a2 2 0 1 0 2.8 2.8L14 7.1a3.5 3.5 0 1 0-5-5L3.5 7.6a5 5 0 1 0 7.1 7.1" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <rect x="5.5" y="1.5" width="5" height="8" rx="2.5" />
      <path d="M3 8a5 5 0 0 0 10 0" />
      <path d="M8 13v1.5" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 13V3" />
      <path d="M3.5 7.5 8 3l4.5 4.5" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6.5h2.5L8 3.5v9L4.5 9.5H2z" />
      <path d="M10.5 5.5a3.2 3.2 0 0 1 0 5" />
      <path d="M12.3 3.8a5.8 5.8 0 0 1 0 8.4" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M3 10.5V3.5a1 1 0 0 1 1-1H10" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5l3 3 7-7" />
    </svg>
  );
}

function RegenerateIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 8A5.5 5.5 0 1 1 11.8 4" />
      <path d="M13.5 2.5v3.5H10" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12.5" cy="3.5" r="1.8" />
      <circle cx="3.5" cy="8" r="1.8" />
      <circle cx="12.5" cy="12.5" r="1.8" />
      <path d="M5.1 7.1l5.8-3.2M5.1 8.9l5.8 3.2" />
    </svg>
  );
}

function PinIcon({ filled }) {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2h4l-.5 4.5L11 8.5H5L6.5 6.5 6 2z" />
      <path d="M8 8.5V14" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.5M8 13v1.5M2.6 2.6l1 1M12.4 12.4l1 1M1.5 8h1.5M13 8h1.5M2.6 13.4l1-1M12.4 3.6l1-1" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor">
      <path d="M13.5 9.5A5.75 5.75 0 0 1 6.5 2.5a.5.5 0 0 0-.7-.55A6.25 6.25 0 1 0 14.05 10.2a.5.5 0 0 0-.55-.7z" />
    </svg>
  );
}

function QuoteCard({ quote }) {
  const up = typeof quote.change === 'number' && quote.change >= 0;
  const changeText =
    typeof quote.change === 'number' && typeof quote.changePercent === 'number'
      ? `${up ? '+' : ''}${quote.change.toFixed(2)} (${up ? '+' : ''}${quote.changePercent.toFixed(2)}%)`
      : null;
  return (
    <div className="quote-card">
      <div className="quote-head">
        <span className="quote-symbol">{quote.symbol}</span>
        <span className="quote-name">{quote.name}</span>
      </div>
      <div className="quote-price-row">
        <span className="quote-price">
          {typeof quote.price === 'number' ? quote.price.toFixed(2) : '—'} {quote.currency}
        </span>
        {changeText && <span className={`quote-change ${up ? 'up' : 'down'}`}>{changeText}</span>}
      </div>
      {quote.exchange && <div className="quote-exchange">{quote.exchange}</div>}
    </div>
  );
}

function isSafeHttpUrl(url) {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

function NewsList({ headlines }) {
  if (headlines.length === 0) return <p className="message-text">No headlines found.</p>;
  return (
    <ul className="news-list">
      {headlines.map((h) => (
        <li key={h.link || h.headline} className="news-item">
          {isSafeHttpUrl(h.link) ? (
            <a href={h.link} target="_blank" rel="noreferrer">
              {h.headline}
            </a>
          ) : (
            <span>{h.headline}</span>
          )}
          {h.source && <span className="news-source">{h.source}</span>}
        </li>
      ))}
    </ul>
  );
}

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [rows, setRows] = useState([]);
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState('chat');
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [theme, setTheme] = useState('light');
  const [copiedId, setCopiedId] = useState(null);
  const [sharedId, setSharedId] = useState(null);
  const [regeneratingId, setRegeneratingId] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [persona, setPersona] = useState(null);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [pinnedItems, setPinnedItems] = useState([]);
  const [pinnedLoading, setPinnedLoading] = useState(false);
  const textareaRef = useRef(null);
  const recorderRef = useRef(null);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setTheme(initTheme());
  }, []);

  useEffect(() => {
    getHistory()
      .then(({ history }) => {
        if (history.length === 0) return;
        const restored = history.flatMap((h) => [
          { id: crypto.randomUUID(), role: 'you', text: h.prompt },
          { id: crypto.randomUUID(), role: 'omni', text: h.response, queryId: h.id, pinned: !!h.pinned, prompt: h.prompt },
        ]);
        setRows((r) => (r.length === 0 ? restored : r));
      })
      .catch(() => {
        // history is a nice-to-have restore, not essential -- starting
        // with an empty chat is a fine fallback if this fails
      });
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [rows]);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop().catch(() => {});
    };
  }, []);

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    applyTheme(next);
  }

  async function copyText(id, text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500);
    } catch {
      // clipboard access denied/unsupported -- text is still selectable manually
    }
  }

  async function shareText(id, text) {
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (err) {
        // the user cancelling the OS share sheet is not a failure -- don't
        // fall through to a clipboard copy they didn't ask for
        if (err.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setSharedId(id);
      setTimeout(() => setSharedId((current) => (current === id ? null : current)), 1500);
    } catch {
      // clipboard access denied/unsupported -- nothing more we can do
    }
  }

  async function regenerateAnswer(row) {
    if (!row.prompt || sending || regeneratingId) return;
    setRegeneratingId(row.id);
    try {
      const { response, suggestions, queryId } = await sendChat(row.prompt, persona);
      setRows((r) =>
        r.map((x) => (x.id === row.id ? { ...x, text: response, suggestions, queryId, pinned: false } : x))
      );
    } catch (err) {
      setRows((r) =>
        r.map((x) => (x.id === row.id ? { id: x.id, role: 'error', text: err.message, prompt: row.prompt } : x))
      );
    } finally {
      setRegeneratingId(null);
    }
  }

  function prefill(text) {
    setMode('chat');
    setInput(text);
    textareaRef.current?.focus();
  }

  function chooseStarter(starter) {
    setMode(starter.mode);
    setInput(starter.text);
    textareaRef.current?.focus();
  }

  function toggleMode(target) {
    setMode((m) => (m === target ? 'chat' : target));
    textareaRef.current?.focus();
  }

  function togglePersona(id) {
    setPersona((p) => (p === id ? null : id));
    textareaRef.current?.focus();
  }

  async function handleTogglePin(row) {
    if (!row.queryId) return;
    const nextPinned = !row.pinned;
    setRows((r) => r.map((x) => (x.id === row.id ? { ...x, pinned: nextPinned } : x)));
    try {
      await togglePin(row.queryId, nextPinned);
    } catch {
      setRows((r) => r.map((x) => (x.id === row.id ? { ...x, pinned: !nextPinned } : x)));
    }
  }

  async function openPinned() {
    setPinnedOpen(true);
    setPinnedLoading(true);
    try {
      const { pinned } = await getPinned();
      setPinnedItems(pinned);
    } catch {
      setPinnedItems([]);
    } finally {
      setPinnedLoading(false);
    }
  }

  async function unpinFromPanel(queryId) {
    setPinnedItems((items) => items.filter((it) => it.id !== queryId));
    setRows((r) => r.map((x) => (x.queryId === queryId ? { ...x, pinned: false } : x)));
    try {
      await togglePin(queryId, false);
    } catch {
      // best-effort -- panel already reflects the optimistic removal
    }
  }

  async function submit(e) {
    e.preventDefault();
    const prompt = input.trim();
    if (!prompt || sending || regeneratingId) return;

    const id = crypto.randomUUID();
    setInput('');
    setSending(true);

    if (mode === 'image') {
      setRows((r) => appendRows(r, { id, role: 'you', text: prompt }, { id: `${id}-status`, role: 'generating' }));
      try {
        const { image } = await generateImage(prompt);
        setRows((r) => r.map((row) => (row.id === `${id}-status` ? { id: row.id, role: 'image', src: image } : row)));
      } catch (err) {
        setRows((r) =>
          r.map((row) => (row.id === `${id}-status` ? { id: row.id, role: 'error', text: err.message } : row))
        );
      } finally {
        setSending(false);
      }
      return;
    }

    if (mode === 'finance') {
      setRows((r) => appendRows(r, { id, role: 'you', text: prompt }, { id: `${id}-status`, role: 'generating' }));
      try {
        const { quote } = await getQuote(prompt);
        setRows((r) => r.map((row) => (row.id === `${id}-status` ? { id: row.id, role: 'quote', quote } : row)));
      } catch (err) {
        setRows((r) =>
          r.map((row) => (row.id === `${id}-status` ? { id: row.id, role: 'error', text: err.message } : row))
        );
      } finally {
        setSending(false);
      }
      return;
    }

    if (mode === 'news') {
      setRows((r) => appendRows(r, { id, role: 'you', text: prompt }, { id: `${id}-status`, role: 'generating' }));
      try {
        const { headlines } = await searchNews(prompt);
        setRows((r) => r.map((row) => (row.id === `${id}-status` ? { id: row.id, role: 'news', headlines } : row)));
      } catch (err) {
        setRows((r) =>
          r.map((row) => (row.id === `${id}-status` ? { id: row.id, role: 'error', text: err.message } : row))
        );
      } finally {
        setSending(false);
      }
      return;
    }

    setRows((r) => appendRows(r, { id, role: 'you', text: prompt }, { id: `${id}-status`, role: 'typing' }));

    try {
      const { response, suggestions, queryId } = await sendChat(prompt, persona);
      setRows((r) =>
        r.map((row) =>
          row.id === `${id}-status`
            ? { id: row.id, role: 'omni', text: response, suggestions, queryId, pinned: false, prompt }
            : row
        )
      );
    } catch (err) {
      setRows((r) =>
        r.map((row) => (row.id === `${id}-status` ? { id: row.id, role: 'error', text: err.message } : row))
      );
    } finally {
      setSending(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      setRecording(false);
      setTranscribing(true);
      try {
        const blob = await recorderRef.current.stop();
        const { text } = await transcribeAudio(blob);
        setInput((prev) => (prev ? `${prev} ${text}` : text));
        textareaRef.current?.focus();
      } catch (err) {
        setRows((r) => appendRows(r, { id: crypto.randomUUID(), role: 'error', text: err.message }));
      } finally {
        setTranscribing(false);
      }
      return;
    }

    try {
      recorderRef.current = new AudioRecorder();
      await recorderRef.current.start();
      setRecording(true);
    } catch (err) {
      setRows((r) => appendRows(r, { id: crypto.randomUUID(), role: 'error', text: 'Microphone access was denied or is unavailable.' }));
    }
  }

  async function uploadFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file next time
    if (!file || sending || uploadingFile) return;

    const question = input.trim();
    setInput('');
    setUploadingFile(true);
    const id = crypto.randomUUID();
    setRows((r) =>
      appendRows(
        r,
        { id, role: 'you', text: `📎 ${file.name}${question ? ` — ${question}` : ''}` },
        { id: `${id}-status`, role: 'generating' }
      )
    );

    try {
      const { response } = await analyzeFile(file, question);
      setRows((r) => r.map((row) => (row.id === `${id}-status` ? { id: row.id, role: 'omni', text: response } : row)));
    } catch (err) {
      setRows((r) =>
        r.map((row) => (row.id === `${id}-status` ? { id: row.id, role: 'error', text: err.message } : row))
      );
    } finally {
      setUploadingFile(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <p className="wordmark">OmniAgent</p>
        <div className="header-actions">
          <button
            className="theme-toggle"
            onClick={openPinned}
            title="Pinned answers"
            aria-label="View pinned answers"
          >
            <PinIcon filled />
          </button>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          >
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
          </button>
        </div>
      </header>

      <main className="chat-main">
        <div className="chat-column">
          {rows.length === 0 && (
            <div className="chat-empty">
              <p className="chat-empty-title">How can I help?</p>
              <p className="chat-empty-sub">Type a message, pick a quick action below, or record your voice.</p>
              <div className="starter-grid">
                {STARTER_PROMPTS.map((s) => (
                  <button key={s.label} type="button" className="starter-card" onClick={() => chooseStarter(s)}>
                    <span className="starter-emoji" aria-hidden="true">{s.emoji}</span>
                    <span className="starter-label">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {rows.map((row, index) => {
            if (row.role === 'typing') {
              return (
                <div className="message omni" key={row.id}>
                  <div className="message-bubble" role="status" aria-live="polite">
                    <div className="message-label">
                      <span className="message-label-text">OmniAgent</span>
                    </div>
                    <TypingDots />
                  </div>
                </div>
              );
            }
            if (row.role === 'generating') {
              return (
                <div className="message omni" key={row.id}>
                  <div className="message-bubble" role="status" aria-live="polite">
                    <div className="message-label">
                      <span className="message-label-text">OmniAgent</span>
                      <span className="generating-label">generating…</span>
                    </div>
                  </div>
                </div>
              );
            }
            if (row.role === 'image') {
              return (
                <div className="message omni" key={row.id}>
                  <div className="message-bubble">
                    <img className="row-image" src={row.src} alt="Generated" />
                  </div>
                </div>
              );
            }
            if (row.role === 'quote') {
              return (
                <div className="message omni" key={row.id}>
                  <div className="message-bubble">
                    <QuoteCard quote={row.quote} />
                  </div>
                </div>
              );
            }
            if (row.role === 'news') {
              return (
                <div className="message omni" key={row.id}>
                  <div className="message-bubble">
                    <NewsList headlines={row.headlines} />
                  </div>
                </div>
              );
            }
            return (
              <div className={`message ${row.role}`} key={row.id}>
                <div
                  className="message-bubble"
                  role={row.role === 'error' ? 'alert' : undefined}
                  aria-live={row.role === 'omni' ? 'polite' : undefined}
                >
                  {row.role === 'error' && row.prompt && index === rows.length - 1 && (
                    <div className="message-label">
                      <button
                        className="speak-btn"
                        type="button"
                        onClick={() => regenerateAnswer(row)}
                        disabled={sending || regeneratingId === row.id}
                        title="Retry"
                        aria-label="Retry this message"
                      >
                        <RegenerateIcon />
                      </button>
                    </div>
                  )}
                  {row.role === 'omni' && (
                    <div className="message-label">
                      <span className="message-label-text">OmniAgent</span>
                      <button
                        className="speak-btn"
                        type="button"
                        onClick={() => copyText(row.id, row.text)}
                        title={copiedId === row.id ? 'Copied!' : 'Copy'}
                        aria-label={copiedId === row.id ? 'Copied' : 'Copy message'}
                      >
                        {copiedId === row.id ? <CheckIcon /> : <CopyIcon />}
                      </button>
                      {isSpeechSynthesisSupported() && (
                        <button
                          className="speak-btn"
                          type="button"
                          onClick={() => speak(row.text)}
                          title="Read aloud"
                          aria-label="Read message aloud"
                        >
                          <SpeakerIcon />
                        </button>
                      )}
                      <button
                        className="speak-btn"
                        type="button"
                        onClick={() => shareText(row.id, row.text)}
                        title={sharedId === row.id ? 'Copied for sharing!' : 'Share'}
                        aria-label={sharedId === row.id ? 'Copied for sharing' : 'Share this answer'}
                      >
                        {sharedId === row.id ? <CheckIcon /> : <ShareIcon />}
                      </button>
                      {row.queryId && (
                        <button
                          className={`speak-btn ${row.pinned ? 'active' : ''}`}
                          type="button"
                          onClick={() => handleTogglePin(row)}
                          title={row.pinned ? 'Unpin' : 'Pin this answer'}
                          aria-label={row.pinned ? 'Unpin this answer' : 'Pin this answer'}
                        >
                          <PinIcon filled={row.pinned} />
                        </button>
                      )}
                      {row.prompt && index === rows.length - 1 && (
                        <button
                          className="speak-btn"
                          type="button"
                          onClick={() => regenerateAnswer(row)}
                          disabled={sending || regeneratingId === row.id}
                          title="Regenerate this answer"
                          aria-label="Regenerate this answer"
                        >
                          <RegenerateIcon />
                        </button>
                      )}
                    </div>
                  )}
                  {regeneratingId === row.id ? <TypingDots /> : <p className="message-text">{row.text}</p>}
                  {row.role === 'omni' && row.suggestions?.length > 0 && index === rows.length - 1 && (
                    <div className="chip-row suggestion-row">
                      {row.suggestions.map((s, i) => (
                        <button key={i} className="chip" type="button" onClick={() => prefill(s)}>
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>
      </main>

      <div className="composer-wrap">
        <div className="composer-column">
          <div className="chip-row">
            {QUICK_ACTIONS.map((qa) => (
              <button key={qa.label} className="chip" type="button" onClick={() => prefill(qa.prefill)}>
                {qa.label}
              </button>
            ))}
            <span className="chip-row-divider" />
            {MODE_ACTIONS.map((ma) => (
              <button
                key={ma.mode}
                className={`chip mode-chip ${mode === ma.mode ? 'active' : ''}`}
                type="button"
                onClick={() => toggleMode(ma.mode)}
              >
                {ma.label}
              </button>
            ))}
            <span className="chip-row-divider" />
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                className={`chip mode-chip ${persona === p.id ? 'active' : ''}`}
                type="button"
                onClick={() => togglePersona(p.id)}
                title={`Answer in a ${p.label.toLowerCase()} tone`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <form className="composer" onSubmit={submit}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.csv,.txt,application/pdf,text/csv,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={uploadFile}
              hidden
            />
            <button
              type="button"
              className="mic-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile}
              title="Attach a file (PDF, DOCX, CSV, TXT)"
              aria-label="Attach a file"
            >
              <PaperclipIcon />
            </button>
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder={MODE_PLACEHOLDERS[mode]}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit(e);
                }
              }}
            />
            {isRecordingSupported() && (
              <button
                type="button"
                className={`mic-btn ${recording ? 'active' : ''}`}
                onClick={toggleRecording}
                disabled={transcribing}
                title={recording ? 'Stop recording' : 'Record a voice message'}
                aria-label={recording ? 'Stop recording' : 'Record a voice message'}
              >
                <MicIcon />
              </button>
            )}
            <button
              className="send-btn"
              type="submit"
              disabled={sending || !!regeneratingId || !input.trim()}
              title={transcribing ? 'Transcribing…' : 'Send'}
              aria-label={transcribing ? 'Transcribing…' : 'Send message'}
            >
              <SendIcon />
            </button>
          </form>
        </div>
      </div>

      {pinnedOpen && (
        <div className="pinned-overlay" role="dialog" aria-label="Pinned answers" onClick={() => setPinnedOpen(false)}>
          <div className="pinned-panel" onClick={(e) => e.stopPropagation()}>
            <div className="pinned-panel-head">
              <h2>Pinned answers</h2>
              <button className="mic-btn" type="button" onClick={() => setPinnedOpen(false)} aria-label="Close pinned answers">
                ×
              </button>
            </div>
            {pinnedLoading && <p className="chat-empty-sub">Loading…</p>}
            {!pinnedLoading && pinnedItems.length === 0 && (
              <p className="chat-empty-sub">Nothing pinned yet. Pin an answer with the pin icon on any response.</p>
            )}
            {!pinnedLoading &&
              pinnedItems.map((item) => (
                <div className="pinned-item" key={item.id}>
                  <p className="pinned-item-prompt">{item.prompt}</p>
                  <p className="pinned-item-response">{item.response}</p>
                  <button className="chip" type="button" onClick={() => unpinFromPanel(item.id)}>
                    Unpin
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
