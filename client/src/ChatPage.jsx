import { useRef, useState } from 'react';
import { sendChat, generateImage, transcribeAudio, getQuote, searchNews, logout } from './api.js';
import { speak, stopSpeaking, isSpeechSynthesisSupported, AudioRecorder, isRecordingSupported } from './speech.js';

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

const MODE_PLACEHOLDERS = {
  chat: 'Ask OmniAgent…',
  image: 'Describe an image to generate…',
  finance: 'Enter a stock symbol, e.g. AAPL…',
  news: 'Search a news topic…',
};

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

function MicIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <rect x="5.5" y="1.5" width="5" height="8" rx="2.5" />
      <path d="M3 8a5 5 0 0 0 10 0" />
      <path d="M8 13v1.5" />
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
  if (headlines.length === 0) return <p className="row-text">No headlines found.</p>;
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
  const textareaRef = useRef(null);
  const recorderRef = useRef(null);

  function prefill(text) {
    setMode('chat');
    setInput(text);
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
            <button className="send-btn" type="submit" disabled={sending || !input.trim()}>
              {transcribing ? 'Transcribing…' : 'Send'}
            </button>
          </form>

          <div className="quick-row">
            {QUICK_ACTIONS.map((qa) => (
              <button key={qa.label} className="chip" type="button" onClick={() => prefill(qa.prefill)}>
                {qa.label}
                <kbd>⌥{qa.key}</kbd>
              </button>
            ))}
            <span className="quick-row-divider" />
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

          <div className="log">
            {rows.length === 0 && (
              <div className="log-empty">Type a message, pick a quick action, or record your voice.</div>
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
              if (row.role === 'generating') {
                return (
                  <div className="row omni" key={row.id}>
                    <div className="row-meta">
                      <span className="row-who">OmniAgent</span>
                      <span className="generating-label">generating…</span>
                    </div>
                  </div>
                );
              }
              if (row.role === 'image') {
                return (
                  <div className="row omni" key={row.id}>
                    <div className="row-meta">
                      <span className="row-who">OmniAgent</span>
                    </div>
                    <img className="row-image" src={row.src} alt="Generated" />
                  </div>
                );
              }
              if (row.role === 'quote') {
                return (
                  <div className="row omni" key={row.id}>
                    <div className="row-meta">
                      <span className="row-who">OmniAgent</span>
                    </div>
                    <QuoteCard quote={row.quote} />
                  </div>
                );
              }
              if (row.role === 'news') {
                return (
                  <div className="row omni" key={row.id}>
                    <div className="row-meta">
                      <span className="row-who">OmniAgent</span>
                    </div>
                    <NewsList headlines={row.headlines} />
                  </div>
                );
              }
              return (
                <div className={`row ${row.role}`} key={row.id}>
                  <div className="row-meta">
                    <span className="row-who">{row.role === 'you' ? 'You' : 'OmniAgent'}</span>
                    {row.role === 'omni' && isSpeechSynthesisSupported() && (
                      <button className="speak-btn" type="button" onClick={() => speak(row.text)} title="Read aloud">
                        <SpeakerIcon />
                      </button>
                    )}
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
