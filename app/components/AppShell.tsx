"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/dashboard", label: "Overview", icon: "⌂" },
  { href: "/events", label: "Events", icon: "▤" },
  { href: "/events?view=calendar", label: "Calendar", icon: "□" },
  { href: "/events/new", label: "Create Event", icon: "+" },
  { href: "/settings/connections", label: "Connections", icon: "◎" },
];

export default function AppShell({ children, isSuperAdmin = false }: { children: React.ReactNode; isSuperAdmin?: boolean }) {
  const pathname = usePathname();

  return (
    <div className="appFrame">
      <aside className="appSidebar">
        <div className="brandBlock">
          <div className="brandMark">EH</div>
          <div>
            <strong>Experience Healing</strong>
            <span>Event Hub</span>
          </div>
        </div>

        <nav className="sideNav">
          {nav.map((item) => {
            const active = item.href === "/dashboard"
              ? pathname === "/dashboard"
              : item.href.startsWith("/events")
                ? pathname.startsWith(item.href.split("?")[0]) && (item.label !== "Calendar")
                : pathname.startsWith(item.href);
            return (
              <Link key={item.label} className={active ? "sideNavItem active" : "sideNavItem"} href={item.href}>
                <span className="sideNavIcon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
          {isSuperAdmin ? (
            <Link className={pathname.startsWith("/admin/users") ? "sideNavItem active" : "sideNavItem"} href="/admin/users">
              <span className="sideNavIcon">♙</span><span>Users & Access</span>
            </Link>
          ) : null}
        </nav>

        <div className="sidebarQuote">
          <span>Heal your past</span>
          <strong>Restore your present</strong>
          <span>Embrace your future</span>
        </div>
      </aside>
      <div className="appContent">{children}</div>
    </div>
  );
}
