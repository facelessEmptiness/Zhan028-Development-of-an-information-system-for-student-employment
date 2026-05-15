import type { ReactNode } from "react"
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context';
import Icon from './Icon';

interface RoleBasedRouteProps {
  children: ReactNode;
  allowedRoles: string[];
}

const RoleBasedRoute = ({ children, allowedRoles }: RoleBasedRouteProps) => {
  const { isAuthenticated, user } = useAuth();

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If user role is not in allowed roles, redirect to home
  if (!allowedRoles.includes(user?.role || '')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 flex justify-center text-red-500"><Icon name="x-circle" size={56} /></div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-6">
            You don't have permission to access this page. This page is for {allowedRoles.join(', ')} only.
          </p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Go to Home
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default RoleBasedRoute;
