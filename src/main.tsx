import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startSmoothScroll } from "./lib/smoothScroll";

// Safari en iPhone ignora user-scalable=no: se bloquea el zoom con dos dedos desde acá
document.addEventListener("gesturestart", (e) => e.preventDefault());

startSmoothScroll();

createRoot(document.getElementById("root")!).render(<App />);
