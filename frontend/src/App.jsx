import { useAuth } from './hooks/useAuth.js';
import { useChat } from './hooks/useChat.js';
import { LoginScreen } from './components/LoginScreen.jsx';
import { ChatWindow } from './components/ChatWindow.jsx';
import { ChatProvider } from './context/ChatContext.jsx';
import { ConnectionBanner } from './components/ConnectionBanner.jsx';
import './styles/shell.css';

function AuthenticatedApp({ user, onLogout }) {
  const { messages, sendMessage, isConnected, isLoadingHistory, historyError } =
    useChat();

  return (
    <div className="app-shell">
      <header className="shell-header">
        <div className="shell-brand">Real-Time Chat</div>
        <div className="shell-user">
          <span className="shell-username">
            Signed in as <strong>{user}</strong>
          </span>
          <button className="shell-logout" onClick={onLogout} type="button">
            Logout
          </button>
        </div>
      </header>

      <ConnectionBanner isConnected={isConnected} />

      <main className="shell-body">
        {isLoadingHistory && <div className="shell-loading">Loading messages…</div>}

        {!isLoadingHistory && historyError && (
          <div className="shell-error" role="alert">
            Couldn't load chat history: {historyError}. Refresh to try again.
          </div>
        )}

        {!isLoadingHistory && !historyError && (
          <ChatWindow
            messages={messages}
            currentUsername={user}
            onSend={sendMessage}
            disabled={!isConnected}
          />
        )}
      </main>
    </div>
  );
}

function App() {
  const { user, logout, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <ChatProvider username={user}>
      <AuthenticatedApp user={user} onLogout={logout} />
    </ChatProvider>
  );
}

export default App;
