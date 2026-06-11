import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

export const INACTIVITY_MS = 4 * 60 * 60 * 1000;        // 4 hours — drivers leave app running
export const SESSION_LIMIT_MS = 24 * 60 * 60 * 1000;    // 24 hours
export const REMEMBER_ME_LIMIT_MS = 30 * 24 * 60 * 60 * 1000;

const PASSIVE_PATTERNS = [
  /^\/shipper\/track/,
  /^\/owner\/fleet-map/,
  /^\/admin\/fleet-map/,
  /^\/track\//,
];

export function useSessionTimeout() {
  const user = useAuthStore((s) => s.user);
  const loginAt = useAuthStore((s) => s.loginAt);
  const rememberMe = useAuthStore((s) => s.rememberMe);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const lastActiveRef = useRef(Date.now()); // eslint-disable-line react-hooks/purity
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!user) return;

    const sessionLimit = rememberMe ? REMEMBER_ME_LIMIT_MS : SESSION_LIMIT_MS;

    function onActivity() {
      if (!PASSIVE_PATTERNS.some((p) => p.test(pathnameRef.current))) {
        lastActiveRef.current = Date.now();
      }
    }

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "touchmove", "click", "pointerdown"];
    events.forEach((e) => document.addEventListener(e, onActivity, { passive: true }));

    const timer = setInterval(() => {
      const now = Date.now();
      const sessionExpired = loginAt != null && now - loginAt > sessionLimit;
      const inactive = now - lastActiveRef.current > INACTIVITY_MS;
      if (sessionExpired || inactive) {
        clearAuth();
        navigate("/login", { state: { expired: true }, replace: true });
      }
    }, 30000);

    return () => {
      events.forEach((e) => document.removeEventListener(e, onActivity));
      clearInterval(timer);
    };
  }, [user, loginAt, rememberMe, clearAuth, navigate]);
}
