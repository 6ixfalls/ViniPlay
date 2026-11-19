const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const { EventEmitter, once } = require('node:events');
const { PassThrough } = require('node:stream');
const { streamCast } = require('../cast-stream');

function response() {
    const res = new PassThrough();
    res.statusCode = 200;
    res.status = code => { res.statusCode = code; return res; };
    res.headersSent = false;
    const chunks = [];
    res.on('data', chunk => { res.headersSent = true; chunks.push(chunk); });
    res.body = () => Buffer.concat(chunks).toString();
    return res;
}

function processStub() {
    const process = new EventEmitter();
    process.stdout = new PassThrough();
    process.exitCode = null;
    process.signalCode = null;
    process.killed = false;
    process.kill = () => { process.killed = true; return true; };
    return process;
}

test('Cast repackages codecs with the configured agent and streams MP4 output', async t => {
    const process = processStub();
    let args;
    t.mock.method(childProcess, 'spawn', (command, options) => {
        assert.equal(command, 'ffmpeg');
        args = options;
        return process;
    });
    const res = response();
    const finished = once(res, 'finish');
    streamCast('http://provider/live.ts', res, 'ViniPlay/Test');
    assert.equal(args[args.indexOf('-user_agent') + 1], 'ViniPlay/Test');
    assert.equal(args[args.indexOf('-i') + 1], 'http://provider/live.ts');
    assert.equal(args[args.indexOf('-c') + 1], 'copy');
    assert.equal(args[args.lastIndexOf('-f') + 1], 'mp4');
    process.stdout.end('fragmented-mp4');
    await once(process.stdout, 'end');
    process.exitCode = 0;
    process.emit('close', 0);
    await finished;
    assert.equal(res.body(), 'fragmented-mp4');
});

test('missing FFmpeg and rejected upstreams return a generic 502', async t => {
    for (const failure of ['spawn', 'exit']) {
        const process = processStub();
        t.mock.method(childProcess, 'spawn', () => process);
        const res = response();
        const finished = once(res, 'finish');
        streamCast('http://provider/private-token', res, 'ViniPlay/Test');
        if (failure === 'spawn') process.emit('error', new Error('private upstream diagnostics'));
        process.exitCode = failure === 'spawn' ? -2 : 1;
        process.emit('close', process.exitCode);
        await finished;
        assert.equal(res.statusCode, 502);
        assert.equal(res.body(), 'The Cast stream could not be played.');
    }
});

test('disconnecting a Cast receiver releases only its own remux process', async t => {
    const processes = [processStub(), processStub()];
    let index = 0;
    t.mock.method(childProcess, 'spawn', () => processes[index++]);
    const first = response(), second = response();
    streamCast('http://provider/live.ts', first, 'ViniPlay/Test');
    streamCast('http://provider/live.ts', second, 'ViniPlay/Test');
    const closed = once(first, 'close');
    first.destroy();
    await closed;
    assert.ok(processes[0].killed);
    assert.ok(!processes[1].killed);
    processes[0].signalCode = 'SIGTERM';
    processes[0].emit('close', null);
    second.destroy();
    await once(second, 'close');
    processes[1].signalCode = 'SIGTERM';
    processes[1].emit('close', null);
});
