import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {entry, interval, usable} from '../gnome/core.js';
for (const line of readFileSync(new URL('./format.tsv', import.meta.url), 'utf8').trim().split('\n')) {
    const [path, free, total, expected] = line.split('|');
    test(expected, () => assert.equal(entry(path, Number(free) < 0 ? null : Number(free), Number(total)), expected));
}
test('interval bounds and invalid input', () => {
    for (const s of ['1', '30', '3600']) assert.equal(interval(s), Number(s));
    for (const s of ['', '0', '-1', '3601', '1.5', 'abc', '30s', ' 30']) assert.equal(interval(s), null);
});
test('local mount discovery policy', () => {
    for (const path of ['/', '/home', '/media/user/My Drive']) assert.ok(usable(path, 'ext4'));
    for (const [path, type] of [['/snap/core/1', 'squashfs'], ['/proc', 'proc'], ['/run/user/1000', 'tmpfs'], ['/network', 'nfs'], ['/sys', 'sysfs']]) assert.equal(usable(path, type), false);
});
test('missing filesystem attributes', () => assert.equal(entry('/', null, 100), '/ - unavailable'));
