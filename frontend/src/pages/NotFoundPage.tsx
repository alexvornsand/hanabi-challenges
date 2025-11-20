import React from "react";
import { Link } from "react-router-dom";

export const NotFoundPage: React.FC = () => {
  return (
    <div>
      <h1>404 – Page Not Found</h1>
      <p>The page you’re looking for doesn’t exist.</p>
      <p>
        <Link to="/">Return home</Link>
      </p>
    </div>
  );
};
