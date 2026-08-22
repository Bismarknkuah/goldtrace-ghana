import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Miners from "./pages/Miners";
import Batches from "./pages/Batches";
import BatchDetail from "./pages/BatchDetail";
import Transfers from "./pages/Transfers";
import Certificates from "./pages/Certificates";
import MapView from "./pages/MapView";
import Deliveries from "./pages/Deliveries";
import DeliveryTracking from "./pages/DeliveryTracking";
import CourierDashboard from "./pages/CourierDashboard";
import Receipts from "./pages/Receipts";
import Intelligence from "./pages/Intelligence";
import Revenue from "./pages/Revenue";
import TrackGold from "./pages/TrackGold";
import Security from "./pages/Security";
import Companies from "./pages/Companies";
import Licensing from "./pages/Licensing";
import Compliance from "./pages/Compliance";
import Profile from "./pages/Profile";
import Users from "./pages/Users";
import Transparency from "./pages/Transparency";
import Marketplace from "./pages/Marketplace";
import PurchaseRequests from "./pages/PurchaseRequests";
import Verify from "./pages/Verify";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="miners" element={<Miners />} />
          <Route path="batches" element={<Batches />} />
          <Route path="batches/:id" element={<BatchDetail />} />
          <Route path="transfers" element={<Transfers />} />
          <Route path="certificates" element={<Certificates />} />
          <Route path="deliveries" element={<Deliveries />} />
          <Route path="deliveries/:id" element={<DeliveryTracking />} />
          <Route path="courier" element={<CourierDashboard />} />
          <Route path="receipts" element={<Receipts />} />
          <Route path="intelligence" element={<Intelligence />} />
          <Route path="revenue" element={<Revenue />} />
          <Route path="map" element={<MapView />} />
          <Route path="track" element={<TrackGold />} />
          <Route path="security" element={<Security />} />
          <Route path="companies" element={<Companies />} />
          <Route path="licensing" element={<Licensing />} />
          <Route path="compliance" element={<Compliance />} />
          <Route path="verify" element={<Verify />} />
          <Route path="marketplace" element={<Marketplace />} />
          <Route path="requests" element={<PurchaseRequests />} />
          <Route path="transparency" element={<Transparency />} />
          <Route path="profile" element={<Profile />} />
          <Route path="users" element={<Users />} />
        </Route>
      </Route>
    </Routes>
  );
}
