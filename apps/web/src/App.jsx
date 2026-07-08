import { Routes, Route, Outlet } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import UserBar from "./components/UserBar.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import GamePage from "./pages/GamePage.jsx";
import CreateMapPage from "./pages/CreateMapPage.jsx";
import ManagePage from "./pages/ManagePage.jsx";

function Layout() {
  return (
    <>
      <UserBar />
      <Outlet />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="create" element={<CreateMapPage />} />
            <Route path="manage" element={<ManagePage />} />
          </Route>
          <Route path="game/:groupId" element={<GamePage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
