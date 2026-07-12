export function OnlineUsers({ users, currentUsername }) {
  const sorted = [...users].sort((a, b) => {
    if (a === currentUsername) return -1;
    if (b === currentUsername) return 1;
    return a.localeCompare(b);
  });

  return (
    <aside className="online-users" aria-label="Online users">
      <div className="online-users-header">
        Online
        <span className="online-users-count">{users.length}</span>
      </div>

      {sorted.length === 0 ? (
        <div className="online-users-empty">No one online.</div>
      ) : (
        <ul className="online-users-list">
          {sorted.map((user) => {
            const isSelf = user === currentUsername;
            return (
              <li
                key={user}
                className={`online-user${isSelf ? ' online-user--self' : ''}`}
              >
                <span className="online-dot" aria-hidden="true" />
                <span className="online-user-name">{user}</span>
                {isSelf && <span className="online-user-tag">you</span>}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
