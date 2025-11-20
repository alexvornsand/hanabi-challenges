import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { NotFoundPage } from "./NotFoundPage";

export const ChallengeDetailPage: React.FC = () => {
  const { challengeId } = useParams();
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState<boolean | null>(null);

  // Temporary fake fetch to simulate existence
  useEffect(() => {
    let isNumber = false;

    // Fake rule for now:
    // - challenge "1" exists
    // - challenge "2" exists
    // - everything else -> doesn't exist
    if (challengeId === "1" || challengeId === "2") {
      isNumber = true;
    }

    setExists(isNumber);
    setLoading(false);
  }, [challengeId]);

  if (loading) return <p>Loading…</p>;
  if (exists === false) return <NotFoundPage />;

  return (
    <div>
      <h1>Challenge {challengeId}</h1>
      <p>This is the details page for a valid challenge.</p>

      <section>
        <h2>Teams in this challenge</h2>
        <p>Eventually this will list teams for challenge {challengeId}.</p>
      </section>

      <section>
        <h2>Stats</h2>
        <p>Later: challenge-level stats.</p>
      </section>
    </div>
  );
};
