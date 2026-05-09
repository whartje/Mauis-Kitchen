import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { UpgradeProvider } from "@/components/billing/upgrade-context";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <UpgradeProvider>
      <div className="flex h-screen bg-background overflow-hidden">
        {/* Desktop sidebar */}
        <Sidebar />

        {/* Main content — mobile-content-padding handles top/bottom clearance
            for the fixed bars + iOS safe areas (status bar & home indicator).
            That class is scoped to <768 px so desktop layout is unaffected. */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden mobile-content-padding md:pt-0 md:pb-0">
          <div className="container mx-auto px-4 py-6 max-w-6xl">
            {children}
          </div>
        </main>

        {/* Mobile bottom nav */}
        <MobileNav />
      </div>
    </UpgradeProvider>
  );
}
