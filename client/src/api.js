async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'request failed');
  }
  return res.json();
}

export function register(email, password) {
  return fetch('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  }).then(handle);
}

export function login(email, password) {
  return fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  }).then(handle);
}

export function logout() {
  return fetch('/logout', { method: 'POST', credentials: 'include' }).then(handle);
}

export function sendChat(prompt) {
  return fetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ prompt }),
  }).then(handle);
}

export function generateImage(prompt) {
  return fetch('/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ prompt }),
  }).then(handle);
}

export function transcribeAudio(blob) {
  const form = new FormData();
  form.append('audio', blob, 'clip.webm');
  return fetch('/transcribe', {
    method: 'POST',
    credentials: 'include',
    body: form,
  }).then(handle);
}

export function getQuote(symbol) {
  return fetch(`/finance?symbol=${encodeURIComponent(symbol)}`, { credentials: 'include' }).then(handle);
}

export function searchNews(query) {
  return fetch(`/news?q=${encodeURIComponent(query)}`, { credentials: 'include' }).then(handle);
}
