import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { StudentApp } from "./components/student/StudentApp";
import { AdminApp } from "./components/admin/AdminApp";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function ProtectedAdminRoute() {
  const { user, loading } = useAuth();
  if (loading) return <p className="font-body text-muted-foreground p-8">Carregando...</p>;
  if (!user) return <AdminApp />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return <AdminApp />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<StudentApp />} />
            <Route path="/admin" element={<ProtectedAdminRoute />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
