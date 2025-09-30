import { AuthForm } from '@/components/auth/auth-form'
import ProtectedRoute from '@/components/auth/ProtectedRoute'

export default function AuthPage() {
  return (
    <ProtectedRoute requireAuth={false}>
      <AuthForm />
    </ProtectedRoute>
  )
}