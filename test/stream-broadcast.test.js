const test = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough, Writable } = require('node:stream');
const { once } = require('node:events');
const { broadcastStream } = require('../stream-broadcast');

test('a stalled viewer is disconnected without interrupting another viewer', async t => {
    const source = new PassThrough();
    const received = [];
    const fast = new Writable({ write(chunk, encoding, done) { received.push(Buffer.from(chunk)); done(); } });
    const slow = new Writable({ write() { /* Simulate a viewer that never drains. */ } });
    t.after(() => { source.destroy(); fast.destroy(); slow.destroy(); });
    const responses = new Set([slow, fast]);
    slow.on('close', () => responses.delete(slow));
    broadcastStream(source, responses);

    const disconnected = once(slow, 'close');
    const chunks = Array.from({ length: 24 }, (_, index) => Buffer.alloc(64 * 1024, index));
    for (const chunk of chunks) source.write(chunk);
    await disconnected;

    assert.ok(slow.destroyed, 'the stalled viewer must not accumulate unbounded output');
    assert.ok(slow.writableLength <= 1024 * 1024);
    assert.ok(!source.isPaused(), 'one viewer must not pause the shared source');
    assert.deepEqual(Buffer.concat(received), Buffer.concat(chunks));

    const lastChunk = Buffer.from('stream continues after the slow viewer disconnects');
    source.write(lastChunk);
    assert.deepEqual(received.at(-1), lastChunk);
});
