"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Button,
  Navbar as HeroUINavbar,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Avatar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  User as HeroUser,
  Image as HeroImage,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
} from "@heroui/react";
import { siteConfig } from "@/config/site";
import { isUserAdmin } from "@/lib/auth";
import { signOut, useSession } from "next-auth/react";
import { User } from "@supabase/supabase-js";
import { Settings } from "lucide-react";
import { GrUserAdmin } from "react-icons/gr";
import { addToast } from "@heroui/toast";
import ConnectionStatus from "./connection-status";
import { FaUser } from "react-icons/fa";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [displayName, setDisplayName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(status === "loading");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const connectionStatus = ConnectionStatus();

  useEffect(() => {
    setLoading(status === "loading");
    if (status === "authenticated") {
      // Set initial values from session immediately
      setDisplayName(session?.user?.name || session?.user?.email || "");
      setEmail(session?.user?.email || "");
      setAvatarUrl((session?.user as any)?.image || undefined);
      // Fetch authoritative profile from server to avoid stale names
      (async () => {
        try {
          const res = await fetch("/api/me/profile", { cache: "no-store" });
          if (!res.ok) return; // keep session defaults
          const json = await res.json();
          const p = json?.profile;
          if (p) {
            const fullName = `${p.first_name || ""} ${p.last_name || ""}`.trim();
            setDisplayName(fullName || session?.user?.email || "");
            setEmail(p.user_email || session?.user?.email || "");
            setAvatarUrl(p.avatar_url || (session as any)?.user?.image || undefined);
          }
        } catch {}
      })();
    }
  }, [status, session]);

  const handleSignOut = async () => {
    try {
      console.log('🔄 Signing out from navbar...');
      await signOut();
      
      addToast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
        color: "success",
      });
      
      // Use router.push instead of window.location for better navigation
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

  if (loading) {
    return (
      <HeroUINavbar className="bg-white border-b border-gray-200">
        <div className="w-full max-w-[992px] mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="h-8 w-32 bg-gray-200 animate-pulse rounded"></div>
            </div>
          </div>
        </div>
      </HeroUINavbar>
    );
  }

  return (
    <HeroUINavbar
      classNames={{
        base: "bg-white border-b border-gray-200 w-full flex items-center justify-between px-4 lg:px-10 h-20 relative z-20",
        wrapper: "w-full p-0",
      }}
      maxWidth="full"
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={() => setIsMenuOpen(!isMenuOpen)}
    >
      <NavbarContent className="flex items-center space-x-2 sm:hidden">
        <NavbarMenuToggle
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          onChange={() => setIsMenuOpen(!isMenuOpen)}
        />
      </NavbarContent>

      <NavbarContent className="flex items-center space-x-2">
        <NavbarBrand className="flex items-center space-x-2">
          <HeroImage
            alt="Virtual Xposure Logo"
            src="https://storage.googleapis.com/msgsndr/6mf1vLiHQTtwiHYT2ZIP/media/67deb6314bc20a1cba0a85f3.png"
            width={180}
          />
        </NavbarBrand>
      </NavbarContent>

      <NavbarContent
        className="hidden md:flex items-center space-x-1"
        justify="center"
      >
        {siteConfig.navItems.map((item) => (
          <NavbarItem key={item.name} className="flex items-center">
            <Button
              variant={`${item.href === pathname ? "flat" : "light"}`}
              className="text-gray-600 hover:text-gray-900"
              onPress={() => router.push(item.href)}
            >
              {item.name}
            </Button>
          </NavbarItem>
        ))}
      </NavbarContent>

      <NavbarMenu className="flex flex-col items-center justify-start">
        {siteConfig.navItems.map((item) => (
          <NavbarMenuItem key={item.name} className="w-full">
            <Button
              variant={`${item.href === pathname ? "flat" : "light"}`}
              className="text-gray-600 hover:text-gray-900 w-full"
              onPress={() => {
                setIsMenuOpen(!isMenuOpen);
                router.push(item.href);
              }}
            >
              {item.name}
            </Button>
          </NavbarMenuItem>
        ))}
      </NavbarMenu>

      <NavbarContent
        as="div"
        justify="end"
        className="flex items-center space-x-4"
      >
        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <div className="flex items-center">
              {/* Mobile version with connection status */}
              <div className="relative">
                <Avatar
                  as="button"
                   src={avatarUrl}
                  className="transition-transform flex md:hidden"
                   name={displayName}
                  size="md"
                  radius="sm"
                  isBordered={connectionStatus.isBordered}
                  // color={connectionStatus.color}
                  onClick={connectionStatus.onClick}
                  title={connectionStatus.title}
                />
              </div>
              {/* Desktop version with connection status */}
              <div className="relative hidden md:block">
                <HeroUser
                  as="button"
                   avatarProps={{
                    isBordered: connectionStatus.isBordered,
                    // color: connectionStatus.color,
                     src: avatarUrl,
                    showFallback: false,
                    fallback: <FaUser className="size-5" />,
                    radius: "sm", 
                    className: "mr-2",
                  }}
                  className="transition-transform"
                  description={email || undefined}
                  name={displayName}
                  onClick={connectionStatus.onClick}
                  title={connectionStatus.title}
                />
              </div>
            </div>
          </DropdownTrigger>

          <DropdownMenu aria-label="Profile actions" variant="flat">
            <DropdownItem key="profile" className="h-14 gap-2">
              <p className="font-semibold">Signed in as</p>
              <p className="font-semibold">{session?.user?.email}</p>
              {false && (
                <p className="text-xs text-blue-600 font-medium">Admin User</p>
              )}
            </DropdownItem>
            <DropdownItem
              key="settings"
              startContent={<Settings className="h-4 w-4" />}
              onPress={() => router.push("/settings")}
            >
              Settings
            </DropdownItem>
            {session?.user?.email?.toLowerCase().endsWith("@virtualxposure.com") ? (
              <DropdownItem
                key="admin"
                startContent={<GrUserAdmin className="h-4 w-4" />}
                onPress={() => router.push("/admin")}
              >
                Admin
              </DropdownItem>
            ) : null}
            <DropdownItem key="logout" color="danger" onPress={handleSignOut}>
              Sign Out
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </NavbarContent>
    </HeroUINavbar>
  );
}
