import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { fetchCompanies } from '@store/slices/companiesSlice';
import Sidebar from '@components/partials/Sidebar';
import Topbar from '@components/partials/Topbar';
import ImpersonationBanner from '@components/partials/ImpersonationBanner';

export default function MainLayout() {
  const dispatch = useDispatch();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchCompanies());
  }, [dispatch]);

  return (
    <div className="flex h-screen bg-surface-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Above the topbar on purpose: whose account this is outranks anything
            else on screen while a "login as" session is running. */}
        <ImpersonationBanner />
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
