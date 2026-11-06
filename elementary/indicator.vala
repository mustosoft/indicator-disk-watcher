namespace DiskWatcher {
    class Request : Object {
        public Cancellable cancel = new Cancellable ();
        public uint timeout = 0;
    }
    public class Indicator : Wingpanel.Indicator {
        Settings settings;
        Gtk.Box display;
        Gtk.Label label;
        Gtk.Box menu;
        UnixMountMonitor monitor;
        HashTable<string, Request> pending = new HashTable<string, Request> (str_hash, str_equal);
        HashTable<string, string> values = new HashTable<string, string> (str_hash, str_equal);
        uint timer;
        uint resume;
        DBusConnection? bus;
        ulong changed;
        ulong mounts_changed;
        uint generation;
        bool alive = true;
        public Indicator () {
            Object (code_name: "disk-watcher");
            settings = new Settings ("io.github.indicator_disk_watcher");
            display = new Gtk.Box (Gtk.Orientation.HORIZONTAL, 6);
            display.pack_start (new Gtk.Image.from_icon_name ("drive-harddisk-symbolic", Gtk.IconSize.MENU), false, false);
            label = new Gtk.Label ("Loading…");
            display.pack_start (label, false, false);
            menu = new Gtk.Box (Gtk.Orientation.VERTICAL, 6);
            menu.margin = 12;
            changed = settings.changed.connect (() => reset ());
            monitor = UnixMountMonitor.get ();
            mounts_changed = monitor.mounts_changed.connect (() => reset ());
            try {
                bus = Bus.get_sync (BusType.SYSTEM);
                resume = bus.signal_subscribe ("org.freedesktop.login1", "org.freedesktop.login1.Manager", "PrepareForSleep", "/org/freedesktop/login1", null, DBusSignalFlags.NONE, (c,s,p,i,n,args) => {
                    bool sleeping; args.get ("(b)", out sleeping);
                    if (!sleeping) reset ();
                });
            } catch (Error e) { warning ("Resume monitoring: %s", e.message); }
            display.show_all ();
            visible = true;
            reset ();
        }
        string[] paths () {
            string[] selected = settings.get_strv ("mounts");
            return selected.length == 0 ? new string[] {"/"} : selected;
        }
        string[] mounts () {
            string[] result = {};
            foreach (unowned var mount in UnixMountEntry.get (null))
                if (usable (mount.get_mount_path (), mount.get_fs_type ())) result += mount.get_mount_path ();
            return result;
        }
        void reset () {
            generation++;
            pending.foreach ((p,r) => r.cancel.cancel ());
            values.remove_all ();
            if (timer != 0) Source.remove (timer);
            refresh ();
            timer = Timeout.add_seconds ((uint) settings.get_int ("refresh-seconds"), () => { refresh (); return Source.CONTINUE; });
        }
        void render () {
            if (!alive) return;
            string[] text = {};
            foreach (string path in paths ()) text += values.lookup (path) ?? entry (path, -1, 0);
            label.label = string.joinv (" | ", text);
            display.get_accessible ().set_name ("Available disk space: " + label.label);
        }
        void refresh () {
            string[] mounted = mounts ();
            foreach (string path in paths ()) {
                if (!(path in mounted)) { values.insert (path, entry (path, -1, 0)); continue; }
                if (!pending.contains (path)) query.begin (path);
            }
            render ();
        }
        async void query (string path) {
            var request = new Request ();
            pending.insert (path, request);
            uint epoch = generation;
            request.timeout = Timeout.add_seconds (5, () => {
                request.timeout = 0;
                request.cancel.cancel ();
                if (alive && epoch == generation) { values.insert (path, entry (path, -1, 0)); render (); }
                return Source.REMOVE;
            });
            string text = entry (path, -1, 0);
            try {
                var info = yield File.new_for_path (path).query_filesystem_info_async ("filesystem::free,filesystem::size", Priority.DEFAULT, request.cancel);
                if (info.has_attribute ("filesystem::free") && info.has_attribute ("filesystem::size"))
                    text = entry (path, (double) info.get_attribute_uint64 ("filesystem::free"), (double) info.get_attribute_uint64 ("filesystem::size"));
            } catch (Error e) { /* Keep unavailable and retry on the next refresh. */ }
            if (request.timeout != 0) Source.remove (request.timeout);
            pending.remove (path);
            if (!alive) return;
            if (epoch != generation) { refresh (); return; }
            values.insert (path, path in mounts () ? text : entry (path, -1, 0));
            render ();
        }
        void rebuild_menu () {
            foreach (var child in menu.get_children ()) child.destroy ();
            string[] selected = paths ();
            string[] all = selected;
            foreach (string path in mounts ()) if (!(path in all)) all += path;
            foreach (string path in all) {
                var check = new Gtk.CheckButton.with_label (path);
                check.active = path in selected;
                check.sensitive = !(selected.length == 1 && check.active);
                check.toggled.connect (() => {
                    string[] next = {};
                    foreach (string p in paths ()) if (p != path) next += p;
                    if (check.active) next += path;
                    if (next.length > 0) settings.set_strv ("mounts", next);
                    // Refresh sensitivity without destroying the active signal emitter.
                    Idle.add (() => { if (alive) rebuild_menu (); return Source.REMOVE; });
                });
                menu.pack_start (check, false, false);
            }
            menu.pack_start (new Gtk.Separator (Gtk.Orientation.HORIZONTAL), false, false);
            menu.pack_start (new Gtk.Label ("Refresh every (seconds):"), false, false);
            var input = new Gtk.Entry ();
            input.text = settings.get_int ("refresh-seconds").to_string ();
            input.input_purpose = Gtk.InputPurpose.DIGITS;
            menu.pack_start (input, false, false);
            var error = new Gtk.Label ("");
            menu.pack_start (error, false, false);
            input.activate.connect (() => {
                int seconds = 0;
                bool digits = input.text.length > 0;
                foreach (char c in input.text.to_utf8 ()) if (c < '0' || c > '9') digits = false;
                if (!digits || !int.try_parse (input.text, out seconds) || seconds < 1 || seconds > 3600)
                    error.label = "Enter a whole number from 1 to 3600.";
                else { settings.set_int ("refresh-seconds", seconds); error.label = "Saved"; }
            });
            var button = new Gtk.Button.with_label ("Refresh");
            button.clicked.connect (() => refresh ());
            menu.pack_start (button, false, false);
            menu.show_all ();
        }
        public override Gtk.Widget get_display_widget () { return display; }
        public override Gtk.Widget? get_widget () { rebuild_menu (); return menu; }
        public override void opened () { rebuild_menu (); }
        public override void closed () {}
        public override void dispose () {
            alive = false;
            generation++;
            if (timer != 0) { Source.remove (timer); timer = 0; }
            pending.foreach ((p,r) => { r.cancel.cancel (); if (r.timeout != 0) { Source.remove (r.timeout); r.timeout = 0; } });
            if (settings != null && changed != 0) { settings.disconnect (changed); changed = 0; }
            if (monitor != null && mounts_changed != 0) { monitor.disconnect (mounts_changed); mounts_changed = 0; }
            if (bus != null && resume != 0) { bus.signal_unsubscribe (resume); resume = 0; }
            base.dispose ();
        }
    }
}
public Wingpanel.Indicator? get_indicator (Module module, Wingpanel.IndicatorManager.ServerType server_type) {
    if (server_type != Wingpanel.IndicatorManager.ServerType.SESSION) return null;
    return new DiskWatcher.Indicator ();
}
