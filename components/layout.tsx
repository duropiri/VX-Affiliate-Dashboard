"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
  Button,
  DropdownItem,
  Dropdown,
  Avatar,
  DropdownTrigger,
  DropdownMenu,
} from "@heroui/react";
import {
  Home,
  Users,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { signOut } from "@/lib/auth";
import { addToast } from "@heroui/toast";

// Simple logo component
const Logo = () => (
  <svg
    fill="none"
    height="32"
    viewBox="0 0 32 32"
    width="32"
  >
    <path
      clipRule="evenodd"
      d="M17.6482 10.1305L15.8785 7.02583L7.02979 22.5499H10.5278L17.6482 10.1305ZM19.8798 14.0457L18.11 17.1983L19.394 19.4511H16.8453L15.1056 22.5499H24.7272L19.8798 14.0457Z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);

const navigationItems = [
  { name: "Home", href: "/home", icon: Home },
  { name: "Referrals", href: "/referrals", icon: Users },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Admin", href: "/admin", icon: Settings },
];

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [userAvatar, setUserAvatar] = useState<string>("");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
        setUserAvatar(user.user_metadata.avatar_url);
      }
    };
    getUser();
  }, []);

  const handleSignOut = async () => {
    try {
      console.log('🔄 Signing out from layout...');
      await signOut();
      
      addToast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
        color: "success",
      });
      
      router.push("/auth");
    } catch (error) {
      console.error("Error signing out:", error);
      addToast({
        title: "Sign Out Error",
        description: "There was an error signing out. Please try again.",
        color: "danger",
      });
      
      // Force redirect even if sign out fails
      router.push("/auth");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar onMenuOpenChange={setIsMenuOpen} className="border-b">
        <NavbarContent>
          <NavbarMenuToggle
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            className="sm:hidden"
          />
          <NavbarBrand>
            <Logo />
            <p className="font-bold text-inherit">VirtualXposure</p>
          </NavbarBrand>
        </NavbarContent>

        <NavbarContent className="hidden sm:flex gap-4" justify="center">
          {navigationItems.map((item) => (
            <NavbarItem key={item.name}>
              <Link color="foreground" href={item.href}>
                {/* <item.icon size={20} /> */}
                {item.name}
              </Link>
            </NavbarItem>
          ))}
        </NavbarContent>

        <NavbarContent as="div" justify="end">
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Avatar
                isBordered
                as="button"
                className="transition-transform"
                color="secondary"
                name={userEmail}
                size="sm"
                src={userAvatar}
              />
            </DropdownTrigger>
            <DropdownMenu aria-label="Profile Actions" variant="flat">
              <DropdownItem key="profile" className="h-14 gap-2">
                <p className="font-semibold">Signed in as</p>
                <p className="font-semibold">{userEmail}</p>
              </DropdownItem>
              <DropdownItem
                key="settings"
                onPress={() => router.push("/settings")}
                startContent={<Settings size={16} />}
              >
                My Settings
              </DropdownItem>
              <DropdownItem
                key="logout"
                color="danger"
                onPress={handleSignOut}
                startContent={<LogOut size={16} />}
              >
                Log Out
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </NavbarContent>
      </Navbar>

      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
