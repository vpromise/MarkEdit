import { describe, expect, jest, test } from '@jest/globals';
import { Config } from '../src/config';
import { setUpQuickLook } from '../src/@quicklook';

describe('Quick Look Markdown preview', () => {
  test('prepares local images and navigable heading anchors', () => {
    document.body.innerHTML = '<main id="editor"></main>';
    setUpQuickLook({
      text: '# Local Section\n\n[Jump](#local-section)\n\n![Local](assets/image.png)',
    } as Config);

    const preview = document.querySelector('.markdown-preview');
    const heading = document.getElementById('local-section') as HTMLElement;
    const link = document.querySelector<HTMLAnchorElement>('a[href="#local-section"]');
    const image = document.querySelector<HTMLImageElement>('img[alt="Local"]');
    const scrollIntoView = jest.fn();
    heading.scrollIntoView = scrollIntoView;

    expect(preview).not.toBeNull();
    expect(image?.getAttribute('src')).toBe('image-loader://assets/image.png');

    link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
