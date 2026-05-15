"use client";

import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  colorSchemes: {
    dark: true,
  },
  typography: {
    fontFamily: 'var(--font-rubik), "Roboto", "Helvetica", "Arial", sans-serif',
  },
  cssVariables: {
    colorSchemeSelector: "class",
  },
});

export default theme;
