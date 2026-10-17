/** The assembling-resume illustration from the Welcome artboard, with gentle float animation. */
export function HeroIllustration() {
  return (
    <div className="relative" style={{ width: "min(420px, 100%)", height: 520 }}>
      <div
        aria-hidden="true"
        className="absolute paper-sheet border border-line"
        style={{ left: "9.5%", top: 40, width: "71%", height: 420, borderRadius: 18, boxShadow: "0 30px 60px rgba(30,36,48,0.10)", padding: 32, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, #DCE3F5, #9CC3C5)" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ width: 120, height: 12, borderRadius: 6, background: "#1E2430" }} />
            <div style={{ width: 90, height: 8, borderRadius: 4, background: "#D9D5CC" }} />
          </div>
        </div>
        <div style={{ height: 1, background: "#E6E2DA", margin: "6px 0" }} />
        <div style={{ width: 70, height: 8, borderRadius: 4, background: "#2F6F73" }} />
        <div style={{ width: "100%", height: 8, borderRadius: 4, background: "#E6E2DA" }} />
        <div style={{ width: "85%", height: 8, borderRadius: 4, background: "#E6E2DA" }} />
        <div style={{ width: "92%", height: 8, borderRadius: 4, background: "#E6E2DA" }} />
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 60, marginTop: 8 }}>
          <div style={{ flex: 1, height: "40%", borderRadius: "4px 4px 0 0", background: "#DCE3F5" }} />
          <div style={{ flex: 1, height: "65%", borderRadius: "4px 4px 0 0", background: "#9CC3C5" }} />
          <div style={{ flex: 1, height: "100%", borderRadius: "4px 4px 0 0", background: "#2F6F73" }} />
          <div style={{ flex: 1, height: "80%", borderRadius: "4px 4px 0 0", background: "#9CC3C5" }} />
        </div>
        <div style={{ width: 70, height: 8, borderRadius: 4, background: "#2F6F73", marginTop: 8 }} />
        <div style={{ width: "100%", height: 8, borderRadius: 4, background: "#E6E2DA" }} />
        <div style={{ width: "60%", height: 8, borderRadius: 4, background: "#E6E2DA" }} />
      </div>
      <div aria-hidden="true" className="absolute anim-float" style={{ "--r": "-12deg", left: 0, top: 300, width: 64, height: 64, borderRadius: 14, background: "#E7B99E", boxShadow: "0 12px 24px rgba(201,105,63,0.18)", animationDelay: "0s" } as React.CSSProperties} />
      <div aria-hidden="true" className="absolute anim-float" style={{ "--r": "14deg", left: "78%", top: 20, width: 54, height: 54, borderRadius: 12, background: "#9CC3C5", boxShadow: "0 12px 24px rgba(47,111,115,0.18)", animationDelay: "0.8s" } as React.CSSProperties} />
      <div aria-hidden="true" className="absolute anim-float" style={{ "--r": "-8deg", left: "83%", top: 380, width: 44, height: 44, borderRadius: 10, background: "#2F6F73", boxShadow: "0 12px 24px rgba(47,111,115,0.22)", animationDelay: "1.6s" } as React.CSSProperties} />
      <div aria-hidden="true" className="absolute anim-float" style={{ "--r": "20deg", left: 20, top: 0, width: 36, height: 36, borderRadius: 8, background: "#DCE3F5", animationDelay: "2.4s" } as React.CSSProperties} />
      <div className="absolute flex items-center gap-2.5 bg-white border border-line rounded-full text-[13px] font-semibold" style={{ left: "55%", top: 430, padding: "12px 16px", boxShadow: "0 10px 24px rgba(30,36,48,0.10)" }}>
        <span className="w-2 h-2 rounded-full bg-terracotta" />
        Listening in தமிழ்…
      </div>
    </div>
  );
}
