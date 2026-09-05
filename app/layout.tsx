import type { Metadata } from "next";
import { Toaster } from "sonner";
import { Lora } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  style: ["normal", "italic"],
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Traqen",
  description: "Track job applications, hackathons, tasks, and notes in one place.",
  icons: {
    icon: [
      { url: "/logo.png", sizes: "16x16",  type: "image/png" },
      { url: "/logo.png", sizes: "32x32",  type: "image/png" },
      { url: "/logo.png", sizes: "96x96",  type: "image/png" },
      { url: "/logo.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/logo.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/logo.png",
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
        className={`${lora.variable} ${geistMono.variable} bg-background text-foreground antialiased`}
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
