import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/pricing/Sidebar";

export default function AppShell() {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
