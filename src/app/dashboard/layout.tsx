'use client';

import Link from "next/link";
import Image from "next/image";
import {
  Bell,
  Camera,
  CircleUser,
  LayoutDashboard,
  Menu,
  Settings,
  Search,
  Video,
  LogOut,
  BarChart3,
  Sparkles,
  FileText,
  Mail,
  Phone,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { FloatingAIChat } from "@/components/floating-ai-chat";
import { AlertsProvider, useAlerts } from "@/contexts/AlertsContext";
import { ThemeToggle } from "@/components/theme-toggle";
import { MessageLoading } from "@/components/ui/message-loading";

function DashboardLayoutContent({ children }: { children: ReactNode }) {
  const { user, loading, logout, isAuthenticated } = useAuth();
  const { unreadCount } = useAlerts();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="scale-150">
            <MessageLoading />
          </div>
          <p className="text-sm font-medium text-muted-foreground animate-pulse tracking-wide">
            Preparing your dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }
  return (
    <div suppressHydrationWarning className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-16 items-center border-b px-4 lg:h-[72px] lg:px-6 py-2">
            <Link href="/" className="flex items-center">
              <Image src="/logo.png" alt="Cam4U Logo" width={220} height={56} className="object-contain dark:brightness-0 dark:invert transition-all" priority />
            </Link>
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              <Link
                href="/dashboard/monitoring"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <Video className="h-4 w-4" />
                Live Monitoring
              </Link>
              <Link
                href="/dashboard/alerts"
                className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2 text-primary transition-all hover:text-primary"
              >
                <Bell className="h-4 w-4" />
                Alerts
                {unreadCount > 0 && (
                  <Badge className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                    {unreadCount}
                  </Badge>
                )}
              </Link>
              <Link
                href="/dashboard/events"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <FileText className="h-4 w-4" />
                Events
              </Link>
              <Link
                href="/dashboard/cameras"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <Camera className="h-4 w-4" />
                Cameras
              </Link>
              <Link
                href="/dashboard/analytics"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <BarChart3 className="h-4 w-4" />
                Analytics
              </Link>

              <Link
                href="/dashboard/settings"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </nav>
          </div>
          <div className="mt-auto p-4">
            <Card>
              <CardHeader className="p-2 pt-0 md:p-4">
                <CardTitle>Need Help?</CardTitle>
                <CardDescription>
                  Contact support for any questions or issues.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-2 pt-0 md:p-4 md:pt-0 flex flex-col gap-2">
                <a href="mailto:bonthavijay1807@gmail.com?subject=Cam4U Support Request" className="w-full">
                  <Button size="sm" className="w-full justify-start text-sm">
                    <Mail className="mr-2 h-4 w-4" />
                    Email Support
                  </Button>
                </a>
                <a href="tel:+917286973788" className="w-full">
                  <Button size="sm" variant="outline" className="w-full justify-start text-sm">
                    <Phone className="mr-2 h-4 w-4" />
                    Call Support
                  </Button>
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <header className="flex h-16 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[72px] lg:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 md:hidden"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <SheetDescription className="sr-only">Main navigation links for the application.</SheetDescription>
              <nav className="grid gap-2 text-lg font-medium">
                <Link
                  href="#"
                  className="flex items-center mb-4"
                >
                  <Image src="/logo.png" alt="Cam4U Logo" width={220} height={56} className="object-contain dark:brightness-0 dark:invert transition-all" />
                </Link>
                <Link
                  href="/dashboard"
                  className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                >
                  <LayoutDashboard className="h-5 w-5" />
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/monitoring"
                  className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                >
                  <Video className="h-5 w-5" />
                  Live Monitoring
                </Link>
                <Link
                  href="/dashboard/alerts"
                  className="mx-[-0.65rem] flex items-center gap-4 rounded-xl bg-muted px-3 py-2 text-foreground hover:text-foreground"
                >
                  <Bell className="h-5 w-5" />
                  Alerts
                  {unreadCount > 0 && (
                    <Badge className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                      {unreadCount}
                    </Badge>
                  )}
                </Link>
                <Link
                  href="/dashboard/events"
                  className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                >
                  <FileText className="h-5 w-5" />
                  Events
                </Link>
                <Link
                  href="/dashboard/cameras"
                  className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                >
                  <Camera className="h-5 w-5" />
                  Cameras
                </Link>
                <Link
                  href="/dashboard/analytics"
                  className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                >
                  <BarChart3 className="h-5 w-5" />
                  Analytics
                </Link>

                <Link
                  href="/dashboard/settings"
                  className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                >
                  <Settings className="h-5 w-5" />
                  Settings
                </Link>
              </nav>
              <div className="mt-auto">
                <Card>
                  <CardHeader>
                    <CardTitle>Need Help?</CardTitle>
                    <CardDescription>
                      Contact support for any questions or issues.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <a href="mailto:bonthavijay1807@gmail.com?subject=Cam4U Support Request" className="w-full">
                      <Button size="sm" className="w-full justify-start text-sm">
                        <Mail className="mr-2 h-4 w-4" />
                        Email Support
                      </Button>
                    </a>
                    <a href="tel:+917286973788" className="w-full">
                      <Button size="sm" variant="outline" className="w-full justify-start text-sm">
                        <Phone className="mr-2 h-4 w-4" />
                        +91 7286973788
                      </Button>
                    </a>
                  </CardContent>
                </Card>
              </div>
            </SheetContent>
          </Sheet>
          <div className="w-full flex-1 min-w-0 flex items-center">
            {/* Search bar removed */}
            <Link href="/" className="md:hidden flex items-center ml-2 py-1">
              <Image src="/logo.png" alt="Cam4U Logo" width={180} height={46} className="object-contain dark:brightness-0 dark:invert transition-all" priority />
            </Link>
          </div>
          <Link
            href="/dashboard/alerts"
            className="relative flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
            title="Alerts"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground shadow-sm ring-2 ring-background animate-bounce">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
            <span className="sr-only">Alerts</span>
          </Link>
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full overflow-hidden">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <CircleUser className="h-5 w-5" />
                )}
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                {user ? `${user.firstName} ${user.lastName}` : 'User'}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem>Support</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          {children}
        </main>
      </div>
      <FloatingAIChat />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AlertsProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </AlertsProvider>
  );
}