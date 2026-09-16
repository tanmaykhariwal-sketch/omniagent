import { useEffect, useRef, useState } from 'react';
import { sendChat, generateImage, transcribeAudio, getQuote, searchNews, logout } from './api.js';
import { speak, stopSpeaking, isSpeechSynthesisSupported, AudioRecorder, isRecordingSupported } from './speech.js';
import { initTheme, applyTheme } from './theme.js';

const QUICK_ACTIONS = [
  { label: 'Summarize', key: '1', prefill: 'Summarize the following:\n\n' },
  { label: 'Explain code', key: '2', prefill: 'Explain what this code does:\n\n' },
  { label: 'Draft email', key: '3', prefill: 'Draft a professional email about:\n\n' },
];

const MODE_ACTIONS = [
  { mode: 'image', label: 'Image' },
  { mode: 'finance', label: 'Finance' },
  { mode: 'news', label: 'News' },
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

function TypingDots() {
  return (
    <span className="typing-dots" aria-label="OmniAgent is responding">
      <span />
      <span />
      <span />
    </span>
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
          {quote.price.toFixed(2)} {quote.currency}
        </span>
        {changeText && <span className={`quote-change ${up ? 'up' : 'down'}`}>{changeText}</span>}
      </div>
      {quote.exchange && <div className="quote-exchange">{quote.exchange}</div>}
    </div>
  );
}

function NewsList({ headlines }) {
  if (headlines.length === 0) return <p className="message-text">No headlines found.</p>;
  return (
    <ul className="news-list">
      {headlines.map((h, i) => (
        <li key={i} className="news-item">
          <a href={h.link} target="_blank" rel="noreferrer">
            {h.headline}
          </a>
          {h.source && <span className="news-source">{h.source}</span>}
        </li>
      ))}
    </ul>
  );
}

export default function ChatPage({ onLoggedOut }) {
  const [input, setInput] = useState('');
  const [rows, setRows] = useState([]);
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState('chat');
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [theme, setTheme] = useState('light');
  const textareaRef = useRef(null);
  const recorderRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    setTheme(initTheme());
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [rows]);

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    applyTheme(next);
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

  async function submit(e) {
    e.preventDefault();
    const prompt = input.trim();
    if (!prompt || sending) return;

    const id = crypto.randomUUID();
    setInput('');
    setSending(true);

    if (mode === 'image') {
      setRows((r) => [...r, { id, role: 'you', text: prompt }, { id: `${id}-status`, role: 'generating' }]);
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
      setRows((r) => [...r, { id, role: 'you', text: prompt }, { id: `${id}-status`, role: 'generating' }]);
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
      setRows((r) => [...r, { id, role: 'you', text: prompt }, { id: `${id}-status`, role: 'generating' }]);
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

    setRows((r) => [...r, { id, role: 'you', text: prompt }, { id: `${id}-status`, role: 'typing' }]);

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
        setRows((r) => [...r, { id: crypto.randomUUID(), role: 'error', text: err.message }]);
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
      setRows((r) => [...r, { id: crypto.randomUUID(), role: 'error', text: 'Microphone access was denied or is unavailable.' }]);
    }
  }

  async function handleLogout() {
    stopSpeaking();
    await logout();
    onLoggedOut();
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <p className="wordmark">OmniAgent</p>
        <div className="header-actions">
          <button className="theme-toggle" onClick={toggleTheme} title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}>
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
          </button>
          <button className="icon-btn" onClick={handleLogout}>
            Sign out
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
          {rows.map((row) => {
            if (row.role === 'typing') {
              return (
                <div className="message omni" key={row.id}>
                  <div className="message-bubble">
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
                  <div className="message-bubble">
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
                <div className="message-bubble">
                  {row.role === 'omni' && (
                    <div className="message-label">
                      <span className="message-label-text">OmniAgent</span>
                      {isSpeechSynthesisSupported() && (
                        <button className="speak-btn" type="button" onClick={() => speak(row.text)} title="Read aloud">
                          <SpeakerIcon />
                        </button>
                      )}
                    </div>
                  )}
                  <p className="message-text">{row.text}</p>
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
                <kbd>⌥{qa.key}</kbd>
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
          </div>

          <form className="composer" onSubmit={submit}>
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
              >
                <MicIcon />
              </button>
            )}
            <button className="send-btn" type="submit" disabled={sending || !input.trim()} title={transcribing ? 'Transcribing…' : 'Send'}>
              <SendIcon />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
