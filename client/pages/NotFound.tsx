import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="min-h-[calc(100dvh-160px)] flex items-center justify-center bg-[hsl(217,33%,9%)] text-white">
      <div className="text-center">
        <h1 className="text-5xl font-extrabold mb-2">404</h1>
        <p className="text-sm text-white/60 mb-6">This page doesn’t exist.</p>
        <a
          href="/"
          className="inline-flex items-center rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
        >
          Go back home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
