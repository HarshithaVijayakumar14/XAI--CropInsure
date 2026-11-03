import React from 'react';
import { Volume2, Square, Loader2 } from 'lucide-react';
import { useRole } from '../context/RoleContext';

interface SpeakButtonProps {
  text: string;
  id: string;
  lang?: string;
  label?: string;
  activeId?: string | null;
  isPlaying?: boolean;
  onSpeak: (text: string, lang: string, id: string) => void;
  onStop: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const SpeakButton: React.FC<SpeakButtonProps> = ({
  text,
  id,
  lang,
  label,
  activeId,
  isPlaying,
  onSpeak,
  onStop,
  size = 'sm',
  className = ''
}) => {
  const { language, t } = useRole();
  const currentLang = lang || language || 'kn-IN';
  const isThisPlaying = isPlaying && activeId === id;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isThisPlaying) {
      onStop();
    } else {
      onSpeak(text, currentLang, id);
    }
  };

  const defaultLabel = isThisPlaying
    ? t('dashboard.stopAudio') || 'Stop'
    : label || t('dashboard.listen') || 'Listen';

  const sizeClasses = {
    sm: 'px-2.5 py-1 text-xs gap-1.5',
    md: 'px-3 py-1.5 text-xs md:text-sm gap-2',
    lg: 'px-4 py-2 text-sm md:text-base gap-2.5'
  }[size];

  return (
    <button
      type="button"
      onClick={handleClick}
      title={isThisPlaying ? 'Stop playback' : 'Listen to this content aloud'}
      className={`inline-flex items-center rounded-full font-medium transition-all shadow-sm ${sizeClasses} ${
        isThisPlaying
          ? 'bg-rose-600 text-white hover:bg-rose-700 animate-pulse ring-2 ring-rose-400/40'
          : 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
      } ${className}`}
    >
      {isThisPlaying ? (
        <>
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>{t('dashboard.stopAudio') || 'Stop'}</span>
        </>
      ) : (
        <>
          <Volume2 className="w-3.5 h-3.5 text-emerald-700" />
          <span>{defaultLabel}</span>
        </>
      )}
    </button>
  );
};

