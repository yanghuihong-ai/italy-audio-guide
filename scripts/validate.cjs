const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '../dist');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const context = vm.createContext({});
vm.runInContext(read('data.js') + '\n' + read('audio-manifest.js') + '\n' + read('image-manifest.js') + '\nthis.data={S,DAYS,AUDIO,PICTURES};', context);
const {S, DAYS, AUDIO, PICTURES} = context.data;
assert.equal(Object.keys(S).length, 58);
assert.equal(DAYS.length, 11);
assert.equal(Object.keys(AUDIO).length, 185);

// Routes contain presentation order, never private calendar or booking fields.
function checkRoute(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert(!/^(date|day|iso|time|reservation|booking|hotel|flight|phone|email)$/i.test(key), 'Private route field: ' + key);
    checkRoute(child);
  }
}
checkRoute(DAYS);
const seen = new Set();
for (const route of DAYS) {
  assert.match(route.label, /^路线 \d{2}$/);
  for (const stops of route.plans ? route.plans.map(p => p.stops) : [route.stops]) {
    for (const stop of stops) {
      assert(S[stop.id], 'Missing sight: ' + stop.id);
      seen.add(stop.id);
    }
  }
}
assert.equal(seen.size, Object.keys(S).length);

let count = 0, duration = 0;
for (const [id, sight] of Object.entries(S)) {
  // Inspect visitor-facing text, excluding historical dates in reference URLs.
  const display = JSON.stringify({...sight, sources: undefined});
  assert(!/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}:\d{2}\b|\d{1,2}月\d{1,2}[日号]/.test(display), 'Calendar or appointment detail: ' + id);
  sight.chapters.forEach((chapter, index) => {
    const clip = AUDIO[id + '-' + index];
    assert(clip, 'Missing audio: ' + id + '-' + index);
    const hash = crypto.createHash('sha256').update('zh-CN-XiaoxiaoNeural-8%' + chapter.text).digest('hex').slice(0, 12);
    assert.equal(clip.file, `audio/${id}-${index}-${hash}.mp3`, 'Narration and audio do not match');
    assert.equal(fs.statSync(path.join(root, clip.file)).size, clip.bytes);
    assert(clip.duration > 0);
    const images = PICTURES.chapters[id + '-' + index];
    assert(images && images.length > 0, 'Missing chapter illustration: ' + id + '-' + index);
    images.forEach(key => assert(PICTURES.assets[key], 'Unknown image: ' + key));
    count++; duration += clip.duration;
  });
}
assert.equal(count, Object.keys(AUDIO).length);
assert.equal(Object.keys(PICTURES.chapters).length, count);
for (const image of Object.values(PICTURES.assets)) {
  const buffer = fs.readFileSync(path.join(root, image.file));
  assert.equal(buffer.length, image.bytes);
  assert.equal(buffer.subarray(0, 2).toString('hex'), 'ffd8', 'Image must be a valid JPEG');
  assert(image.width > 0 && image.height > 0);
  assert.match(image.page, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
  assert.match(image.license, /^(CC BY|CC0|Public domain)/);
  assert(image.credit && image.title && image.licenseUrl.startsWith('https://'));
}
for (const file of ['content.js', 'stories.js', '.openai', '.git', '.env']) {
  assert(!fs.existsSync(path.join(root, file)), 'Private or obsolete source in publish directory: ' + file);
}
const html = read('index.html');
for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  const ref = match[1];
  if (/^(https?:|data:)/.test(ref)) continue;
  assert(!ref.startsWith('/'), 'Asset bypasses GitHub project path: ' + ref);
  assert(fs.existsSync(path.join(root, ref.split('?')[0])), 'Missing asset: ' + ref);
}
const manifest = JSON.parse(read('manifest.webmanifest'));
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');

// Verify offline seeking and that the worker ignores other GitHub projects.
async function checkWorker() {
  const handlers = {};
  const scope = 'https://example.github.io/italy-audio-guide/';
  const worker = vm.createContext({
    URL, Response, Request,
    self: {location: {href: scope + 'sw.js'}, registration: {scope}, addEventListener: (name, fn) => handlers[name] = fn},
  });
  vm.runInContext(read('sw.js') + '\nthis.rangeResponse=partial;', worker);
  const makeResponse = () => new Response(new Uint8Array(100), {headers: {'Content-Type': 'audio/mpeg'}});
  for (const [range, status, length, contentRange] of [
    ['bytes=10-19', 206, 10, 'bytes 10-19/100'],
    ['bytes=-8', 206, 8, 'bytes 92-99/100'],
    ['bytes=90-', 206, 10, 'bytes 90-99/100'],
    ['bytes=120-', 416, 0, 'bytes */100'],
  ]) {
    const response = await worker.rangeResponse(new Request(scope + 'audio/sample.mp3', {headers: {range}}), makeResponse());
    assert.equal(response.status, status);
    assert.equal((await response.arrayBuffer()).byteLength, length);
    assert.equal(response.headers.get('Content-Range'), contentRange);
    if (status === 206) assert.equal(response.headers.get('Content-Type'), 'audio/mpeg');
  }
  let intercepted = false;
  handlers.fetch({request: new Request('https://example.github.io/another-app/audio/sample.mp3'), respondWith: () => intercepted = true});
  assert.equal(intercepted, false);
}
checkWorker().then(() => console.log(`Validated ${seen.size} sights, ${DAYS.length} routes, ${count} matching audio clips (${(duration / 60).toFixed(1)} minutes), ${Object.keys(PICTURES.assets).length} licensed images, privacy and offline ranges.`)).catch(error => {console.error(error); process.exitCode = 1;});
