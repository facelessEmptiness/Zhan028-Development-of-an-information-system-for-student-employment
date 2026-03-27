import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import App from '../App';
import {
  HomePage,
  LoginPage,
  RegisterPage,
  BrowseJobsPage,
  JobDetailsPage,
  StudentProfilePage,
  EmployerDashboardPage,
  UniversityAnalyticsPage,
  CandidateDetailPage,
  NotFoundPage,
  VerifyEmailPage,
  ForgotPasswordPage,
  ResetPasswordPage,
} from '../pages';
import { AuthProvider } from '../context';
import { ProtectedRoute } from '../components';
import RoleBasedRoute from '../components/RoleBasedRoute';

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/verify-email',
    element: <VerifyEmailPage />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      // Public routes (all authenticated users)
      {
        path: '/jobs',
        element: <ProtectedRoute><BrowseJobsPage /></ProtectedRoute>,
      },
      {
        path: '/job/:id',
        element: <ProtectedRoute><JobDetailsPage /></ProtectedRoute>,
      },

      // Student-only routes
      {
        path: '/profile',
        element: (
          <ProtectedRoute>
            <RoleBasedRoute allowedRoles={['student']}>
              <StudentProfilePage />
            </RoleBasedRoute>
          </ProtectedRoute>
        ),
      },
      {
        path: '/my-applications',
        element: (
          <ProtectedRoute>
            <RoleBasedRoute allowedRoles={['student']}>
              <StudentProfilePage />
            </RoleBasedRoute>
          </ProtectedRoute>
        ),
      },

      // Employer-only routes
      {
        path: '/employer-dashboard',
        element: (
          <ProtectedRoute>
            <RoleBasedRoute allowedRoles={['employer']}>
              <EmployerDashboardPage />
            </RoleBasedRoute>
          </ProtectedRoute>
        ),
      },
      {
        path: '/candidate/:id',
        element: (
          <ProtectedRoute>
            <RoleBasedRoute allowedRoles={['employer']}>
              <CandidateDetailPage />
            </RoleBasedRoute>
          </ProtectedRoute>
        ),
      },

      // University admin-only routes
      {
        path: '/analytics',
        element: (
          <ProtectedRoute>
            <RoleBasedRoute allowedRoles={['university', 'admin']}>
              <UniversityAnalyticsPage />
            </RoleBasedRoute>
          </ProtectedRoute>
        ),
      },
    ],
  },
]);

export const AppRouter = () => (
  <AuthProvider>
    <Toaster position="top-right" richColors closeButton duration={4000} />
    <RouterProvider router={router} />
  </AuthProvider>
);
