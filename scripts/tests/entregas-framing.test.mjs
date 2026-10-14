import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import postcss from 'postcss';

test('cropped thumbnails override the global small-screen image cap without affecting full photos', () => {
  const css = postcss.parse(readFileSync(new URL('../../src/modules/entregas/pages/entregas.css', import.meta.url), 'utf8'));
  let cropRule;
  css.walkRules('.entregas-card-photo .entregas-photo-crop', rule => { cropRule = rule; });
  assert.ok(cropRule, 'crop must have a scoped rule');
  const cap = cropRule.nodes.find(node => node.prop === 'max-width');
  assert.equal(cap?.value, 'none');
  assert.equal(cap?.important, true, 'global <=393px img cap is also important');
  assert.equal(cropRule.nodes.find(node => node.prop === 'object-fit')?.value, 'fill');
  let clipping;
  css.walkRules('.entregas-card-frame', rule => { clipping = rule.nodes.find(node => node.prop === 'overflow')?.value; });
  assert.equal(clipping, 'hidden', 'larger bitmap must stay inside its thumbnail');
});
