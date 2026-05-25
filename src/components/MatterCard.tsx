import React from 'react';
import { LegalMatter } from '../lib/matters';
import { Briefcase, Landmark, ShieldAlert } from 'lucide-react';

interface MatterCardProps {
  matter: LegalMatter;
  isSelected: boolean;
  onClick: () => void;
}

export const MatterCard: React.FC<MatterCardProps> = ({ matter, isSelected, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`relative text-left p-5 rounded-2xl border transition-all duration-300 overflow-hidden ${
        isSelected
          ? 'bg-zinc-900 border-zinc-700 shadow-[0_0_20px_rgba(255,255,255,0.05)] translate-y-[-2px]'
          : 'bg-zinc-950/40 border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/40'
      }`}
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/[0.02] to-transparent rounded-bl-full pointer-events-none" />
      
      <div className="flex justify-between items-start gap-4 mb-3">
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wide border ${matter.badgeColor}`}
        >
          {matter.practice}
        </span>
        <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
          <Landmark className="w-3.5 h-3.5" />
          <span>{matter.court}</span>
        </div>
      </div>

      <h3 className="text-zinc-100 font-semibold text-base mb-1.5 leading-tight">
        {matter.title}
      </h3>
      <p className="text-zinc-400 text-xs line-clamp-2 leading-relaxed">
        {matter.query}
      </p>

      {isSelected && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-red-500 via-blue-500 to-green-500" />
      )}
    </button>
  );
};
