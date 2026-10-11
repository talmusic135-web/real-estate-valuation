import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Sidebar } from "@/components/Sidebar";
import { DemoBanner } from "@/components/DemoBanner";

export const metadata: Metadata = {
  title: "ערך+ | הערכת שווי דירות למתווכים",
  description: "מערכת להערכת שווי דירות בישראל על בסיס עסקאות השוואה",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <DemoBanner />
            <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
