import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {entry, usable, interval} from './core.js';

export default class DiskWatcher extends Extension {
    enable() {
        this._alive = true;
        this._session = {};
        this._generation = 0;
        this._pending = new Map();
        this._values = new Map();
        this._settings = this.getSettings();
        this._button = new PanelMenu.Button(0, 'Disk Watcher');
        const box = new St.BoxLayout({style_class: 'panel-status-menu-box'});
        box.add_child(new St.Icon({icon_name: 'drive-harddisk-symbolic', style_class: 'system-status-icon'}));
        this._label = new St.Label({text: 'Loading…', y_align: Clutter.ActorAlign.CENTER});
        box.add_child(this._label);
        this._button.add_child(box);
        Main.panel.addToStatusArea(this.uuid, this._button);
        this._changed = this._settings.connect('changed', () => { this._reset(); });
        this._monitor = GioUnix.MountMonitor.get();
        this._mountChanged = this._monitor.connect('mounts-changed', () => this._reset());
        this._resume = Gio.DBus.system.signal_subscribe('org.freedesktop.login1', 'org.freedesktop.login1.Manager', 'PrepareForSleep', '/org/freedesktop/login1', null, Gio.DBusSignalFlags.NONE, (_c, _s, _p, _i, _n, args) => {
            if (!args.deep_unpack()[0]) this._reset();
        });
        this._menuOpen = this._button.menu.connect('open-state-changed', (_m, open) => { if (open) this._menu(); });
        this._reset();
    }
    _paths() { const paths = [...new Set(this._settings.get_strv('mounts'))]; return paths.length ? paths : ['/']; }
    _mounts() {
        return GioUnix.mounts_get()[0].filter(m => usable(GioUnix.mount_get_mount_path(m), GioUnix.mount_get_fs_type(m))).map(m => GioUnix.mount_get_mount_path(m));
    }
    _reset() {
        this._generation++;
        // Keep cancelled requests in the map until their callbacks finish: no retry pileup.
        for (const request of this._pending.values()) request.cancel.cancel();
        if (this._timer) GLib.Source.remove(this._timer);
        this._values.clear();
        this._refresh();
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this._settings.get_int('refresh-seconds'), () => { this._refresh(); return GLib.SOURCE_CONTINUE; });
    }
    _render() {
        if (!this._alive) return;
        const text = this._paths().map(p => this._values.get(p) ?? entry(p, null, null)).join(' | ');
        this._label.text = text;
        this._button.accessible_name = `Available disk space: ${text}`;
    }
    _refresh() {
        if (!this._alive) return;
        const mounted = new Set(this._mounts());
        for (const path of this._paths()) {
            if (!mounted.has(path)) { this._values.set(path, entry(path, null, null)); continue; }
            if (this._pending.has(path)) continue;
            const cancel = new Gio.Cancellable();
            const generation = this._generation;
            const request = {cancel, session: this._session};
            this._pending.set(path, request);
            request.timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
                request.timeout = 0;
                cancel.cancel();
                if (this._alive && generation === this._generation) { this._values.set(path, entry(path, null, null)); this._render(); }
                return GLib.SOURCE_REMOVE;
            });
            Gio.File.new_for_path(path).query_filesystem_info_async('filesystem::size,filesystem::free', GLib.PRIORITY_DEFAULT, cancel, (file, result) => {
                let value = entry(path, null, null);
                try {
                    const info = file.query_filesystem_info_finish(result);
                    if (info.has_attribute('filesystem::free') && info.has_attribute('filesystem::size'))
                        value = entry(path, info.get_attribute_uint64('filesystem::free'), info.get_attribute_uint64('filesystem::size'));
                } catch (_) { /* Render unavailable; next timer retries. */ }
                if (request.timeout) GLib.Source.remove(request.timeout);
                if (request.session !== this._session) return;
                this._pending.delete(path);
                if (!this._alive) return;
                if (generation !== this._generation) { this._refresh(); return; }
                this._values.set(path, this._mounts().includes(path) ? value : entry(path, null, null));
                this._render();
            });
        }
        this._render();
    }
    _menu() {
        const menu = this._button.menu;
        menu.removeAll();
        const selected = this._paths();
        const paths = [...new Set([...selected, ...this._mounts().sort()])];
        const switches = [];
        for (const path of paths) {
            const item = new PopupMenu.PopupSwitchMenuItem(path, selected.includes(path));
            item.setSensitive(!(selected.length === 1 && selected[0] === path));
            item.connect('toggled', (_item, active) => {
                const current = this._paths();
                const next = active ? [...current, path] : current.filter(p => p !== path);
                if (next.length) this._settings.set_strv('mounts', [...new Set(next)]);
                else item.setToggleState(true);
                const saved = this._paths();
                for (const [p, widget] of switches)
                    widget.setSensitive(!(saved.length === 1 && saved[0] === p));
            });
            switches.push([path, item]);
            menu.addMenuItem(item);
        }
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const row = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        row.add_child(new St.Label({text: 'Refresh every (seconds):'}));
        const input = new St.Entry({text: String(this._settings.get_int('refresh-seconds')), can_focus: true});
        row.add_child(input);
        menu.addMenuItem(row);
        const error = new PopupMenu.PopupMenuItem('', {reactive: false});
        menu.addMenuItem(error);
        input.clutter_text.connect('activate', () => {
            const seconds = interval(input.text);
            error.label.text = seconds === null ? 'Enter a whole number from 1 to 3600.' : 'Saved';
            if (seconds !== null) this._settings.set_int('refresh-seconds', seconds);
        });
        const refresh = new PopupMenu.PopupMenuItem('Refresh');
        refresh.connect('activate', () => this._refresh());
        menu.addMenuItem(refresh);
    }
    disable() {
        this._alive = false;
        this._generation++;
        if (this._timer) GLib.Source.remove(this._timer);
        this._timer = 0;
        for (const r of this._pending.values()) { r.cancel.cancel(); if (r.timeout) { GLib.Source.remove(r.timeout); r.timeout = 0; } }
        this._monitor.disconnect(this._mountChanged);
        Gio.DBus.system.signal_unsubscribe(this._resume);
        this._settings.disconnect(this._changed);
        this._button.destroy();
        this._settings = null;
    }
}
