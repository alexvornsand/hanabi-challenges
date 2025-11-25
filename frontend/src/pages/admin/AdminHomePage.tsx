import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function AdminHomePage() {
  const { user } = useAuth();

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="page stack-sm">
      <header className="stack-sm">
        <h1 className="text-2xl font-bold">Admin</h1>
      </header>

      <div className="stack-sm" style={{ maxWidth: '220px' }}>
        <Link to="/admin/create-event" className="btn btn--primary">
          Create Event
        </Link>
        {user.role === 'SUPERADMIN' && (
          <Link to="/admin/manage-users" className="btn btn--primary">
            Manage Users
          </Link>
        )}
      </div>
    </main>
  );
}
