import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from '../App';
import { HomePage, LoginPage, RegisterPage, MySessionsPage } from '../pages';
import { AuthProvider } from '../context';
import { ProtectedRoute } from '../components';

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
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: '/my-sessions',
        element: <ProtectedRoute><MySessionsPage /></ProtectedRoute>,
      },
    ],
  },
]);

export const AppRouter = () => (
  <AuthProvider>
    <RouterProvider router={router} />
  </AuthProvider>
);
