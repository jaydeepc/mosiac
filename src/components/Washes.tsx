/** Soft watercolour washes that never sit under text. */
export function Washes({ variant = "welcome" }: { variant?: "welcome" | "login" | "ready" | "talk" | "mobile" }) {
  if (variant === "login") {
    return (
      <>
        <div aria-hidden="true" className="absolute rounded-full" style={{ top: -120, left: -80, width: 560, height: 560, background: "radial-gradient(circle at 45% 45%, rgba(220,227,245,1), rgba(220,227,245,0) 68%)" }} />
        <div aria-hidden="true" className="absolute rounded-full" style={{ bottom: -180, right: -100, width: 620, height: 620, background: "radial-gradient(circle at 50% 50%, rgba(217,232,221,1), rgba(217,232,221,0) 68%)" }} />
        <div aria-hidden="true" className="absolute rounded-full" style={{ top: "46%", left: "38%", width: 360, height: 360, background: "radial-gradient(circle at 50% 50%, rgba(246,227,211,0.95), rgba(246,227,211,0) 68%)" }} />
      </>
    );
  }
  if (variant === "ready") {
    return (
      <>
        <div aria-hidden="true" className="absolute rounded-full" style={{ top: -200, left: "30%", width: 700, height: 700, background: "radial-gradient(circle at 50% 50%, rgba(217,232,221,0.9), rgba(217,232,221,0) 70%)" }} />
        <div aria-hidden="true" className="absolute rounded-full" style={{ bottom: -260, right: -120, width: 620, height: 620, background: "radial-gradient(circle at 50% 50%, rgba(246,227,211,0.9), rgba(246,227,211,0) 70%)" }} />
      </>
    );
  }
  if (variant === "talk") {
    return (
      <div aria-hidden="true" className="absolute rounded-full" style={{ bottom: 40, left: "50%", transform: "translateX(-50%)", width: 520, height: 520, background: "radial-gradient(circle at 50% 50%, rgba(217,232,221,0.9), rgba(217,232,221,0) 70%)" }} />
    );
  }
  if (variant === "mobile") {
    return (
      <>
        <div aria-hidden="true" className="absolute rounded-full" style={{ top: -120, right: -140, width: 380, height: 380, background: "radial-gradient(circle at 50% 50%, rgba(220,227,245,0.95), rgba(220,227,245,0) 70%)" }} />
        <div aria-hidden="true" className="absolute rounded-full" style={{ bottom: -160, left: -140, width: 400, height: 400, background: "radial-gradient(circle at 50% 50%, rgba(217,232,221,0.95), rgba(217,232,221,0) 70%)" }} />
      </>
    );
  }
  return (
    <>
      <div aria-hidden="true" className="absolute rounded-full" style={{ top: -180, right: -120, width: 620, height: 620, background: "radial-gradient(circle at 40% 40%, rgba(220,227,245,0.9), rgba(220,227,245,0) 70%)" }} />
      <div aria-hidden="true" className="absolute rounded-full" style={{ bottom: -220, left: -160, width: 640, height: 640, background: "radial-gradient(circle at 50% 50%, rgba(217,232,221,0.9), rgba(217,232,221,0) 70%)" }} />
      <div aria-hidden="true" className="absolute rounded-full" style={{ top: 420, left: "46%", width: 420, height: 420, background: "radial-gradient(circle at 50% 50%, rgba(246,227,211,0.85), rgba(246,227,211,0) 70%)" }} />
    </>
  );
}
