"use client";

import { Fab, Zoom } from "@mui/material";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { useState, useEffect } from "react";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => {
      const winTop = window.scrollY;
      const el = document.getElementById("scroll-container");
      const elTop = el ? el.scrollTop : 0;
      setVisible(winTop > 100 || elTop > 100);
    };
    window.addEventListener("scroll", handler, { passive: true });
    const el = document.getElementById("scroll-container");
    if (el) el.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => {
      window.removeEventListener("scroll", handler);
      if (el) el.removeEventListener("scroll", handler);
    };
  }, []);

  const scrollUp = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    const el = document.getElementById("scroll-container");
    if (el) el.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Zoom in={visible}>
      <Fab
        size="small"
        color="primary"
        onClick={scrollUp}
        sx={{ position: "fixed", bottom: 80, right: 24, zIndex: 1300 }}
      >
        <KeyboardArrowUpIcon />
      </Fab>
    </Zoom>
  );
}
