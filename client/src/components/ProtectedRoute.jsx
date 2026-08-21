import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from './ui/Spinner'

export const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <Spinner full />
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}

export const RoleRoute = ({ roles }) => {
  const { user } = useAuth()
  if (!roles.includes(user?.role)) return <Navigate to="/" replace />
  return <Outlet />
}

export const GuestRoute = () => {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <Spinner full />
  return isAuthenticated ? <Navigate to="/" replace /> : <Outlet />
}
