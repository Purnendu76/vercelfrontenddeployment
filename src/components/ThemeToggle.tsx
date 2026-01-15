import { ActionIcon, useMantineColorScheme, useComputedColorScheme } from '@mantine/core';
import { IconSun, IconMoon } from '@tabler/icons-react';

export function ThemeToggle({ size = 'lg', ...props }: any) {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });

  const toggleColorScheme = () => {
    setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <ActionIcon
      onClick={toggleColorScheme}
      variant="default"
      size={size}
      aria-label="Toggle color scheme"
      {...props}
    >
      {computedColorScheme === 'dark' ? (
        <IconSun size="1.2rem" stroke={1.5} />
      ) : (
        <IconMoon size="1.2rem" stroke={1.5} />
      )}
    </ActionIcon>
  );
}
