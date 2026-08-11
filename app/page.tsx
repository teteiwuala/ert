"use client";

import dynamic from "next/dynamic";

// The whole experience is client-only (WebGL + WebXR touch `window`), so we disable
// SSR for it. `next/dynamic` with ssr:false must live inside a Client Component.
const Sim = dynamic(() => import("@/components/Sim"), {
  ssr: false,
  loading: () => (
    <div style={{ height: "100%", display: "grid", placeItems: "center", fontFamily: "var(--mono)", color: "#8a9aa3" }}>
      Loading the ward…
    </div>
  ),
});

export default function Page() {
  return <Sim />;
}
