/**
 * blockIcons.tsx — Block type icons for editor menus
 */
import React, { type ReactNode } from 'react';
import {
  ChevronRight, Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare, Code2,
  Image as ImageIcon, Minus, Table2, Quote, Zap, Type,
} from 'lucide-react';
import type { BlockType } from './blockUtils';

export function blockIcon(type: BlockType): ReactNode {
  const s = 12;
  const map: Partial<Record<BlockType, ReactNode>> = {
    heading1: <Heading1 size={s}/>, heading2: <Heading2 size={s}/>, heading3: <Heading3 size={s}/>,
    bullet: <List size={s}/>, numbered: <ListOrdered size={s}/>, todo: <CheckSquare size={s}/>,
    code: <Code2 size={s}/>, image: <ImageIcon size={s}/>, divider: <Minus size={s}/>,
    table: <Table2 size={s}/>, quote: <Quote size={s}/>, callout: <Zap size={s}/>,
    toggle: <ChevronRight size={s}/>, math: <span style={{ fontSize: 11, fontWeight: 700 }}>∑</span>,
  };
  return map[type] ?? <Type size={s}/>;
}
