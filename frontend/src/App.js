import { useEffect } from "react";

// Static mockup lives in /public/mockup (pure HTML/CSS/JS, no backend).
export default function App() {
  useEffect(() => {
    window.location.replace("/mockup/index.html");
  }, []);
  return null;
}
