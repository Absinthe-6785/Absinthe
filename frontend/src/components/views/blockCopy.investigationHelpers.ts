import type { Block } from './blockUtils';

export type TreeShape = {
  type: string;
  content?: string;
  checked?: boolean;
  collapsed?: boolean;
  indent?: number;
  children?: TreeShape[];
};

export function blockShape(blocks: Block[]): TreeShape[] {
  return blocks.map(b => ({
    type: b.type,
    content: b.content,
    ...(b.type === 'todo' ? { checked: b.checked } : {}),
    ...(b.type === 'toggle' ? { collapsed: b.collapsed } : {}),
    ...(b.type === 'bullet' || b.type === 'numbered' ? { indent: b.indent } : {}),
    children: b.children?.length ? blockShape(b.children) : undefined,
  }));
}
