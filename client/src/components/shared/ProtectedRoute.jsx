import { useSelector, useDispatch } from 'react-redux';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { verifyToken } from '@store/slices/authSlice';
import { canAccessPath, landingPathFor } from '@/config/permissions';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute() {
  const dispatch = useDispatch();
  const location = useLocation();
  const { isAuthenticated, loading, user } = useSelector((state) => state.auth);

  useEffect(() => {
    const token = localStorage.getItem('ist_token');
    if (token && !isAuthenticated) {
      dispatch(verifyToken());
    }
  }, [dispatch, isAuthenticated]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="text-center animate-fade-in">
          <Loader2 className="w-10 h-10 text-brand-600 animate-spin mx-auto" />
          <p className="text-surface-500 mt-3 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // A role denied a module should land somewhere useful rather than on a page
  // that renders and then fills with 403s. The API is still the real gate.
  // The target comes from landingPathFor, not a hardcoded /dashboard: a role
  // that cannot open the dashboard either would redirect to itself forever.
  if (user?.role && !canAccessPath(user.role, location.pathname)) {
    return <Navigate to={landingPathFor(user.role)} replace />;
  }

  return <Outlet />;
}
