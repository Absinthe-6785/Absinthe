import React, { Component, type ReactNode } from 'react';
import type { Block } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';
import { UnsupportedBlock } from './UnsupportedBlock';

export interface SafeBlockRendererProps {
  block: Block;
  colors: BlockEditorColors;
  children: ReactNode;
}

interface SafeBlockRendererState {
  error: Error | null;
}

/** Per-block error boundary — one broken block must not crash the document */
export class SafeBlockRenderer extends Component<SafeBlockRendererProps, SafeBlockRendererState> {
  state: SafeBlockRendererState = { error: null };

  static getDerivedStateFromError(error: Error): SafeBlockRendererState {
    return { error };
  }

  componentDidUpdate(prevProps: SafeBlockRendererProps) {
    if (prevProps.block.id !== this.props.block.id && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <UnsupportedBlock
          block={this.props.block}
          colors={this.props.colors}
          error={this.state.error}
        />
      );
    }
    return this.props.children;
  }
}
