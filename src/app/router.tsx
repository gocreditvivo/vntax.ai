/**
 * Router abstraction.
 *
 * Screens never import react-router-dom directly — they use useNav() and <Link>.
 * That keeps navigation swappable, makes screens unit-testable without a router,
 * and lets the static preview build render pages without history support.
 */
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { MouseEvent, ReactNode } from 'react';

export interface NavValue {
  path: string;
  navigate: (to: string) => void;
}

const NavContext = createContext<NavValue | null>(null);

/** Used by the app. In production this delegates to react-router-dom. */
export function NavProvider({
  children,
  initialPath = '/',
  onNavigate,
}: {
  children: ReactNode;
  initialPath?: string;
  onNavigate?: (to: string) => void;
}) {
  const [path, setPath] = useState(initialPath);

  /**
   * Keeps the abstraction in step with the outer router.
   *
   * Previously `main.tsx` forced a remount on every navigation via a `key`,
   * which is why this sync was not needed. That remount now has to go: it
   * would tear down and rebuild the auth provider on every page change,
   * re-reading the session and flashing a loading state each time. Syncing the
   * prop keeps browser back/forward working without remounting the tree.
   */
  useEffect(() => { setPath(initialPath); }, [initialPath]);

  const navigate = useCallback(
    (to: string) => {
      setPath(to);
      onNavigate?.(to);
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
    },
    [onNavigate]
  );
  return <NavContext.Provider value={{ path, navigate }}>{children}</NavContext.Provider>;
}

export function useNav(): NavValue {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used inside NavProvider');
  return ctx;
}

export function Link({
  to, children, className = '',
}: { to: string; children: ReactNode; className?: string }) {
  const { navigate } = useNav();
  return (
    <a
      href={`#${to}`}
      className={className}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => { e.preventDefault(); navigate(to); }}
    >
      {children}
    </a>
  );
}
