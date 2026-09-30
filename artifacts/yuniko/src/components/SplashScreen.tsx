interface SplashScreenProps { onDone: () => void; }
export default function SplashScreen({ onDone }: SplashScreenProps) { if (typeof window !== "undefined") window.requestAnimationFrame(onDone); return null; }
