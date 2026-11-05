import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { videoEmbedUrl } from './video';

test('turns Vimeo and YouTube links into player URLs', () => {
  assert.equal(videoEmbedUrl('https://vimeo.com/76979871'), 'https://player.vimeo.com/video/76979871');
  assert.equal(videoEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'https://www.youtube.com/embed/dQw4w9WgXcQ');
});

test('rejects links that are not videos', () => {
  assert.equal(videoEmbedUrl('https://drive.google.com/file/d/abc/view'), null);
});
