import AppShell from "@/app/components/AppShell";
import { requireApprovedUser } from "@/lib/access";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { access } = await requireApprovedUser();
  return <AppShell isSuperAdmin={access.role === "super_admin"}>{children}</AppShell>;
}
