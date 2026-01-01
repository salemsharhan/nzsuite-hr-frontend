import React, { useState, useEffect, Suspense } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, 
  Users, 
  Clock, 
  Calendar, 
  DollarSign, 
  FileText, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Bell, 
  Search,
  Briefcase,
  BarChart3,
  ShieldCheck,
  Globe,
  ClipboardCheck
} from 'lucide-react';
import { cn } from '../common/UIComponents';

const SidebarItem = ({ icon: Icon, label, href, active, collapsed }: any) => (
  <Link href={href}>
    <div className={cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer group mb-1",
      active 
        ? "bg-primary/10 text-primary border border-primary/20 shadow-sm" 
        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
    )}>
      <Icon size={20} className={cn("transition-colors", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
      {!collapsed && <span className="font-medium text-sm">{label}</span>}
      {active && !collapsed && <div className="ml-auto rtl:mr-auto rtl:ml-0 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" />}
    </div>
  </Link>
);

export const Sidebar = ({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: any) => {
  const [location, setLocation] = useLocation();
  const { t } = useTranslation();
  const { direction } = useLanguage();
  const { user, signOut, loading } = useAuth();

  // Get user role from auth context
  const userRole = user?.role || 'employee'; // 'super_admin' | 'admin' | 'employee'

  // Helper function to check if user can access menu item
  const canAccessMenuItem = (allowedRoles: string[]) => {
    if (!userRole) return false;
    
    // Map role values
    if (userRole === 'super_admin') {
      // Super admin can access everything
      return true;
    }
    
    // Check if user role is in allowed roles
    return allowedRoles.includes(userRole);
  };

  const menuItems = [
    { icon: LayoutDashboard, label: t('common.dashboard'), href: '/', roles: ['super_admin', 'admin', 'employee'] },
    { icon: Users, label: t('common.employees'), href: '/employees', roles: ['super_admin', 'admin'] },
    { icon: Clock, label: t('common.attendance'), href: '/attendance', roles: ['super_admin', 'admin', 'employee'] },
    { icon: Calendar, label: t('common.leaves'), href: userRole === 'employee' ? '/self-service/leaves' : '/leaves', roles: ['super_admin', 'admin', 'employee'] },
    { icon: DollarSign, label: t('common.payroll'), href: '/payroll', roles: ['super_admin', 'admin'] },
    { icon: Users, label: 'Self Service', href: '/self-service', roles: ['super_admin', 'admin', 'employee'] },
    { icon: Clock, label: 'Timesheets', href: '/timesheets', roles: ['super_admin', 'admin', 'employee'] },
    { icon: Briefcase, label: t('common.recruitment'), href: '/recruitment', roles: ['super_admin', 'admin'] },
    { icon: ClipboardCheck, label: 'Hiring Checklist', href: '/hiring-checklist', roles: ['super_admin', 'admin', 'employee'] },
    { icon: FileText, label: t('common.documents'), href: '/documents', roles: ['super_admin', 'admin', 'employee'] },
    { icon: FileText, label: 'Document Requests', href: '/document-requests', roles: ['super_admin', 'admin'] },
    { icon: FileText, label: 'Employee Requests', href: '/employee-requests', roles: ['super_admin', 'admin'] },
    { icon: BarChart3, label: t('common.analytics'), href: '/analytics', roles: ['super_admin', 'admin'] },
    { icon: ShieldCheck, label: t('common.admin'), href: '/admin', roles: ['super_admin', 'admin'] },
    { icon: Settings, label: t('common.settings'), href: '/settings', roles: ['super_admin', 'admin'] },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={cn(
        "fixed top-0 z-50 h-screen bg-sidebar/80 backdrop-blur-xl border-r rtl:border-l rtl:border-r-0 border-white/10 transition-all duration-300 flex flex-col",
        collapsed ? "w-20" : "w-64",
        direction === 'ltr' ? "left-0" : "right-0",
        mobileOpen 
          ? "translate-x-0" 
          : direction === 'ltr' 
            ? "-translate-x-full lg:translate-x-0" 
            : "translate-x-full lg:translate-x-0"
      )}>
        {/* Logo Area */}
        <div className="h-16 flex items-center px-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <img 
              src="/nzsuite-icon.png" 
              alt="NZSuite" 
              className="w-8 h-8 shrink-0"
            />
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-heading font-bold text-lg tracking-tight text-foreground">NZSuite</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">Enterprise HR</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar">
          <div className="space-y-1">
            {!collapsed && <div className="px-3 mb-2 text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider">Main Menu</div>}
            {menuItems.filter(item => canAccessMenuItem(item.roles)).map((item) => (
              <SidebarItem 
                key={item.href}
                icon={item.icon}
                label={item.label}
                href={item.href}
                active={location === item.href}
                collapsed={collapsed}
              />
            ))}
          </div>
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-white/5">
          <div 
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              
              // Prevent multiple clicks
              if ((e.currentTarget as any).isLoggingOut) {
                return;
              }
              (e.currentTarget as any).isLoggingOut = true;
              
              try {
                // Sign out from Supabase
                await signOut();
              } catch (error) {
                console.error('Error during signOut:', error);
              }
              
              // Always clear storage and redirect, even if signOut fails
              try {
                sessionStorage.clear();
                localStorage.clear();
              } catch (storageError) {
                console.error('Error clearing storage:', storageError);
              }
              
              // Force redirect with full page reload
              setTimeout(() => {
                window.location.href = '/login';
              }, 100);
            }}
            className={cn(
              "flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer",
              collapsed ? "justify-center" : ""
            )}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.currentTarget.click();
              }
            }}
          >
            <img 
              src="https://i.pravatar.cc/150?u=admin" 
              alt="User" 
              className="w-8 h-8 rounded-full border border-white/10 pointer-events-none"
            />
            {!collapsed && (
              <div className="flex-1 min-w-0 text-start pointer-events-none">
                <div className="text-sm font-medium truncate text-foreground">
                  {(user as any)?.first_name || (user as any)?.last_name 
                    ? `${(user as any).first_name || ''} ${(user as any).last_name || ''}`.trim() 
                    : user?.email?.split('@')[0] || 'User'}
                </div>
                <div className="text-xs text-muted-foreground truncate">{user?.email || 'user@example.com'}</div>
              </div>
            )}
            {!collapsed && <LogOut size={16} className="text-muted-foreground hover:text-destructive transition-colors rtl:rotate-180 pointer-events-none" />}
          </div>
        </div>
      </aside>
    </>
  );
};

export const Topbar = ({ collapsed, setCollapsed, setMobileOpen }: any) => {
  const { t } = useTranslation();
  const { language, changeLanguage, direction } = useLanguage();

  const toggleLanguage = () => {
    changeLanguage(language === 'en' ? 'ar' : 'en');
  };

  return (
    <header className={cn(
      "fixed top-0 z-40 h-16 bg-background/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 transition-all duration-300",
      direction === 'ltr' 
        ? (collapsed ? "left-20 right-0" : "left-64 right-0") 
        : (collapsed ? "right-20 left-0" : "right-64 left-0"),
      "max-lg:left-0 max-lg:right-0"
    )}>
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setMobileOpen(true)}
          className="lg:hidden p-2 hover:bg-white/5 rounded-lg text-muted-foreground"
        >
          <Menu size={20} />
        </button>
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="max-lg:hidden p-2 hover:bg-white/5 rounded-lg text-muted-foreground transition-colors"
        >
          {collapsed ? <Menu size={20} /> : <X size={20} />}
        </button>
        
        {/* Search */}
        <div className="relative max-md:hidden">
          <Search size={16} className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder={t('common.search')}
            className="h-9 w-64 bg-white/5 border border-white/10 rounded-full pl-9 pr-4 rtl:pr-9 rtl:pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleLanguage}
            className="p-2 hover:bg-white/5 rounded-full text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
          >
            <Globe size={18} />
            <span className="text-sm font-medium uppercase">{language}</span>
          </button>
          
          <div className="h-6 w-px bg-white/10 mx-1" />
          
          <button className="p-2 hover:bg-white/5 rounded-full text-muted-foreground relative group">
            <Bell size={20} />
            <span className="absolute top-2 right-2 rtl:left-2 rtl:right-auto w-2 h-2 bg-destructive rounded-full border-2 border-background" />
          </button>
        </div>
      </div>
    </header>
  );
};

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { direction } = useLanguage();
  const [location, setLocation] = useLocation();
  const { user, loading } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      // Only redirect if not already on login page
      if (location !== '/login') {
        // Use hard redirect to ensure complete logout
        window.location.href = '/login';
      }
    }
  }, [user, loading, location]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render layout if user is not authenticated (will redirect)
  if (!user) {
    return null;
  }

  // Use EmployeeLayout for employees, regular layout for admins
  const isEmployee = user.role === 'employee';
  const isEmployeeRoute = location.startsWith('/self-service') || 
                          location === '/attendance' ||
                          (isEmployee && location === '/');

  if (isEmployee && isEmployeeRoute) {
    // Dynamic import to avoid circular dependencies
    const EmployeeLayout = React.lazy(() => import('./EmployeeLayout').then(m => ({ default: m.EmployeeLayout })));
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      }>
        <EmployeeLayout>{children}</EmployeeLayout>
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30" dir={direction}>
      <Sidebar 
        collapsed={collapsed} 
        setCollapsed={setCollapsed} 
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      
      <Topbar 
        collapsed={collapsed} 
        setCollapsed={setCollapsed}
        setMobileOpen={setMobileOpen}
      />

      <main className={cn(
        "pt-24 pb-12 px-6 transition-all duration-300 min-h-screen",
        direction === 'ltr'
          ? (collapsed ? "ml-20" : "ml-64")
          : (collapsed ? "mr-20" : "mr-64"),
        "max-lg:ml-0 max-lg:mr-0"
      )}>
        <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>
    </div>
  );
};
