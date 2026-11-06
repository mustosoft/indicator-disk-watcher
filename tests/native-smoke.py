#!/usr/bin/python3
"""Exercise the built native widgets without installing or restarting Wingpanel.
Run with GSETTINGS_SCHEMA_DIR=$PWD/schemas GSETTINGS_BACKEND=memory.
Requires a desktop display and python3-gi with GTK 3.
"""
import ctypes
import time
import gi
from gi._gi import pygobject_new_full

gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gio, GLib

Gtk.init([])
lib = ctypes.CDLL('./build/libdisk-watcher.so')
wing = ctypes.CDLL('libwingpanel.so')
lib.disk_watcher_indicator_new.restype = ctypes.c_void_p
ptr = lib.disk_watcher_indicator_new()
obj = pygobject_new_full(ptr, False)


def widget(name):
    fn = getattr(wing, name)
    fn.argtypes = [ctypes.c_void_p]
    fn.restype = ctypes.c_void_p
    return pygobject_new_full(fn(ptr), False)


def pump():
    end = time.monotonic() + .3
    ctx = GLib.MainContext.default()
    while time.monotonic() < end:
        while ctx.pending():
            ctx.iteration(False)
        time.sleep(.005)


settings = Gio.Settings.new('io.github.indicator_disk_watcher')
display = widget('wingpanel_indicator_get_display_widget')
pump()
assert '/ - ' in display.get_children()[1].get_text()
assert 'unavailable' not in display.get_children()[1].get_text()
settings.set_strv('mounts', ['/', '/home', '/missing-disk-watcher-test'])
pump()
text = display.get_children()[1].get_text()
assert text.count(' | ') == 2, text
assert text.endswith('/missing-disk-watcher-test - unavailable'), text
menu = widget('wingpanel_indicator_get_widget')
input_widget = next(c for c in menu.get_children() if isinstance(c, Gtk.Entry))
input_widget.set_text('0')
input_widget.emit('activate')
assert settings.get_int('refresh-seconds') == 30
for seconds in (1, 3600, 30):
    input_widget.set_text(str(seconds))
    input_widget.emit('activate')
    assert settings.get_int('refresh-seconds') == seconds
    pump()
settings.set_strv('mounts', ['/'])
pump()
menu = widget('wingpanel_indicator_get_widget')
root = next(c for c in menu.get_children() if isinstance(c, Gtk.CheckButton) and c.get_label() == '/')
assert not root.get_sensitive()
settings.set_strv('mounts', ['/', '/home'])
obj.run_dispose()  # dispose with reads in flight
pump()
print('Native widget settings, multiple mounts, validation, and disposal passed')
