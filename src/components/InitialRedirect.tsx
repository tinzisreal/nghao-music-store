import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/** Navigates to `to` once on first mount (used to preview a page from the Controls panel). */
export function InitialRedirect({ to }: {to: string;}) {
  const navigate = useNavigate();
  const location = useLocation();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    if (location.pathname !== to) navigate(to, { replace: true });
  }, [navigate, location.pathname, to]);

  return null;
}