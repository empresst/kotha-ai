"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { VoiceState } from "@/components/three/KothaMascot";

const KothaMascot = dynamic(() => import("@/components/three/KothaMascot"), { ssr: false });

/** The mascot only runs while this box is on screen, so two 3D scenes never render at once. */
export function LazyMascot({ className = "" }: { className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const voice = useRef<VoiceState>({ level: 0, phase: "idle", speaking: false });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={box} className={className}>{visible && <KothaMascot voice={voice} />}</div>;
}
