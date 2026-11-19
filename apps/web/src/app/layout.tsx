import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TeamFlow — Projects, Tasks & Team Collaboration",
  description:
    "Bring your projects, tasks and people into one organised workspace. Plan clearly, collaborate confidently and keep work moving forward with TeamFlow.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ClerkProvider>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}