#!/usr/bin/env python3
"""Build desktop packages and GNOME extension ZIP without administrator access."""
import argparse
import pathlib
import shutil
import subprocess
import tempfile
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
UUID = 'disk-watcher@indicator-disk-watcher.github.io'
SCHEMA = ROOT / 'schemas/io.github.indicator_disk_watcher.gschema.xml'


def run(*args):
    return subprocess.check_output(args, text=True).strip()


def extension(destination):
    destination.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / 'LICENSE', destination / 'LICENSE')
    for name in ('metadata.json', 'extension.js', 'core.js'):
        shutil.copy2(ROOT / 'gnome' / name, destination / name)
    (destination / 'schemas').mkdir()
    shutil.copy2(SCHEMA, destination / 'schemas')
    run('glib-compile-schemas', '--strict', str(destination / 'schemas'))


def package(kind, out):
    with tempfile.TemporaryDirectory() as tmp:
        stage = pathlib.Path(tmp)
        if kind == 'gnome':
            extension(stage / 'usr/share/gnome-shell/extensions' / UUID)
            arch, deps = 'all', 'gnome-shell (>= 46~), gnome-shell (<< 47~)'
        else:
            plugin = ROOT / 'build/libdisk-watcher.so'
            if not plugin.exists():
                raise SystemExit('Build elementary plugin first: meson setup build --prefix=/usr && meson compile -C build')
            libdir = run('pkg-config', '--variable=indicatorsdir', 'wingpanel')
            run('meson', 'install', '-C', str(ROOT / 'build'), '--destdir', str(stage), '--no-rebuild')
            plugin = stage / libdir.lstrip('/') / 'libdisk-watcher.so'
            # Resolve library dependencies from the produced binary, including
            # the actual stock Wingpanel runtime package name.
            output = run('dpkg-shlibdeps', '-O', str(plugin))
            deps = next(line.split('=', 1)[1] for line in output.splitlines() if line.startswith('shlibs:Depends='))
            deps += ', dconf-gsettings-backend | gsettings-backend'
            arch = run('dpkg', '--print-architecture')
        docs = stage / f'usr/share/doc/indicator-disk-watcher-{kind}'
        docs.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / 'LICENSE', docs / 'LICENSE')
        shutil.copy2(ROOT / 'debian/copyright', docs / 'copyright')
        debian = stage / 'DEBIAN'
        debian.mkdir()
        (debian / 'control').write_text(f'''Package: indicator-disk-watcher-{kind}
Version: 0.1.0
Architecture: {arch}
Maintainer: Disk Watcher contributors <maintainers@indicator-disk-watcher.invalid>
Depends: {deps}
Section: utils
Priority: optional
Description: Available filesystem space in the desktop panel
 Native {kind} integration with configurable filesystems and refresh interval.
''')
        if kind == 'elementary':
            (debian / 'triggers').write_text('activate-noawait /usr/share/glib-2.0/schemas\n')
        run('dpkg-deb', '--root-owner-group', '--build', str(stage), str(out / f'indicator-disk-watcher-{kind}_0.1.0_{arch}.deb'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('target', choices=['gnome', 'elementary', 'all'])
    args = parser.parse_args()
    out = ROOT / 'dist'
    out.mkdir(exist_ok=True)
    if args.target in ('gnome', 'all'):
        with tempfile.TemporaryDirectory() as tmp:
            destination = pathlib.Path(tmp)
            extension(destination)
            with zipfile.ZipFile(out / f'{UUID}.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
                for file in destination.rglob('*'):
                    if file.is_file():
                        archive.write(file, file.relative_to(destination))
        package('gnome', out)
    if args.target in ('elementary', 'all'):
        package('elementary', out)
    print(f'Artifacts: {out}')


if __name__ == '__main__':
    main()
