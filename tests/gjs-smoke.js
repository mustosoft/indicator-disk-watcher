import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import GLib from 'gi://GLib';
import {usable, entry} from '../gnome/core.js';
const paths = GioUnix.mounts_get()[0].filter(m => usable(GioUnix.mount_get_mount_path(m), GioUnix.mount_get_fs_type(m))).map(m => GioUnix.mount_get_mount_path(m));
if (!paths.includes('/')) throw new Error('Root missing from mount discovery');
const monitor = GioUnix.MountMonitor.get();
const id = monitor.connect('mounts-changed', () => {});
monitor.disconnect(id);
const loop = new GLib.MainLoop(null, false);
Gio.File.new_for_path('/').query_filesystem_info_async('filesystem::size,filesystem::free', 0, null, (file, result) => {
    const info = file.query_filesystem_info_finish(result);
    const text = entry('/', info.get_attribute_uint64('filesystem::free'), info.get_attribute_uint64('filesystem::size'));
    if (text.includes('unavailable')) throw new Error(text);
    print(text);
    loop.quit();
});
loop.run();
print('GJS native mount discovery, monitor, and async query passed');
