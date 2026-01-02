import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./context/LanguageContext";
import { AuthProvider } from "./contexts/AuthContext";
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
import AnalyticsPage from "./pages/AnalyticsPage";
import AdminPage from "./pages/AdminPage";
import SettingsPage from "./pages/SettingsPage";
import HiringChecklistPage from "./pages/HiringChecklistPage";
import RolesPermissionsPage from "./pages/RolesPermissionsPage";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import MyRequestsPage from "./pages/MyRequestsPage";
import MyPayslipsPage from "./pages/MyPayslipsPage";
import LeaveManagementPage from "./pages/LeaveManagementPage";
import EmployeeLeavesPage from "./pages/EmployeeLeavesPage";
import EmployeeProfilePage from "./pages/EmployeeProfilePage";
import DocumentRequestsPage from "./pages/DocumentRequestsPage";
import EmployeeRequestsPage from "./pages/EmployeeRequestsPage";
import ImmigrationManagementPage from "./pages/ImmigrationManagementPage";
import EmployeeAttendancePage from "./pages/EmployeeAttendancePage";
import LoginPage from "./pages/LoginPage";
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
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route>
        <MainLayout>
          <Switch>
            <Route path="/" component={DashboardPage} />
            <Route path="/employees" component={EmployeeListPage} />
            <Route path="/employees/:id" component={EmployeeDetailPage} />
            <Route path="/attendance" component={AttendancePage} />
            <Route path="/payroll" component={PayrollPage} />
            <Route path="/setup" component={SetupPage} />
            <Route path="/leaves" component={LeaveManagementPage} />
            <Route path="/recruitment" component={RecruitmentPage} />
            <Route path="/ess" component={ESSPage} />
            <Route path="/self-service" component={EmployeeDashboard} />
            <Route path="/self-service/requests" component={MyRequestsPage} />
            <Route path="/self-service/payslips" component={MyPayslipsPage} />
            <Route path="/self-service/leaves" component={EmployeeLeavesPage} />
            <Route path="/self-service/profile" component={EmployeeProfilePage} />
            <Route path="/self-service/attendance" component={EmployeeAttendancePage} />
            <Route path="/timesheets" component={TimesheetsPage} />
            <Route path="/documents" component={DocumentsPage} />
            <Route path="/document-requests" component={DocumentRequestsPage} />
            <Route path="/employee-requests" component={EmployeeRequestsPage} />
            <Route path="/immigration" component={ImmigrationManagementPage} />
            <Route path="/analytics" component={AnalyticsPage} />
            <Route path="/admin" component={AdminPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route path="/hiring-checklist" component={HiringChecklistPage} />
            <Route path="/roles-permissions" component={RolesPermissionsPage} />
            
            {/* Fallback */}
            <Route component={NotFound} />
          </Switch>
        </MainLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider defaultTheme="dark">
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
