import type { SVGProps } from 'react';

const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export const PlayIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} fill="currentColor" stroke="none" {...p}><path d="M7 4.8v14.4c0 .8.9 1.3 1.6.9l11.2-7.2a1 1 0 0 0 0-1.7L8.6 3.9C7.9 3.5 7 4 7 4.8Z" /></svg>
);
export const PauseIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} fill="currentColor" stroke="none" {...p}><rect x="6" y="4.5" width="4.2" height="15" rx="1.2" /><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.2" /></svg>
);
export const NextIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} fill="currentColor" stroke="none" {...p}><path d="M5 5.6v12.8c0 .8.9 1.3 1.6.9l9.3-6.4a1 1 0 0 0 0-1.7L6.6 4.7C5.9 4.3 5 4.8 5 5.6Z" /><rect x="17" y="5" width="2.6" height="14" rx="1" /></svg>
);
export const PrevIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} fill="currentColor" stroke="none" {...p}><rect x="4.4" y="5" width="2.6" height="14" rx="1" /><path d="M19 5.6v12.8c0 .8-.9 1.3-1.6.9L8.1 12.9a1 1 0 0 1 0-1.7l9.3-6.4c.7-.4 1.6.1 1.6.9Z" /></svg>
);
export const GripIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 10 16" fill="currentColor" aria-hidden {...p}>
    {[2, 8, 14].map((y) => (<g key={y}><circle cx="2.5" cy={y} r="1.4" /><circle cx="7.5" cy={y} r="1.4" /></g>))}
  </svg>
);
export const TrashIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
);
export const ShareIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
);
export const ChatIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M4 5h16v11H9l-5 4V5Z" /></svg>
);
export const PeopleIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5M16 5.2a3 3 0 0 1 0 5.6M18 14.4c1.8.8 2.8 2.4 3 4.6" /></svg>
);
export const CrownIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8Z" /></svg>
);
export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const SendIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M4 12 20 4l-5 16-3.5-6.5L4 12Z" /></svg>
);
