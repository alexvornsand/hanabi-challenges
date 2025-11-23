import { useParams, Link } from 'react-router-dom';
import { UserPill } from '../components/UserPill';
import { useAuth } from '../context/AuthContext';

export function UserBadgesPage() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();

  const displayName = username ?? 'Unknown';

  const pillColor = user && user.display_name === username ? user.color_hex : '#777777';
  const pillText = user && user.display_name === username ? user.text_color : '#ffffff';

  return (
    <main className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <UserPill
          name={displayName}
          color={pillColor}
          textColor={pillText}
        />
        <h1 className="text-xl font-semibold">Badges</h1>
      </div>
      <p className="text-gray-700">
        Coming soon: badges earned by <strong>{displayName}</strong>.
      </p>
      <Link className="text-blue-700 underline" to={`/users/${displayName}`}>
        Back to profile
      </Link>
    </main>
  );
}
