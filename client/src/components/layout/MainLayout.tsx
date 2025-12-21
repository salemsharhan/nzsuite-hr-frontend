import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
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
  const [location] = useLocation();
  const { t } = useTranslation();
  const { direction } = useLanguage();

  // Mock user role - in a real app this would come from auth context
  const userRole = 'Admin'; // 'Admin' | 'Consultant' | 'Employee'

  const menuItems = [
    { icon: LayoutDashboard, label: t('common.dashboard'), href: '/', roles: ['Admin', 'Consultant', 'Employee'] },
    { icon: Users, label: t('common.employees'), href: '/employees', roles: ['Admin'] },
    { icon: Clock, label: t('common.attendance'), href: '/attendance', roles: ['Admin', 'Employee'] },
    { icon: Calendar, label: t('common.leaves'), href: '/leaves', roles: ['Admin', 'Employee'] },
    { icon: DollarSign, label: t('common.payroll'), href: '/payroll', roles: ['Admin'] },
    { icon: Users, label: 'Self Service', href: '/ess', roles: ['Admin', 'Employee', 'Consultant'] },
    { icon: Clock, label: 'Timesheets', href: '/timesheets', roles: ['Admin', 'Employee', 'Consultant'] },
    { icon: Briefcase, label: t('common.recruitment'), href: '/recruitment', roles: ['Admin'] },
    { icon: ClipboardCheck, label: 'Hiring Checklist', href: '/hiring-checklist', roles: ['Admin', 'Employee'] },
    { icon: FileText, label: t('common.documents'), href: '/documents', roles: ['Admin', 'Consultant'] },
    { icon: BarChart3, label: t('common.analytics'), href: '/analytics', roles: ['Admin'] },
    { icon: ShieldCheck, label: t('common.admin'), href: '/admin', roles: ['Admin'] },
    { icon: Settings, label: t('common.settings'), href: '/settings', roles: ['Admin'] },
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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
              <div className="w-4 h-4 border-2 border-white rounded-sm transform rotate-45" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-heading font-bold text-lg tracking-tight text-foreground">The System</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">Enterprise HR</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar">
          <div className="space-y-1">
            {!collapsed && <div className="px-3 mb-2 text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider">Main Menu</div>}
            {menuItems.filter(item => item.roles.includes(userRole)).map((item) => (
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
          <div className={cn(
            "flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer",
            collapsed ? "justify-center" : ""
          )}>
            <img 
              src="https://i.pravatar.cc/150?u=admin" 
              alt="User" 
              className="w-8 h-8 rounded-full border border-white/10"
            />
            {!collapsed && (
              <div className="flex-1 min-w-0 text-start">
                <div className="text-sm font-medium truncate text-foreground">Admin User</div>
                <div className="text-xs text-muted-foreground truncate">admin@thesystem.com</div>
              </div>
            )}
            {!collapsed && <LogOut size={16} className="text-muted-foreground hover:text-destructive transition-colors rtl:rotate-180" />}
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
