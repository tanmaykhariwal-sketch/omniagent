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
