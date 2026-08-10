import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '@store/index';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Suspense, lazy } from 'react';

// Layout
import MainLayout from '@layout/MainLayout';
import ProtectedRoute from '@components/shared/ProtectedRoute';
import RoleHome from '@components/shared/RoleHome';

// Loading fallback
function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20 animate-fade-in">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        <p className="text-sm text-surface-400">Loading...</p>
      </div>
    </div>
  );
}

// Auth
const Login = lazy(() => import('@pages/auth/Login'));
const Dashboard = lazy(() => import('@pages/dashboard/Dashboard'));

// Help / Knowledge Base
const KnowledgeBase = lazy(() => import('@pages/help/KnowledgeBase'));

// Settings
const SettingsLayout = lazy(() => import('@pages/settings/SettingsLayout'));
const CompanySettings = lazy(() => import('@pages/settings/CompanySettings'));
const DepartmentSettings = lazy(() => import('@pages/settings/DepartmentSettings'));
const SkillsSettings = lazy(() => import('@pages/settings/SkillsSettings'));
const AssetCatalog = lazy(() => import('@pages/settings/AssetCatalog'));
const SystemConfig = lazy(() => import('@pages/settings/SystemConfig'));

// Admin
const UserManagement = lazy(() => import('@pages/users/UserManagement'));
const AuditLog = lazy(() => import('@pages/audit/AuditLog'));

// Recruitment
const AtsPipeline = lazy(() => import('@pages/recruitment/AtsPipeline'));
const Candidates = lazy(() => import('@pages/recruitment/Candidates'));
const Vacancies = lazy(() => import('@pages/recruitment/Vacancies'));
const CVScorer = lazy(() => import('@pages/recruitment/CVScorer'));
const Applicants = lazy(() => import('@pages/recruitment/Applicants'));
const CareersJob = lazy(() => import('@pages/public/CareersJob'));

// Employee Lifecycle
const EmployeesPage = lazy(() => import('@pages/lifecycle/Employees'));
const OnboardingPage = lazy(() => import('@pages/lifecycle/Onboarding'));
const OnboardingV2Page = lazy(() => import('@pages/lifecycle/OnboardingV2'));
const QuickOfferPage = lazy(() => import('@pages/lifecycle/QuickOffer'));
const LeavePage = lazy(() => import('@pages/lifecycle/Leave'));
const AttendancePage = lazy(() => import('@pages/lifecycle/Attendance'));
const PayrollRunsPage = lazy(() => import('@pages/lifecycle/PayrollRuns'));
const SalaryReviewsPage = lazy(() => import('@pages/lifecycle/SalaryReviews'));
const AssetsPage = lazy(() => import('@pages/lifecycle/Assets'));
const PerformancePage = lazy(() => import('@pages/lifecycle/Performance'));
const OffboardingPage = lazy(() => import('@pages/lifecycle/Offboarding'));
const HandoverSheet = lazy(() => import('@pages/lifecycle/HandoverSheet'));
const InventoryPage = lazy(() => import('@pages/lifecycle/Inventory'));
const DigitalAccessPage = lazy(() => import('@pages/lifecycle/DigitalAccess'));
const SocialGovernancePage = lazy(() => import('@pages/lifecycle/SocialGovernance'));
const DomainsPage = lazy(() => import('@pages/lifecycle/Domains'));

// Portal
const MyAssets = lazy(() => import('@pages/portal/MyAssets'));

// Legal
const LegalLetters = lazy(() => import('@pages/legal/LegalLetters'));
const CompanyDocs = lazy(() => import('@pages/legal/CompanyDocs'));
const Payroll = lazy(() => import('@pages/legal/Payroll'));

// Analytics
const Reports = lazy(() => import('@pages/analytics/Reports'));
const OrgChart = lazy(() => import('@pages/analytics/OrgChart'));
const KPITracker = lazy(() => import('@pages/analytics/KPITracker'));
const EmailLog = lazy(() => import('@pages/admin/EmailLog'));

// Settings sub-pages
const EmailSettings = lazy(() => import('@pages/settings/EmailSettings'));
const TemplateManager = lazy(() => import('@pages/settings/TemplateManager'));

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Auth routes */}
            <Route path="/login" element={<Login />} />

            {/* Public recruitment landing page (no login, no app shell) */}
            <Route path="/careers/:slug" element={<CareersJob />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route path="/" element={<RoleHome />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/help" element={<KnowledgeBase />} />

                {/* Recruitment */}
                <Route path="/ats" element={<AtsPipeline />} />
                <Route path="/candidates" element={<Candidates />} />
                <Route path="/vacancies" element={<Vacancies />} />
                <Route path="/applicants" element={<Applicants />} />
                <Route path="/cv-scorer" element={<CVScorer />} />

                {/* Employee Lifecycle */}
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/onboarding" element={<OnboardingV2Page />} />
                <Route path="/onboarding/legacy" element={<OnboardingPage />} />
                <Route path="/quick-offer" element={<QuickOfferPage />} />
                <Route path="/leave" element={<LeavePage />} />
                <Route path="/attendance" element={<AttendancePage />} />
                <Route path="/payroll-runs" element={<PayrollRunsPage />} />
                <Route path="/salary-reviews" element={<SalaryReviewsPage />} />
                <Route path="/assets" element={<AssetsPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/digital-access" element={<DigitalAccessPage />} />
                <Route path="/social-governance" element={<SocialGovernancePage />} />
                <Route path="/domains" element={<DomainsPage />} />
                <Route path="/performance" element={<PerformancePage />} />
                <Route path="/offboarding" element={<OffboardingPage />} />

                {/* Portal */}
                <Route path="/portal/my-assets" element={<MyAssets />} />

                {/* Legal */}
                <Route path="/legal-letters" element={<LegalLetters />} />
                <Route path="/company-docs" element={<CompanyDocs />} />
                <Route path="/payroll" element={<Payroll />} />

                {/* Analytics */}
                <Route path="/reports" element={<Reports />} />
                <Route path="/audit" element={<AuditLog />} />
                <Route path="/kpi" element={<KPITracker />} />

                {/* Admin */}
                <Route path="/org-chart" element={<OrgChart />} />
                <Route path="/users" element={<UserManagement />} />
                <Route path="/settings" element={<SettingsLayout />}>
                  <Route index element={<Navigate to="/settings/companies" replace />} />
                  <Route path="companies" element={<CompanySettings />} />
                  <Route path="departments" element={<DepartmentSettings />} />
                  <Route path="skills" element={<SkillsSettings />} />
                  <Route path="catalog" element={<AssetCatalog />} />
                  <Route path="system" element={<SystemConfig />} />
                  <Route path="email" element={<EmailSettings />} />
                  <Route path="templates" element={<TemplateManager />} />
                </Route>
                <Route path="/email-log" element={<EmailLog />} />

                {/* 404 */}
                <Route path="*" element={
                  <div className="flex flex-col items-center justify-center py-20">
                    <h2 className="text-4xl font-bold text-surface-900">404</h2>
                    <p className="text-surface-500 mt-2">Page not found</p>
                  </div>
                } />
              </Route>
              <Route path="/offboarding/:id/handover-sheet" element={<HandoverSheet />} />
            </Route>
          </Routes>
        </Suspense>

        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
          toastClassName="!rounded-xl !shadow-card"
        />
      </BrowserRouter>
    </Provider>
  );
}
