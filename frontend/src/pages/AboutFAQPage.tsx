import React from 'react';
import { Link } from 'react-router-dom';

export const AboutFAQPage: React.FC = () => {
  return (
    <main className="page stack-sm">
      <h1 className="text-2xl font-bold">FAQ</h1>

      <section className="stack-xs">
        <h2 className="text-lg font-semibold">How do I register a team?</h2>
        <p className="text-gray-700">
          Open an event page and click &quot;Register a Team.&quot; Pick a team size, add your
          teammates, and submit. For challenges, everyone will play the same preset seeds.
        </p>
      </section>

      <section className="stack-xs">
        <h2 className="text-lg font-semibold">Can I join after an event starts?</h2>
        <p className="text-gray-700">
          Some events allow late registration. If registration is closed, the button will be disabled
          and show a tooltip explaining why.
        </p>
      </section>

      <section className="stack-xs">
        <h2 className="text-lg font-semibold">How are replays used?</h2>
        <p className="text-gray-700">
          Replays help validate that your team played the correct seed with the right players. Paste a
          hanab.live replay link on your team page when logging a game.
        </p>
      </section>

      <section className="stack-xs">
        <h2 className="text-lg font-semibold">Where can I report issues or give feedback?</h2>
        <p className="text-gray-700">
          Please reach out via the community channels or open an issue on our repository. We iterate
          quickly and appreciate reports and ideas.
        </p>
      </section>

      <p className="text-gray-700">
        More questions? Head back to the <Link to="/about" className="text-blue-700 underline">About</Link> page or contact us.
      </p>
    </main>
  );
};
