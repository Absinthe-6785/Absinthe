import React from 'react';
import type { UseDragDropResult } from '../../../editorDragDrop';

export const DragCtx = React.createContext<UseDragDropResult | null>(null);
