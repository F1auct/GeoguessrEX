import { Routes, Route, Outlet } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import NavBar from "./components/NavBar.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import GamePage from "./pages/GamePage.jsx";
import CreateMapPage from "./pages/CreateMapPage.jsx";
import ManagePage from "./pages/ManagePage.jsx";
import BountiesPage from "./pages/BountiesPage.jsx";
import BountyCreatePage from "./pages/BountyCreatePage.jsx";
import BountyDetailPage from "./pages/BountyDetailPage.jsx";
import GamesHubPage from "./pages/GamesHubPage.jsx";
import GameCreatePage from "./pages/GameCreatePage.jsx";
import GameDetailPage from "./pages/GameDetailPage.jsx";
import CommunityPage from "./pages/CommunityPage.jsx";
import CommunityCreatePage from "./pages/CommunityCreatePage.jsx";
import PostDetailPage from "./pages/PostDetailPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import MyEventsPage from "./pages/MyEventsPage.jsx";
import LeaderboardPage from "./pages/LeaderboardPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import DailyChallengePage from "./pages/DailyChallengePage.jsx";
import MarketplacePage from "./pages/MarketplacePage.jsx";
import TeamsPage from "./pages/TeamsPage.jsx";
import SeasonPage from "./pages/SeasonPage.jsx";
import PvPPage from "./pages/PvPPage.jsx";
import BRPage from "./pages/BRPage.jsx";
import AdminReviewPage from "./pages/AdminReviewPage.jsx";

function Layout() {
  return (
    <>
      <NavBar />
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
            <Route path="bounties" element={<BountiesPage />} />
            <Route path="bounties/create" element={<BountyCreatePage />} />
            <Route path="bounties/:id" element={<BountyDetailPage />} />
            <Route path="games" element={<GamesHubPage />} />
            <Route path="games/create" element={<GameCreatePage />} />
            <Route path="games/:id" element={<GameDetailPage />} />
            <Route path="community" element={<CommunityPage />} />
            <Route path="community/create" element={<CommunityCreatePage />} />
            <Route path="community/:id" element={<PostDetailPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="my-events" element={<MyEventsPage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="marketplace" element={<MarketplacePage />} />
            <Route path="daily" element={<DailyChallengePage />} />
            <Route path="teams" element={<TeamsPage />} />
            <Route path="season" element={<SeasonPage />} />
          </Route>
          <Route path="admin/reviews" element={<AdminReviewPage />} />
          <Route path="game/:groupId" element={<GamePage />} />
          <Route path="pvp" element={<PvPPage />} />
          <Route path="br" element={<BRPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
