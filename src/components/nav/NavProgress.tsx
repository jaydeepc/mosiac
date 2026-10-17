"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Immediate feedback for every navigation: a thin teal bar at the top of the page the moment a
 * link or button is pressed, until the new page has rendered. Buttons can also read `pending`
 * to show their own spinner.
 */
interface NavCtx {
  pending: boolean;
  go: (href: string) => void;
}
const Ctx = createContext<NavCtx>({ pending: false, go: () => {} });

export function useNavigate() {
  return useContext(Ctx);
}

export function NavProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [clicked, setClicked] = useState(false);
  const timer = useRef<number | null>(null);

  // any internal link click starts the bar
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") ?? "";
      if (!href.startsWith("/") || href.startsWith("/api/")) return;
      const current = window.location.pathname + window.location.search;
      if (href === current || href.startsWith("#")) return;
      setClicked(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // route changed → done
  useEffect(() => {
    setClicked(false);
    if (timer.current) window.clearTimeout(timer.current);
  }, [pathname, search]);

  // safety valve so a cancelled navigation doesn't leave the bar on
  useEffect(() => {
    if (!clicked) return;
    timer.current = window.setTimeout(() => setClicked(false), 25000);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [clicked]);

  const go = useCallback(
    (href: string) => {
      setClicked(true);
      startTransition(() => router.push(href));
    },
    [router],
  );

  const pending = isPending || clicked;
  const value = useMemo(() => ({ pending, go }), [pending, go]);

  return (
    <Ctx.Provider value={value}>
      <div aria-hidden="true" className="fixed top-0 left-0 right-0 z-[100] pointer-events-none" style={{ height: 3 }}>
        <div
          className="h-full"
          style={{
            width: pending ? "82%" : "100%",
            background: "linear-gradient(90deg, #2F6F73, #9CC3C5)",
            opacity: pending ? 1 : 0,
            transition: pending ? "width 6s cubic-bezier(0.1, 0.7, 0.2, 1), opacity 0.15s" : "width 0.2s, opacity 0.4s 0.2s",
            boxShadow: "0 0 10px rgba(47,111,115,0.45)",
          }}
        />
      </div>
      {pending && (
        <div aria-live="polite" className="fixed top-3 right-4 z-[100] flex items-center gap-2 rounded-full bg-white border border-line text-[12px] font-semibold text-muted anim-fade-up" style={{ padding: "6px 10px", boxShadow: "0 8px 20px rgba(30,36,48,0.10)" }}>
          <span className="anim-spin inline-block rounded-full" style={{ width: 12, height: 12, border: "2px solid #9CC3C5", borderTopColor: "#2F6F73" }} />
          Opening…
        </div>
      )}
      {children}
    </Ctx.Provider>
  );
}
