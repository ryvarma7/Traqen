import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { Raleway } from "next/font/google";
import ServiceWorkerRegister from "@/components/service-worker";
import { ProfileProvider } from "@/lib/profile-store";
import { TimerProvider } from "@/lib/timer-store";
import { ProfileRenameModal } from "@/components/shell/profile-rename-modal";
import { TimerPill } from "@/components/shell/timer-pill";
import "./globals.css";

const raleway = Raleway({
  subsets: ["latin"],
  variable: "--font-raleway",
});

export const metadata: Metadata = {
  title: "Traqen",
  description: "Track job applications, hackathons, tasks, and notes in one place.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Traqen",
  },
  icons: {
    icon: [
      { url: "/icon-16.png", sizes: "16x16",  type: "image/png" },
      { url: "/icon-32.png", sizes: "32x32",  type: "image/png" },
      { url: "/icon-96.png", sizes: "96x96",  type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/icon-180.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${raleway.variable} bg-background text-foreground antialiased`}
      >
        {/*
         * ProfileProvider sits at the app root so the top-bar avatar (in every
         * PageTransition) and the rename modal share one fetch of the user's
         * profile + one modal open-state. ProfileRenameModal renders from that
         * store and is mounted once here.
         *
         * TimerProvider does the same job for the session timer: one clock
         * shared by the top-bar trigger and the floating pill, so a countdown
         * keeps running across navigations. TimerPill is mounted here (not
         * inside PageTransition) so it survives every page and owns the single
         * bottom sheet.
         */}
        <ProfileProvider>
          <TimerProvider>
            {children}
            <ProfileRenameModal />
            <TimerPill />
          </TimerProvider>
        </ProfileProvider>
        <ServiceWorkerRegister />
        <Toaster position="top-right" toastOptions={{
          classNames: {
            toast: "!rounded-field !border-border !bg-surface !text-foreground !text-sm !shadow-lift",
          },
        }} />
      </body>
    </html>
  );
}
