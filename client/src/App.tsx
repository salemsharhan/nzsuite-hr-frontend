import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./context/LanguageContext";
import { MainLayout } from "./components/layout/MainLayout";
import DashboardPage from "./pages/DashboardPage";
import EmployeeListPage from "./pages/EmployeeListPage";
import EmployeeDetailPage from "./pages/EmployeeDetailPage";
import AttendancePage from "./pages/AttendancePage";
import PayrollPage from "./pages/PayrollPage";
import SetupPage from "./pages/SetupPage";
import RecruitmentPage from "./pages/RecruitmentPage";
import ESSPage from "./pages/ESSPage";
import TimesheetsPage from "./pages/TimesheetsPage";
import LeavesPage from "./pages/LeavesPage";
import DocumentsPage from "./pages/DocumentsPage";
import './utils/i18n';

// Placeholder pages for routes not yet implemented
const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-3xl">🚧</div>
    <h2 className="text-2xl font-bold font-heading">{title}</h2>
    <p className="text-muted-foreground max-w-md">This module is currently under development. Check back soon for the full implementation.</p>
  </div>
);

function Router() {
  return (
    <MainLayout>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/employees" component={EmployeeListPage} />
        <Route path="/employees/:id" component={EmployeeDetailPage} />
        <Route path="/attendance" component={AttendancePage} />
        <Route path="/payroll" component={PayrollPage} />
        <Route path="/setup" component={SetupPage} />
        <Route path="/leaves" component={LeavesPage} />
        <Route path="/recruitment" component={RecruitmentPage} />
        <Route path="/ess" component={ESSPage} />
        <Route path="/timesheets" component={TimesheetsPage} />
        <Route path="/documents" component={DocumentsPage} />
        <Route path="/analytics" component={() => <PlaceholderPage title="Analytics & Reports" />} />
        <Route path="/admin" component={() => <PlaceholderPage title="Admin & Governance" />} />
        <Route path="/settings" component={() => <PlaceholderPage title="System Settings" />} />
        
        {/* Fallback */}
        <Route component={NotFound} />
      </Switch>
    </MainLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider defaultTheme="dark">
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
