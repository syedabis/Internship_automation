import AdminNav from '../_components/AdminNav';

export const metadata = {
  title: 'Submissions',
};

export default function AdminDashboardLayout({ children }) {
  return (
    <div className="min-h-screen">
      <AdminNav />
      <main className="mx-auto max-w-[1800px] px-6 py-6 md:px-10 lg:px-14">{children}</main>
    </div>
  );
}
