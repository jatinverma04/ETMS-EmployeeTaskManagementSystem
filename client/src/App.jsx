import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/common/ToastProvider';
import AppLayout from './layouts/AppLayout';
import DashboardPage from './pages/DashboardPage';
import EmployeeCreatePage from './pages/EmployeeCreatePage';
import EmployeeEditPage from './pages/EmployeeEditPage';
import EmployeeListPage from './pages/EmployeeListPage';
import EmployeeViewPage from './pages/EmployeeViewPage';
import NotFoundPage from './pages/NotFoundPage';
import TaskCreatePage from './pages/TaskCreatePage';
import TaskEditPage from './pages/TaskEditPage';
import TaskListPage from './pages/TaskListPage';
import TaskViewPage from './pages/TaskViewPage';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/employees" element={<EmployeeListPage />} />
            <Route path="/employees/new" element={<EmployeeCreatePage />} />
            <Route path="/employees/:id" element={<EmployeeViewPage />} />
            <Route path="/employees/:id/edit" element={<EmployeeEditPage />} />
            <Route path="/tasks" element={<TaskListPage />} />
            <Route path="/tasks/new" element={<TaskCreatePage />} />
            <Route path="/tasks/:id" element={<TaskViewPage />} />
            <Route path="/tasks/:id/edit" element={<TaskEditPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
