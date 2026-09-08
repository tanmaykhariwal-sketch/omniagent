import { useState } from 'react';
import LoginPage from './LoginPage.jsx';
import ChatPage from './ChatPage.jsx';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);

  if (!loggedIn) return <LoginPage onAuthed={() => setLoggedIn(true)} />;
  return <ChatPage onLoggedOut={() => setLoggedIn(false)} />;
}
