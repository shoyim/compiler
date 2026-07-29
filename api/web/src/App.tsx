import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Users from '@/pages/Users';
import Tokens from '@/pages/Tokens';
import Jobs from '@/pages/Jobs';
import Tester from '@/pages/Tester';
import ApiDocs from '@/pages/ApiDocs';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/users" element={<Users />} />
        <Route path="/tokens" element={<Tokens />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/tester" element={<Tester />} />
        <Route path="/api-docs" element={<ApiDocs />} />
      </Routes>
    </BrowserRouter>
  );
}
