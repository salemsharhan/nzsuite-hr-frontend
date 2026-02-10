import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  Clock,
  Calendar,
  FileText,
  User,
  LogOut,
  Menu,
  X,
  Bell,
  Settings,
  Sun,
  Moon,
  Globe
} from 'lucide-react';
import { cn } from '../common/UIComponents';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';

export const EmployeeLayout = ({ children }: { children: React.ReactNode }) => {
  const [location, setLocation] = useLocation();
  const { user, signOut } = useAuth();
  const { language, changeLanguage, direction } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const toggleLanguage = () => {
    changeLanguage(language === 'en' ? 'ar' : 'en');
  };

  // Get employee name
  const employeeName = user ? 
    (sessionStorage.getItem('employee_data') 
      ? JSON.parse(sessionStorage.getItem('employee_data') || '{}')?.first_name || 'Employee'
      : 'Employee')
    : 'Employee';

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Error during sign out:', error);
    } finally {
      sessionStorage.clear();
      localStorage.clear();
      setTimeout(() => {
        window.location.href = '/login';
      }, 100);
    }
  };

  const { t } = useTranslation();
  
  const navItems = [
    { icon: LayoutDashboard, label: t('common.dashboard'), href: '/self-service', exact: true },
    { icon: Clock, label: t('layout.attendance'), href: '/self-service/attendance' },
    { icon: Calendar, label: t('layout.leaves'), href: '/self-service/leaves' },
    { icon: FileText, label: t('layout.requests'), href: '/self-service/requests' },
    { icon: User, label: t('layout.profile'), href: '/self-service/profile' },
  ];

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return location === href;
    }
    return location.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans" dir={direction}>
      {/* Top Header - Mobile App Style */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-3">
            <img 
              src="/nzsuite-icon.png" 
              alt="NZSuite" 
              className="w-8 h-8"
            />
            <div>
              <h1 className="text-lg font-bold text-foreground">NZSuite</h1>
              <p className="text-xs text-muted-foreground">{t('common.employeePortal')}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleLanguage}
              className="p-2 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
              title={`Switch to ${language === 'en' ? 'Arabic' : 'English'}`}
            >
              <Globe size={16} />
              <span className="text-xs font-medium uppercase">{language}</span>
            </button>
            
            {toggleTheme && (
              <button 
                onClick={toggleTheme}
                className="p-2 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            )}
            
            <button className="p-2 hover:bg-muted rounded-full relative">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full border-2 border-background" />
            </button>
            
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 p-2 hover:bg-muted rounded-full"
              >
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
              </button>
              
              {showProfileMenu && (
                <div className={cn(
                  "absolute top-full mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-50",
                  direction === 'rtl' ? "left-0" : "right-0",
                  "max-w-[calc(100vw-2rem)]" // Ensure it doesn't overflow viewport
                )}>
                  <div className="p-3 border-b border-border">
                    <p className="font-medium text-sm truncate">{employeeName}</p>
                    <p className="text-xs text-muted-foreground">{t('common.employee')}</p>
                  </div>
                  <div className="p-1">
                    <Link href="/self-service/profile">
                      <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded-lg cursor-pointer text-sm">
                        <User className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{t('common.profile')}</span>
                      </div>
                    </Link>
                    <Link href="/self-service/settings">
                      <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded-lg cursor-pointer text-sm">
                        <Settings className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{t('common.settings')}</span>
                      </div>
                    </Link>
                    <div
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-destructive/10 text-destructive rounded-lg cursor-pointer text-sm"
                    >
                      <LogOut className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{t('common.logout')}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-16 pb-20 min-h-screen">
        <div className="max-w-md mx-auto px-4 py-4">
          {children}
        </div>
      </main>

      {/* Bottom Navigation Bar - Mobile App Style */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, item.exact);
            return (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  "flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-all cursor-pointer min-w-[60px]",
                  active 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}>
                  <Icon className={cn("w-5 h-5 transition-colors", active && "text-primary")} />
                  <span className={cn(
                    "text-[10px] font-medium transition-colors",
                    active && "text-primary"
                  )}>
                    {item.label}
                  </span>
                  {active && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Click outside to close profile menu */}
      {showProfileMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowProfileMenu(false)}
        />
      )}
    </div>
  );
};


