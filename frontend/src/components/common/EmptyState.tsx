import { ElementType } from 'react';
import { Theme } from '../../types';

interface EmptyStateProps {
  text: string;
  icon: ElementType;
  theme: Theme;
  onClick?: () => void;
}

export const EmptyState = ({ text, icon: Icon, theme, onClick }: EmptyStateProps) => (
  <div
    onClick={onClick}
    className={`flex flex-col items-center justify-center h-full opacity-50 ${theme.textMuted} p-6 text-center ${
      onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
    }`}
  >
    <Icon size={32} className="mb-3" />
    <p className="text-sm font-semibold">{text}</p>
  </div>
);
