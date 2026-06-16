import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// home pages  & dashboard
//import Dashboard from "./pages/dashboard";
const Dashboard = lazy(() => import("./pages/dashboard"));
const Ecommerce = lazy(() => import("./pages/dashboard/ecommerce"));
const CrmPage = lazy(() => import("./pages/dashboard/crm"));

const Login = lazy(() => import("./pages/auth/login"));
const Login2 = lazy(() => import("./pages/auth/login2"));
const Register = lazy(() => import("./pages/auth/register"));
const Register2 = lazy(() => import("./pages/auth/register2"));
const ForgotPass = lazy(() => import("./pages/auth/forgot-password"));
const ForgotPass2 = lazy(() => import("./pages/auth/forgot-password2"));
const Error = lazy(() => import("./pages/404"));

// components and elements pages
const Button = lazy(() => import("./pages/elements/button"));
const Dropdown = lazy(() => import("./pages/components/dropdown"));
const Badges = lazy(() => import("./pages/elements/badges"));
const Alert = lazy(() => import("./pages/elements/alert"));
const Progressbar = lazy(() => import("./pages/elements/progress"));
const Card = lazy(() => import("./pages/elements/card"));
const AvatarPage = lazy(() => import("./pages/elements/avatar"));
const Tooltip = lazy(() => import("./pages/elements/tooltip-popover"));
const Modal = lazy(() => import("./pages/components/modal"));
const Pagination = lazy(() => import("./pages/components/pagination"));
const AccrodainPage = lazy(() => import("./pages/components/accordion"));
const TabPage = lazy(() => import("./pages/components/tab"));
const Video = lazy(() => import("./pages/components/video"));
const SpinierPage = lazy(() => import("./pages/elements/spinier"));
const TimelinePage = lazy(() => import("./pages/components/timeline"));

// forms components
const InputPage = lazy(() => import("./pages/forms/input"));
const TextareaPage = lazy(() => import("./pages/forms/textarea"));
const CheckboxPage = lazy(() => import("./pages/forms/checkbox"));
const RadioPage = lazy(() => import("./pages/forms/radio-button"));
const SwitchPage = lazy(() => import("./pages/forms/switch"));
const InputGroupPage = lazy(() => import("./pages/forms/input-group"));
const InputMask = lazy(() => import("./pages/forms/input-mask"));
const FormValidation = lazy(() => import("./pages/forms/form-validation"));
const FileInput = lazy(() => import("./pages/forms/file-input"));
const FormRepeater = lazy(() => import("./pages/forms/form-repeater"));
const SelectPage = lazy(() => import("./pages/forms/select"));
const ReactSelectPage = lazy(() => import("./pages/forms/select/react-select"));
const Flatpicker = lazy(() => import("./pages/forms/date-time-picker"));

// chart page
const AppexLineChartPage = lazy(() => import("./pages/chart/appex-chart"));
const ChartJs = lazy(() => import("./pages/chart/chartjs"));
const Recharts = lazy(() => import("./pages/chart/recharts"));
const CalendarPage = lazy(() => import("./pages/app/calendar"));

// map page
const MapPage = lazy(() => import("./pages/map"));

// table pages
const BasicTablePage = lazy(() => import("./pages/table/table-basic"));
const TanstackTable = lazy(() => import("./pages/table/react-table"));

// utility pages
const InvoicePage = lazy(() => import("./pages/utility/invoice"));
const InvoiceAddPage = lazy(() => import("./pages/utility/add-invoice"));
const InvoicePreviewPage = lazy(() =>
  import("./pages/utility/invoice-preview")
);
const InvoiceEditPage = lazy(() => import("./pages/utility/edit-invoice"));
const PricingPage = lazy(() => import("./pages/utility/pricing"));
const BlankPage = lazy(() => import("./pages/utility/blank-page"));

const FaqPage = lazy(() => import("./pages/utility/faq"));
const Profile = lazy(() => import("./pages/utility/profile"));
const IconPage = lazy(() => import("./pages/icons"));
const NotificationPage = lazy(() => import("./pages/utility/notifications"));

// app page
const TodoPage = lazy(() => import("./pages/app/todo"));
const ChatPage = lazy(() => import("./pages/app/chat"));

const BoardsPage = lazy(() => import("./pages/app/boards"));
// const CalenderPage = lazy(() => import("./pages/app/calender"));
import Layout from "./layout/Layout";
import Loading from "@/components/Loading";
import AuthLayout from "./layout/AuthLayout";
function App() {
  return (
    <main className="App  relative">
      <Routes>
        <Route path="/" element={<AuthLayout />}>
          <Route path="/" element={<Login />} />
          <Route path="/login2" element={<Login2 />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register2" element={<Register2 />} />
          <Route path="/forgot-password" element={<ForgotPass />} />
          <Route path="/forgot-password2" element={<ForgotPass2 />} />
        </Route>

        <Route path="/*" element={<Layout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="ecommerce" element={<Ecommerce />} />
          <Route path="crm" element={<CrmPage />} />

          {/* App pages */}
          <Route path="todos" element={<TodoPage />} />
          <Route path="chats" element={<ChatPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="boards" element={<BoardsPage />} />
          {/* <Route path="calender" element={<CalenderPage />} /> */}
          {/* Components pages */}
          <Route path="button" element={<Button />} />
          <Route path="dropdown" element={<Dropdown />} />
          <Route path="badges" element={<Badges />} />
          <Route path="alert" element={<Alert />} />
          <Route path="progress" element={<Progressbar />} />
          <Route path="card" element={<Card />} />
          <Route path="avatar" element={<AvatarPage />} />
          <Route path="tooltip" element={<Tooltip />} />
          <Route path="timeline" element={<TimelinePage />} />
          <Route path="modal" element={<Modal />} />
          <Route path="pagination" element={<Pagination />} />
          <Route path="accordion" element={<AccrodainPage />} />
          <Route path="spinier" element={<SpinierPage />} />
          <Route path="tab" element={<TabPage />} />
          <Route path="video" element={<Video />} />
          <Route path="textfield" element={<InputPage />} />
          <Route path="textarea" element={<TextareaPage />} />
          <Route path="checkbox" element={<CheckboxPage />} />
          <Route path="radio" element={<RadioPage />} />
          <Route path="switch" element={<SwitchPage />} />
          <Route path="input-group" element={<InputGroupPage />} />
          <Route path="input-mask" element={<InputMask />} />
          <Route path="form-validation" element={<FormValidation />} />
          <Route path="file-input" element={<FileInput />} />
          <Route path="form-repeater" element={<FormRepeater />} />
          <Route path="select" element={<SelectPage />} />
          <Route path="react-select" element={<ReactSelectPage />} />
          <Route path="date-time-picker" element={<Flatpicker />} />
          <Route path="appex-chart" element={<AppexLineChartPage />} />
          <Route path="chartjs" element={<ChartJs />} />
          <Route path="recharts" element={<Recharts />} />
          <Route path="map" element={<MapPage />} />
          <Route path="table-basic" element={<BasicTablePage />} />
          <Route path="react_table" element={<TanstackTable />} />
          <Route path="invoice" element={<InvoicePage />} />
          <Route path="add-invoice" element={<InvoiceAddPage />} />
          <Route path="invoice-preview" element={<InvoicePreviewPage />} />
          <Route path="edit-invoice" element={<InvoiceEditPage />} />
          <Route path="pricing" element={<PricingPage />} />
          <Route path="blank-page" element={<BlankPage />} />
          <Route path="faq" element={<FaqPage />} />
          <Route path="profile" element={<Profile />} />
          <Route path="icons" element={<IconPage />} />
          <Route path="notifications" element={<NotificationPage />} />
          <Route path="*" element={<Navigate to="/404" />} />
        </Route>
        <Route
          path="/404"
          element={
            <Suspense fallback={<Loading />}>
              <Error />
            </Suspense>
          }
        />
      </Routes>
    </main>
  );
}

export default App;
