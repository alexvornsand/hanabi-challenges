import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type LocationState = {
  displayName?: string;
};

export function NewUserPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();
  const state = (location.state as LocationState | null) ?? {};
  const displayName = state.displayName ?? user?.display_name;

  if (!displayName) {
    navigate('/');
    return null;
  }

  return (
    <main className="p-4 max-w-lg mx-auto space-y-3">
      <h1 className="text-2xl font-bold">Welcome, {displayName}!</h1>
      <p className="text-gray-700">
        Your account has been created. You can head back to the main page to explore events.
      </p>
      <button
        onClick={() => navigate('/')}
        className="px-4 py-2 rounded bg-blue-600 text-white font-semibold"
      >
        Go to main page
      </button>
    </main>
  );
}
