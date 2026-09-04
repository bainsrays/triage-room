import { Route, Routes } from "react-router-dom";
import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import LandingPage from "./pages/LandingPage";
import QueuePage from "./pages/QueuePage";
import WorkspacePage from "./pages/WorkspacePage";
import ScoreCardPage from "./pages/ScoreCardPage";
import HowScoringWorksPage from "./pages/HowScoringWorksPage";
import WhyTheseTicketsPage from "./pages/WhyTheseTicketsPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only-focusable">
        Skip to main content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/ticket/:ticketId" element={<WorkspacePage />} />
          <Route path="/ticket/:ticketId/score" element={<ScoreCardPage />} />
          <Route path="/how-scoring-works" element={<HowScoringWorksPage />} />
          <Route path="/why-these-tickets" element={<WhyTheseTicketsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <SiteFooter />
    </div>
  );
}
