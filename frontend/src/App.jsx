import { useAuth } from './hooks/useAuth.js';
import { LoginScreen } from './components/LoginScreen.jsx';
import './styles/shell.css';

function App() {
  const { user, logout, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

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
        <div className="shell-placeholder">
          <h2>Lobby</h2>
          <p>Chat UI arrives in Feature 6. For now, this is the authenticated shell.</p>
        </div>
      </main>
    </div>
  );
}

export default App;
