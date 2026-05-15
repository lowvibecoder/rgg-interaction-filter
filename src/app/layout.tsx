import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from "./theme";

const rubik = Rubik({
  subsets: ["cyrillic", "latin"],
  variable: "--font-rubik",
});

export const metadata: Metadata = {
  title: "Взаимодействия | RGG",
  description: "Взаимодействия между игроками RGG",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={rubik.variable}>
      <body>
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
