import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import '../styles/auth.css';

const MAX_USERNAME_LENGTH = 50;

export function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [error, setError] = useState(null);

  const trimmed = username.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= MAX_USERNAME_LENGTH;

  const handleSubmit = (event) => {
    event.preventDefault();
    setError(null);
    try {
      login(trimmed);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">Join the chat</h1>
        <p className="auth-subtitle">Pick a username to enter the lobby.</p>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <label htmlFor="username" className="auth-label">
            Username
          </label>
          <input
            id="username"
            type="text"
            autoFocus
            autoComplete="off"
            maxLength={MAX_USERNAME_LENGTH}
            placeholder="e.g. alice"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="auth-input"
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? 'auth-error' : undefined}
          />

          {error && (
            <p id="auth-error" role="alert" className="auth-error">
              {error}
            </p>
          )}

          <button type="submit" disabled={!canSubmit} className="auth-submit">
            Enter chat
          </button>
        </form>
      </div>
    </div>
  );
}
