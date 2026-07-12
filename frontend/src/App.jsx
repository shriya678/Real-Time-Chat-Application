import { useState } from 'react';
import { useAuth } from './hooks/useAuth.js';
import { LoginScreen } from './components/LoginScreen.jsx';
import { ChatWindow } from './components/ChatWindow.jsx';
import './styles/shell.css';

// Local mock state for Feature 6. Replaced by ChatContext (REST + Socket) in F7.
const MOCK_SEED_MESSAGES = [
  {
    id: 'mock-1',
    username: 'system',
    content:
      'This is a local mock message so both bubble styles are visible. Real live messaging arrives in Feature 7.',
    createdAt: new Date(Date.now() - 60_000).toISOString(),
  },
];

function App() {
  const { user, logout, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState(MOCK_SEED_MESSAGES);

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const handleSend = (content) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        username: user,
        content,
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  return (
    <div className="app-shell">
      <header className="shell-header">
        <div className="shell-brand">Real-Time Chat</div>
        <div className="shell-user">
          <span className="shell-username">
            Signed in as <strong>{user}</strong>
          </span>
          <button className="shell-logout" onClick={logout} type="button">
            Logout
          </button>
        </div>
      </header>
      <main className="shell-body">
        <ChatWindow
          messages={messages}
          currentUsername={user}
          onSend={handleSend}
        />
      </main>
    </div>
  );
}

export default App;
