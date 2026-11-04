import { useTheme } from 'state/theme/useTheme';
import Icon from './Icon';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const light = theme === 'light';
  const label = light ? 'Switch to dark mode' : 'Switch to light mode';
  return (
    <button type="button" onClick={toggle} title={label} aria-label={label}
      className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-surface-border text-zinc-400 hover:text-white hover:bg-surface-raised transition-colors ${className}`}>
      <Icon name={light ? 'moon' : 'sun'} />
      <span className="hidden sm:inline">{light ? 'Dark' : 'Light'}</span>
    </button>
  );
}
