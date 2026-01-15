import { Group, Paper, Text, Stack } from "@mantine/core";
import {
  IconDeviceDesktopAnalytics,
  IconFileInvoice,
  IconGauge,
  IconUsers,
} from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import { getUserRole } from "../../lib/utils/getUserRole";

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = getUserRole();
  // const user = parseJwt(token);

  // Filter links based on role (Same logic as NavbarNested)
  const mainLinksData = [
    { icon: IconGauge, label: "Dashboard", path: "/dashboard-2" },
    ...(role === "Admin"
      ? [
          { icon: IconFileInvoice, label: "Invoice", path: "/admin-invoice" }, // Label shortened for mobile
          { icon: IconUsers, label: "Users", path: "/users" },
          { icon: IconDeviceDesktopAnalytics, label: "Projects", path: "/projects" },
        ]
      : (role === "accountant"
        ? [  
            { icon: IconDeviceDesktopAnalytics, label: "Invoice", path: "/accountant-invoice" },
          ]
        : [  
            { icon: IconDeviceDesktopAnalytics, label: "Invoice", path: "/user-invoice" },
          ]
        )),
  ];

  return (
    <Paper 
      shadow="md" 
      radius={0} 
      p={0} 
      hiddenFrom="sm" 
      style={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        zIndex: 1000, 
        borderTop: '1px solid #e9ecef'
      }}
    >
      <Group justify="space-around" align="center" gap={0} style={{ height: 60 }}>
        {mainLinksData.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname.startsWith(link.path);
          return (
            <Stack 
              key={link.label} 
              align="center" 
              gap={2} 
              onClick={() => navigate(link.path)}
              style={{ 
                cursor: 'pointer', 
                flex: 1, 
                height: '100%', 
                justifyContent: 'center',
                color: isActive ? '#1971c2' : '#868e96' 
              }}
            >
              <Icon size={22} stroke={isActive ? 2 : 1.5} />
              <Text size="10px" fw={isActive ? 600 : 500} c={isActive ? "blue" : "dimmed"}>
                {link.label}
              </Text>
            </Stack>
          );
        })}
      </Group>
    </Paper>
  );
}
