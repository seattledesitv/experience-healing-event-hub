import AppShell from "@/app/components/AppShell";
import { requireSuperAdmin } from "@/lib/access";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  return <AppShell isSuperAdmin>{children}</AppShell>;
}
