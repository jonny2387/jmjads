import React from 'react';

interface BrandLogoProps {
  siteName?: string;
  isDark: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  siteName = 'JMJ Ads',
  isDark,
  size = 'md',
}) => {
  const cleanName = siteName.trim() || 'JMJ Ads';
  const parts = cleanName.split(/\s+/);
  const firstPart = parts[0] || 'JMJ';
  const secondPart = parts.slice(1).join(' ') || 'Ads';

  const textSize =
    size === 'lg'
      ? 'text-2xl'
      : size === 'sm'
      ? 'text-sm'
      : 'text-[17px]';

  return (
    <span
      className={`inline-flex items-baseline font-extrabold tracking-tight leading-none select-none whitespace-nowrap ${textSize}`}
      style={{ fontFamily: "'Plus Jakarta Sans', 'Hind Siliguri', sans-serif" }}
    >
      <span className={isDark ? 'text-white' : 'text-[#180b28]'}>{firstPart}</span>
      <span className="text-amber-500 ml-0.5">{secondPart}</span>
    </span>
  );
};
