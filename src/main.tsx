import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log('[App] 🚀 bootstrap started', new Date().toISOString());

createRoot(document.getElementById("root")!).render(<App />);
