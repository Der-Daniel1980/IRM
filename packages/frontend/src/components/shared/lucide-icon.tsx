import * as LucideIcons from 'lucide-react';

type LucideIconName = keyof typeof LucideIcons;

export function LucideIcon({
  name,
  ...props
}: { name: string } & LucideIcons.LucideProps) {
  const Icon = LucideIcons[name as LucideIconName] as
    | React.ComponentType<LucideIcons.LucideProps>
    | undefined;

  if (!Icon || typeof Icon !== 'function') {
    return <LucideIcons.HelpCircle {...props} />;
  }

  return <Icon {...props} />;
}
