import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { landingPathFor } from '@/config/permissions';

/**
 * The root path sends each role to the first page it can actually open.
 * A fixed /dashboard would drop an employee on a page they are not allowed to
 * see, and ProtectedRoute would bounce them straight back off it.
 */
export default function RoleHome() {
  const { user } = useSelector((s) => s.auth);
  return <Navigate to={landingPathFor(user?.role)} replace />;
}
