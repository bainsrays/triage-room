import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ShiftProvider } from "./lib/ShiftContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ShiftProvider>
        <App />
      </ShiftProvider>
    </BrowserRouter>
  </React.StrictMode>
);
