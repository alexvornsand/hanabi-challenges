import React from 'react';

export const AboutPage: React.FC = () => {
  return (
    <main className="page stack-sm">
      <h1 className="text-2xl font-bold">About</h1>
      <section className="stack-sm">
        <h2 className="text-xl font-semibold">Mission</h2>
        <p className="text-gray-700">
          This site is a hub for Hanabi competitions. We make it easy to find events, register teams,
          play through preset seeds, and track progress together. The goal is to keep every team on the
          same page—whether you’re tackling a 100-seed challenge or a smaller sprint with friends.
        </p>
      </section>

      <section className="stack-sm">
        <h2 className="text-xl font-semibold">How it works</h2>
        <ul className="text-gray-700" style={{ paddingLeft: '20px' }}>
          <li>Browse current events to see formats, timelines, and seeds.</li>
          <li>Register your team for the events you want to play.</li>
          <li>Log games and link replays so results stay in one place.</li>
          <li>Watch stats update as you progress through each stage.</li>
        </ul>
      </section>

      <section className="stack-sm">
        <h2 className="text-xl font-semibold">Who’s behind it</h2>
        <p className="text-gray-700">
          Built by Hanabi players for the community. We’re iterating quickly—if you spot a bug or want
          to contribute ideas, please reach out.
        </p>
      </section>

      <section className="stack-sm">
        <h2 className="text-xl font-semibold">What’s next</h2>
        <ul className="text-gray-700" style={{ paddingLeft: '20px' }}>
          <li>More event formats (tournaments and multi-stage structures).</li>
          <li>Richer stats, leaderboards, and badges.</li>
          <li>Smoother team tools and replay validation workflows.</li>
        </ul>
      </section>

      <section className="stack-sm">
        <h2 className="text-xl font-semibold">FAQ</h2>
        <p className="text-gray-700">
          We’re collecting common questions. Visit the{' '}
          <a href="/about/FAQ" className="text-blue-700 underline">
            FAQ page
          </a>{' '}
          for more.
        </p>
      </section>
    </main>
  );
};
