import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import UpdateBanner from './UpdateBanner';

export default function AppLayout() {
  return (
    <div className="app">
      <UpdateBanner />
      <Navbar />
      <main className="main-content">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
