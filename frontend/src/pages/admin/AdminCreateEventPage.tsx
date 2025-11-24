import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function AdminCreateEventPage() {
  const { user } = useAuth();

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="p-4 space-y-3">
      <h1 className="text-2xl font-bold">Create Event</h1>
      <p className="text-gray-700">Event creation form will go here.</p>
    </main>
  );
}
