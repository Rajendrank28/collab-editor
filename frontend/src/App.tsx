import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ExplorePage from "./pages/ExplorePage";
import EditorPage from "./pages/EditorPage";
import ProtectedRoute from "./components/common/ProtectedRoute";

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected routes */}
        <Route
          path="/explore"
          element={
            <ProtectedRoute>
              <ExplorePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/editor/:snippetId"
          element={
            <ProtectedRoute>
              <EditorPage />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<p>404 - Page not found</p>} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
