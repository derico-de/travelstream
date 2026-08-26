import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';

import { stashSharedFiles, takeSharedFiles } from './share-store';

const file = (name: string, type: string, content = 'x') =>
  new File([content], name, { type, lastModified: 1_700_000_000_000 });

describe('share-store', () => {
  it('takes back what was stashed, oldest first, then is empty', async () => {
    await stashSharedFiles([file('a.jpg', 'image/jpeg'), file('b.mp4', 'video/mp4')]);
    const taken = await takeSharedFiles();
    expect(taken.map((f) => f.name)).toEqual(['a.jpg', 'b.mp4']);
    expect(taken[0].type).toBe('image/jpeg');
    expect(taken[0].lastModified).toBe(1_700_000_000_000);
    expect(await takeSharedFiles()).toEqual([]);
  });

  it('accumulates across consecutive shares', async () => {
    await stashSharedFiles([file('first.jpg', 'image/jpeg')]);
    await stashSharedFiles([file('second.jpg', 'image/jpeg')]);
    const taken = await takeSharedFiles();
    expect(taken.map((f) => f.name)).toEqual(['first.jpg', 'second.jpg']);
  });

  it('preserves file content through the stash', async () => {
    await stashSharedFiles([file('c.jpg', 'image/jpeg', 'payload')]);
    const [taken] = await takeSharedFiles();
    expect(await taken.text()).toBe('payload');
  });
});
