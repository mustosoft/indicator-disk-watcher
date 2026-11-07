# Disk Watcher

Available filesystem space in your desktop's top panel:

```text
[disk icon] / - 4.8 GiB (5.7%) | /home - 6.4 GiB (4.1%)
```

Native integrations target **elementary OS 8 / Wingpanel 8** and **Ubuntu Desktop 24.04 / GNOME Shell 46**. Neither requires an AppIndicator bridge or `wingpanel-indicator-ayatana`. Stock desktop certification is pending; see [VALIDATION.md](VALIDATION.md).

Click the indicator to select actual local mounts, refresh immediately, or edit the interval. Press **Enter** after editing the interval (1–3600 seconds, default 30). Selections and interval persist per user. `/` is selected initially; the last selected filesystem cannot be unchecked. Selection order is preserved; remove and reselect an entry to put it last.

Free space means bytes available to ordinary users. Percentage is available bytes divided by total filesystem bytes; it may differ from `100 - df Use%` because of reserved blocks. Units use powers of 1024. Missing mounts remain selected and display `unavailable`. Network and pseudo filesystems are excluded. A `/home` directory on `/` is not a separate mount.

## elementary OS

Build dependencies (on stock elementary OS 8):

```sh
sudo apt install build-essential meson ninja-build valac libwingpanel-dev libgtk-3-dev libgee-0.8-dev dpkg-dev
meson setup build --prefix=/usr
meson compile -C build
python3 tools/package.py elementary
sudo apt install ./dist/indicator-disk-watcher-elementary_0.1.0_amd64.deb
```

Wingpanel can discover new plugins during a session. After installation finishes, invoke `io.elementary.wingpanel` to request a rescan if the indicator has not appeared; this forwards to the running panel rather than logging you out. This is distinct from a compatibility/tray plugin. The package is built for the current architecture and linked Wingpanel runtime; build it on the target baseline for release.

On this development host, the custom panel uses `/opt/gala-layer-shell/current/lib/wingpanel`, rather than the stock plugin directory. A symlink from that directory to the package's `/usr/lib/x86_64-linux-gnu/wingpanel/libdisk-watcher.so` was installed, and `/opt/gala-layer-shell/current/bin/io.elementary.wingpanel` requested a successful live rescan. A new custom panel release may need this symlink recreated. Stock installations do not need this host-specific adjustment.

Upgrade by installing the newer `.deb`, then log out/in. Remove with `sudo apt remove indicator-disk-watcher-elementary`, followed by logout/login to unload it. User settings remain unless explicitly reset.

## Ubuntu 24.04

No compilation is required for the extension. Package building requires Python 3, `glib-compile-schemas` (from `libglib2.0-bin`), and `dpkg-deb`.

```sh
python3 tools/package.py gnome
sudo apt install ./dist/indicator-disk-watcher-gnome_0.1.0_all.deb
```

Log out/in if this is the first installation, then enable for your user:

```sh
gnome-extensions enable disk-watcher@indicator-disk-watcher.github.io
```

Alternatively, install the per-user ZIP instead of the `.deb`:

```sh
gnome-extensions install --force dist/disk-watcher@indicator-disk-watcher.github.io.zip
```

Log out/in and enable as above. Use one installation method per user. Package scripts do not change your extension enable preferences. GNOME 46 is the declared supported Shell version; other releases need validation and potentially code updates.

Before uninstalling, run `gnome-extensions disable disk-watcher@indicator-disk-watcher.github.io`. Then remove the Debian package with `sudo apt remove indicator-disk-watcher-gnome`, or use `gnome-extensions uninstall disk-watcher@indicator-disk-watcher.github.io` for the ZIP installation. For updates, install the new package/ZIP and log out/in to reload code.

## Development and verification

```sh
npm test
valac elementary/core.vala tests/core.vala -X -lm -o /tmp/disk-watcher-core-test
/tmp/disk-watcher-core-test tests/format.tsv
glib-compile-schemas --strict schemas
GSETTINGS_SCHEMA_DIR="$PWD/schemas" GSETTINGS_BACKEND=memory /usr/bin/python3 tests/native-smoke.py
gjs -m tests/gjs-smoke.js
```

Node tests need no npm dependencies. The native smoke test requires the built plugin, GTK 3, Python GI, and a display, but installs nothing and uses memory-only settings. The GJS smoke test validates the real Unix mount API and asynchronous reads without requiring GNOME Shell. Shell UI behavior still needs a GNOME session.

Both frontends use the same GSettings schema and formatting fixtures. There is no daemon or external disk-monitoring process. See [VALIDATION.md](VALIDATION.md) for tested coverage and release gates.

## License

Copyright © 2026 Mustosoft.

Disk Watcher is free software licensed under the GNU General Public License, version 3 or (at your option) any later version (**GPL-3.0-or-later**). You may use, modify, and redistribute it under those terms. It comes without any warranty. See [LICENSE](LICENSE) for the full terms.
