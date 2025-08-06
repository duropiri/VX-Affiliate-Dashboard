import { AuthGuard } from "@/components/auth-guard";
import { Navbar } from "@/components/navbar";

// Simple logo component

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <Navbar />

        <main className="container w-full max-w-[992px] mx-auto pt-4 lg:pt-6 px-4 relative pb-20">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
