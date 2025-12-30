import React from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'super_admin' | 'admin' | 'employee' | Array<'super_admin' | 'admin' | 'employee'>;
  redirectTo?: string;
}

export default function ProtectedRoute({ 
  children, 
  requiredRole,
  redirectTo = '/login' 
}: ProtectedRouteProps) {
  const [, setLocation] = useLocation();
  const { user, loading, hasPermission } = useAuth();

  React.useEffect(() => {
    if (!loading && !user) {
      setLocation(redirectTo);
      return;
    }
    
    if (!loading && user && requiredRole) {
      const hasAccess = hasPermission(requiredRole);
      if (!hasAccess) {
        console.log('Access denied:', { userRole: user?.role, requiredRole, hasAccess });
        // Redirect to dashboard if user doesn't have required permission
        setLocation('/');
      }
    }
  }, [user, loading, requiredRole, redirectTo, setLocation]); // Removed hasPermission from deps

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  if (requiredRole && !hasPermission(requiredRole)) {
    return null; // Will redirect
  }

  return <>{children}</>;
}

