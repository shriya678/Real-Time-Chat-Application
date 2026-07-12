import { useEffect } from 'react';
import { useAuth } from './hooks/useAuth.js';
import { useChat } from './hooks/useChat.js';
import { useTyping } from './hooks/useTyping.js';
import { usePresence } from './hooks/usePresence.js';
import { LoginScreen } from './components/LoginScreen.jsx';
import { ChatWindow } from './components/ChatWindow.jsx';
import { OnlineUsers } from './components/OnlineUsers.jsx';
import { ChatProvider } from './context/ChatContext.jsx';
import { ConnectionBanner } from './components/ConnectionBanner.jsx';
import { disconnectSocket } from './socket/index.js';
import './styles/shell.css';

function AuthenticatedApp({ user, onLogout }) {
  const {
    messages,
    sendMessage,
    markMessageRead,
    isConnected,
    isLoadingHistory,
    historyError,
  } = useChat();
  const { typers, handleTyping, handleStopTyping } = useTyping({ username: user });
  const { onlineUsers } = usePresence({ username: user });

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
          <div className="chat-layout">
            <ChatWindow
              messages={messages}
              currentUsername={user}
              onSend={sendMessage}
              disabled={!isConnected}
              typers={typers}
              onType={handleTyping}
              onStopTyping={handleStopTyping}
              onMarkRead={markMessageRead}
            />
            <OnlineUsers users={onlineUsers} currentUsername={user} />
          </div>
        )}
      </main>
    </div>
  );
}

function App() {
  const { user, logout, isAuthenticated } = useAuth();

  // Disconnect the socket on logout so the server sees a proper disconnect
  // event and can broadcast presence:leave (+ typing:stop) on this user's behalf.
  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
    }
  }, [isAuthenticated]);

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
