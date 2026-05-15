"use client";

import { Drawer, List, ListItemButton, ListItemIcon, ListItemText, Box } from "@mui/material";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { label: "Взаимодействия", path: "/interactions", icon: "🔗" },
  { label: "Инвентари", path: "/inventories", icon: "📦" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: 200,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: 200,
          bgcolor: "#121212",
          borderRight: "1px solid",
          borderColor: "divider",
          pt: 2,
        },
      }}
    >
      <List sx={{ px: 1 }}>
        {navItems.map((item) => (
          <ListItemButton
            key={item.path}
            selected={pathname === item.path}
            onClick={() => router.push(item.path)}
            sx={{
              borderRadius: 1,
              mb: 0.5,
              "&.Mui-selected": {
                bgcolor: "action.selected",
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, fontSize: 18 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
    </Drawer>
  );
}
