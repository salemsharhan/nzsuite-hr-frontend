import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '../components/common/UIComponents';
import { Building2, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { signIn, signInAsEmployee, user, loading } = useAuth();
  const [loginType, setLoginType] = useState<'admin' | 'employee'>('admin');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Redirect if already logged in
    if (user && !loading) {
      // Redirect employees to their portal, admins to dashboard
      if (user.role === 'employee') {
        setLocation('/self-service');
      } else {
        setLocation('/');
      }
    }
  }, [user, loading, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (loginType === 'employee') {
        // Employee login with employee_id or external_id
        if (!employeeId.trim()) {
          setError('Please enter your Employee ID or External ID');
          setIsSubmitting(false);
          return;
        }
        
        const { error: signInError } = await signInAsEmployee(employeeId.trim(), password || '123456');
        
        if (signInError) {
          setError(signInError.message || 'Invalid Employee ID or password');
        } else {
          // Redirect to employee portal
          setLocation('/self-service');
        }
      } else {
        // Admin login with email
        const { error: signInError } = await signIn(email, password);
        
        if (signInError) {
          setError(signInError.message || 'Invalid email or password');
        } else {
          // Redirect will happen via useEffect
          setLocation('/');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold font-heading text-foreground mb-2">HR Management System</h1>
          <p className="text-muted-foreground">Sign in to your account</p>
        </div>

        {/* Login Card */}
        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Login Type Toggle */}
            <div className="flex gap-2 mb-4 p-1 bg-muted rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setLoginType('admin');
                  setError(null);
                }}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  loginType === 'admin'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Admin/Manager
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginType('employee');
                  setError(null);
                }}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  loginType === 'employee'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Employee
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {loginType === 'admin' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="pl-10 h-11"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                        className="pl-10 h-11"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Employee ID / External ID</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        type="text"
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        placeholder="Enter your Employee ID or External ID"
                        required
                        className="pl-10 h-11"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Default: 123456"
                        className="pl-10 h-11"
                        disabled={isSubmitting}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Default password: 123456</p>
                  </div>
                </>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full h-11"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-xs text-center text-muted-foreground">
                Need help? Contact your system administrator
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Role Information */}
        <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
          <p className="text-xs text-muted-foreground text-center mb-2">Available Roles:</p>
          <div className="flex flex-wrap gap-2 justify-center text-xs">
            <span className="px-2 py-1 rounded bg-primary/10 text-primary">Super Admin</span>
            <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-500">Admin</span>
            <span className="px-2 py-1 rounded bg-green-500/10 text-green-500">Employee</span>
          </div>
        </div>
      </div>
    </div>
  );
}


