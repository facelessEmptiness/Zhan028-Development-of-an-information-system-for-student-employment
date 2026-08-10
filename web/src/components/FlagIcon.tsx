import { FLAG_ICONS, type FlagIconName } from './icons';

interface FlagIconProps {
  name: FlagIconName;
  size?: number;
  className?: string;
}

export default function FlagIcon({ name, size = 20, className }: FlagIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      dangerouslySetInnerHTML={{ __html: FLAG_ICONS[name] }}
    />
  );
}
