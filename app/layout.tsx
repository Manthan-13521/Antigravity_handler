import "./globals.css";

export const metadata = {
  title: "Antigravity Account Manager",
  description: "Personal account rotation and usage tracker",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="antialiased">
      <body className="bg-gray-900 text-gray-100 antialiased">
        <div className="min-h-screen bg-gray-900 text-gray-100">{children}</div>
      </body>
    </html>
  );
}