import { useEffect, useState, useCallback } from 'react';
import { listUsers, setApproval, type UserRow } from '../data/users';
import { useMutation } from '../hooks/useMutation';
import ErrorBanner from '../ui/ErrorBanner';
import './UsersScreen.css';

export default function UsersScreen() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setUsers(await listUsers());
  }, []);

  const { busy, error, mutate, refresh } = useMutation(fetchUsers);

  useEffect(() => {
    // `refresh` rethrows so callers can react to a failure; this one only wants
    // the spinner cleared, and the banner already has the message. Without the
    // catch the rejection escapes into an unhandled promise.
    void refresh()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refresh]);

  function toggleApproval(user: UserRow) {
    // No optimistic write: `mutate` re-reads the table as soon as the update
    // lands, so the server's answer is the one that reaches the screen.
    void mutate(() => setApproval(user.id, !user.is_approved));
  }

  if (loading) return <p>Loading users...</p>;

  return (
    <section className="users-screen">
      <div className="dungeons-header">
        <h2>Access Management</h2>
        <div className="header-decoration"></div>
      </div>
      <ErrorBanner message={error} />

      <p className="muted" style={{ marginBottom: '20px' }}>
        Manage who has access to the planner. Only approved users (or admins) can enter the site.
      </p>

      <div className="users-card">
        <table className="users-table">
          <thead>
            <tr>
              <th>Discord Username</th>
              <th>Admin Status</th>
              <th>Approved Access</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>No users found.</td>
              </tr>
            )}
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.discord_username || u.id}</td>
                <td>{u.is_admin ? <span className="tag admin-tag">ADMIN</span> : 'User'}</td>
                <td>
                  {u.is_admin ? (
                    <span className="tag approved-tag">YES (Admin)</span>
                  ) : u.is_approved ? (
                    <span className="tag approved-tag">YES</span>
                  ) : (
                    <span className="tag locked-tag">NO</span>
                  )}
                </td>
                <td>
                  {!u.is_admin && (
                    <button
                      disabled={busy}
                      onClick={() => toggleApproval(u)}
                      className={u.is_approved ? 'btn-revoke' : 'btn-approve'}
                    >
                      {u.is_approved ? 'Revoke Access' : 'Approve Access'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
