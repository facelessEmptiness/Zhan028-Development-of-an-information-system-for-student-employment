import React from 'react';
import { SvgXml } from 'react-native-svg';
import { FLAG_ICONS, type FlagIconName } from './icons';

interface FlagIconProps {
  name: FlagIconName;
  size?: number;
}

export default function FlagIcon({ name, size = 20 }: FlagIconProps) {
  const content = FLAG_ICONS[name];
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${content}</svg>`;
  return <SvgXml xml={xml} width={size} height={size} />;
}
