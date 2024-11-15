export function useNav() {
  const mainNav = [
    {
      href: "/dashboard",
      name: "Dashboard",
      icon: "dashboard",
    },
    {
      href: "/dashboard/settings",
      name: "Settings",
      icon: "settings",
    },
    {
      href: "/dashboard/history",
      name: "History",
      icon: "description",
    },
    {
      href: "/dashboard/marketplace",
      name: "Marketplace",
      icon: "grid_view",
    },
    {
      href: "/dashboard/sessions",
      name: "Sessions",
      icon: "link",
    },
  ];

  return { mainNav };
}
