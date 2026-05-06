import { Navigate, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import WorkerSignupPage from "./pages/WorkerSignupPage.jsx";
import AiInterviewPage from "./pages/AiInterviewPage.jsx";
import VerifiedWorkersPage from "./pages/VerifiedWorkersPage.jsx";
import CompanyBrowsePage from "./pages/CompanyBrowsePage.jsx";
import AdminDashboardPage from "./pages/AdminDashboardPage.jsx";

function Placeholder({ title }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-2 text-slate-600">We’ll build this page next.</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/worker/signup" element={<WorkerSignupPage />} />
      <Route path="/worker/interview" element={<AiInterviewPage />} />
      <Route path="/workers/verified" element={<VerifiedWorkersPage />} />
      <Route path="/company/browse" element={<CompanyBrowsePage />} />
      <Route path="/admin" element={<AdminDashboardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

