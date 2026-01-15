import { AppShell, Burger, Group, Text, Image } from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { Outlet } from "react-router-dom";
import NavbarNested from "./navbar/NavbarNested";
import MobileBottomNav from "./navbar/MobileBottomNav";
import { ThemeToggle } from "./ThemeToggle";

export default function Layout() {
  const [, { close: closeMobile }] = useDisclosure();
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);
  const isDesktop = useMediaQuery('(min-width: 48em)');

  return (
    <AppShell
      padding="md"
      navbar={{
        width: 260,
        breakpoint: "sm",
        // Force mobile collapsed to true to "remove sidebar access" on mobile
        collapsed: { mobile: true, desktop: !desktopOpened },
      }}
      header={{ height: 60, collapsed: isDesktop }} 
    >
       <AppShell.Header hiddenFrom="sm">
        <Group h="100%" px="md" justify="space-between">
          <Group>
             {/* Desktop Burger */}
            <Burger 
              opened={desktopOpened} 
              onClick={toggleDesktop} 
              visibleFrom="sm" 
              size="sm" 
            />
            
            {/* Mobile Logo (replacing burger) */}
            <Group hiddenFrom="sm" gap="xs" wrap="nowrap">
                 <Image
                  src="https://annuprojects.com/wp-content/uploads/2024/03/logo.png"
                  alt="Annu Logo"
                  height={24}
                  width={24}
                  fit="contain"
                />
                <Text fw={700} size="sm" style={{ whiteSpace: 'nowrap' }}>Annu Projects Ltd.</Text>
            </Group>

            {/* Desktop Brand Text */}
            <Text fw={700} visibleFrom="sm">Annu Projects Ltd.</Text>
          </Group>

          {/* Theme Toggle - Mobile Only (Header) */}
          <Group hiddenFrom="sm">
            <ThemeToggle size="md" />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar>
        <NavbarNested onNavItemClick={closeMobile} />
      </AppShell.Navbar>

      <AppShell.Main pb={{ base: 80, sm: 0 }}>
        <div >
          <Outlet />
        </div>
      </AppShell.Main>
      
      <MobileBottomNav />
    </AppShell>
  );
}
