import { BarChart3, Home, Users, Settings, FolderOpen } from "lucide-react";

export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "VX Affiliate Dashboard",
  description: "Manage your VirtualXposure affiliate program with ease.",

  navItems: [
    { name: "Home", href: "/home", icon: Home },
    { name: "Referrals", href: "/referrals", icon: Users },
    { name: "Assets", href: "/assets", icon: FolderOpen },
    { name: "Reports", href: "/reports", icon: BarChart3 },
  ],
  links: {
    github: "https://github.com/heroui-inc/heroui",
    twitter: "https://twitter.com/hero_ui",
    docs: "https://heroui.com",
    discord: "https://discord.gg/9b6yyZKmH4",
    sponsor: "https://patreon.com/jrgarciadev",
  },
};
