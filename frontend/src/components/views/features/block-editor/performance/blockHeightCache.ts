/**
 * Per-block measured height cache for virtual list sizing.
 */
export class BlockHeightCache {
  private readonly heights = new Map<string, number>();

  get(blockId: string): number | undefined {
    return this.heights.get(blockId);
  }

  set(blockId: string, height: number): void {
    if (height > 0 && Number.isFinite(height)) {
      this.heights.set(blockId, height);
    }
  }

  delete(blockId: string): void {
    this.heights.delete(blockId);
  }

  clear(): void {
    this.heights.clear();
  }

  /** Drop cached heights for block ids no longer in the document. */
  pruneStale(validIds: ReadonlySet<string>): number {
    let removed = 0;
    for (const id of [...this.heights.keys()]) {
      if (!validIds.has(id)) {
        this.heights.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  get size(): number {
    return this.heights.size;
  }

  entries(): IterableIterator<[string, number]> {
    return this.heights.entries();
  }
}
