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
import { supabase } from "@/lib/supabase";
import { isUserAdmin } from "@/lib/auth";
import { User } from "@supabase/supabase-js";
import { Settings } from "lucide-react";
import { GrUserAdmin } from "react-icons/gr";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUser(user);
      } catch (error) {
        console.error("Error getting user:", error);
      } finally {
        setLoading(false);
      }
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = "/auth";
    } catch (error) {
      console.error("Error signing out:", error);
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
              {/* Mobile version */}
              <Avatar
                as="button"
                src={user?.user_metadata?.avatar_url}
                className="transition-transform flex md:hidden"
                name={user?.user_metadata?.full_name || user?.email}
                size="md"
              />
              {/* Desktop version */}
              <HeroUser
                as="button"
                avatarProps={{
                  isBordered: false,
                  src: user?.user_metadata?.avatar_url,
                }}
                className="transition-transform hidden md:flex"
                description={user?.email}
                name={user?.user_metadata?.full_name || user?.email}
              />
            </div>
          </DropdownTrigger>

          <DropdownMenu aria-label="Profile actions" variant="flat">
            <DropdownItem key="profile" className="h-14 gap-2">
              <p className="font-semibold">Signed in as</p>
              <p className="font-semibold">{user?.email}</p>
              {isUserAdmin(user) && (
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
            {isUserAdmin(user) ? (
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
