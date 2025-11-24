import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function AdminManageUsersPage() {
  const { user } = useAuth();

  if (!user || user.role !== 'SUPERADMIN') {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="p-4 space-y-3">
      <h1 className="text-2xl font-bold">Manage Users</h1>
      <p className="text-gray-700">User role management will go here.</p>
    </main>
  );
}
