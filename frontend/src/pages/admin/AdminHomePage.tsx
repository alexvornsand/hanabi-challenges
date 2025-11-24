import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function AdminHomePage() {
  const { user } = useAuth();

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="p-4 space-y-3">
      <h1 className="text-2xl font-bold">Admin</h1>
      <p className="text-gray-700">Choose a tool below.</p>

      <ul className="list-disc pl-5 space-y-2">
        <li>
          <Link className="text-blue-700 underline" to="/admin/create-event">
            Create event
          </Link>
        </li>
        {user.role === 'SUPERADMIN' && (
          <li>
            <Link className="text-blue-700 underline" to="/admin/manage-users">
              Manage users
            </Link>
          </li>
        )}
      </ul>
    </main>
  );
}
