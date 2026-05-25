import React from 'react';
import { LegalMatter } from '../lib/matters';
import { Briefcase, Landmark, ShieldAlert, Scale, FileText } from 'lucide-react';

interface MatterCardProps {
  matter: LegalMatter;
  isSelected: boolean;
  onClick: () => void;
}

export const MatterCard: React.FC<MatterCardProps> = ({ matter, isSelected, onClick }) => {
  const getIcon = () => {
    switch (matter.practice) {
      case 'Criminal':
        return <ShieldAlert className={`w-4 h-4 ${isSelected ? 'text-red-400' : 'text-red-500/60'}`} />;
      case 'Corporate':
        return <Briefcase className={`w-4 h-4 ${isSelected ? 'text-blue-400' : 'text-blue-500/60'}`} />;
      case 'Property':
        return <Landmark className={`w-4 h-4 ${isSelected ? 'text-green-400' : 'text-green-500/60'}`} />;
      default:
        return <Scale className={`w-4 h-4 ${isSelected ? 'text-purple-400' : 'text-purple-500/60'}`} />;
    }
  };

  return (
    <button
      onClick={onClick}
      className={`group relative text-left p-5 rounded-2xl border transition-all duration-300 overflow-hidden cursor-pointer ${
        isSelected
          ? 'bg-zinc-900/60 border-zinc-700 shadow-premium-glow translate-y-[-2px] ring-1 ring-zinc-700/50'
          : 'bg-zinc-950/20 border-zinc-900/60 hover:border-zinc-800 hover:bg-zinc-900/30 hover:translate-y-[-1px]'
      }`}
    >
      {/* Decorative subtle background gradient flow */}
      <div className={`absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-tr from-white/[0.02] via-transparent to-transparent pointer-events-none rounded-2xl`} />
      
      <div className="flex justify-between items-start gap-4 mb-4 relative z-10">
        <span
          className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase border transition-colors ${matter.badgeColor}`}
        >
          {matter.practice}
        </span>
        <div className="flex items-center gap-1.5 text-zinc-500 group-hover:text-zinc-400 text-xs transition-colors">
          {getIcon()}
          <span className="font-medium text-[10px] tracking-wide uppercase">{matter.court}</span>
        </div>
      </div>

      <h3 className="text-zinc-200 font-semibold text-sm group-hover:text-zinc-100 mb-1.5 leading-snug tracking-tight transition-colors relative z-10">
        {matter.title}
      </h3>
      <p className="text-zinc-500 group-hover:text-zinc-400 text-xs line-clamp-2 leading-relaxed transition-colors relative z-10 font-normal">
        {matter.query}
      </p>

      {/* Modern thin active accent line at the bottom */}
      <div className={`absolute bottom-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 transition-transform duration-500 origin-left ${
        isSelected ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-50'
      }`} />
    </button>
  );
};

