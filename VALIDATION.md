# Validation record

Development host: elementary OS 8, Ubuntu 24.04 base, customized Pantheon session, Wingpanel development API 8.0.3. Checks performed November 7, 2026.

## Passed locally

- Full Vala/GTK/Wingpanel plugin compilation and dynamic initialization using the host's installed native Wingpanel runtime.
- Eleven JavaScript tests: formatting fixtures, unit promotion/rounding, percentage bounds, zero capacity, unavailable values, mount filtering, and interval validation.
- Same formatting fixtures executed against the compiled Vala implementation.
- GTK widget smoke test: live free-space text; `/` and `/home`; unavailable path; interval default, invalid value, 1/3600-second boundaries and repeated changes; last-selection protection; disposal with reads pending.
- GJS 1.80.2 smoke test: real GIO Unix mount discovery, monitor signal connect/disconnect, asynchronous filesystem query and formatting.
- GIO `filesystem::free` equals `statvfs.f_bavail * f_frsize` for both `/` and `/home` (ext4), excluding reserved blocks. Samples were taken consecutively.
- GNOME extension JavaScript syntax; strict settings-schema compilation.
- Built elementary Debian package, Ubuntu Debian package, and GNOME extension ZIP. elementary package uses Meson's installed plugin with build RPATH removed; dependencies generated using `dpkg-shlibdeps`.

Build dependencies were downloaded and extracted into ignored `.deps/` because administrator access was unavailable. No system packages or panel configuration were changed.

## Required before claiming stock compatibility

- Clean stock elementary OS 8: install/upgrade/remove package and verify actual panel placement, session persistence, X11/Wayland sessions offered by the OS, and operation without any Ayatana compatibility plugin.
- Clean Ubuntu Desktop 24.04 / GNOME 46: install/enable/upgrade/disable/remove using each supported installation method; verify real Shell menu input, switches, responsiveness and lifecycle.
- Disposable mounted filesystem: unmount/remount while reads are pending, paths with spaces, reserved-block calculation, allocation/deletion, stalled reads and recovery. Current tests cover nonexistent selection, not privileged mount operations.
- Real settings persistence across logout/login, sleep/resume, theme contrast, screen-reader output, display scaling and panel width with multiple entries.
- Timing/leak checks under repeated refresh, interval changes and extension enable/disable in the actual Shell.

The local GTK smoke test exercises widgets outside the panel. It does not establish stock desktop support or replace the clean-system acceptance checks above. VM images/sessions were not available in this workspace; these results remain unverified rather than inferred from the host.
