import type { Metadata } from "next";
import { Toaster } from "sonner";
import { Raleway } from "next/font/google";
import "./globals.css";

const raleway = Raleway({
  subsets: ["latin"],
  variable: "--font-raleway",
});

export const metadata: Metadata = {
  title: "Traqen",
  description: "Track job applications, hackathons, tasks, and notes in one place.",
  icons: {
    icon: [
      { url: "/tabIcon.png", sizes: "16x16",  type: "image/png" },
      { url: "/tabIcon.png", sizes: "32x32",  type: "image/png" },
      { url: "/tabIcon.png", sizes: "96x96",  type: "image/png" },
      { url: "/tabIcon.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/tabIcon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/tabIcon.png",
  },
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
        {children}
        <Toaster position="top-right" toastOptions={{
          classNames: {
            toast: "!rounded-field !border-border !bg-surface !text-foreground !text-sm !shadow-lift",
          },
        }} />
      </body>
    </html>
  );
}
