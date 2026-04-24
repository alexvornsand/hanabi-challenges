import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchMaterialIconNames, _resetIconCache } from './materialIcons.js';

afterEach(() => {
  _resetIconCache();
  vi.restoreAllMocks();
});

describe('fetchMaterialIconNames', () => {
  it('returns a Set containing "home" and "star"', async () => {
    const icons = await fetchMaterialIconNames();
    expect(icons).toBeInstanceOf(Set);
    expect(icons.has('home')).toBe(true);
    expect(icons.has('star')).toBe(true);
  }, 10_000);

  it('Set does not contain nonexistent_xyz_abc_def_999', async () => {
    const icons = await fetchMaterialIconNames();
    expect(icons.has('nonexistent_xyz_abc_def_999')).toBe(false);
  }, 10_000);

  it('when fetch throws, returns empty Set without throwing', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network error'));
    const icons = await fetchMaterialIconNames();
    expect(icons).toBeInstanceOf(Set);
    expect(icons.size).toBe(0);
  });

  it('caches: second call returns same Set without re-fetching', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => 'home 1234\nstar 5678\n',
    } as Response);

    const first = await fetchMaterialIconNames();
    const second = await fetchMaterialIconNames();

    expect(first).toBe(second);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
