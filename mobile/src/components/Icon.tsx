import React from 'react';
import { SvgXml } from 'react-native-svg';
import { STROKE_ICONS, type IconName } from './icons';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export default function Icon({ name, size = 20, color = '#374151' }: IconProps) {
  const paths = STROKE_ICONS[name].replace(/currentColor/g, color);
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  return <SvgXml xml={xml} width={size} height={size} />;
}
