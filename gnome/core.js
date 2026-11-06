export function size(bytes) {
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    let value = Math.max(0, bytes), index = 0;
    while (value >= 1024 && index < units.length - 1) { value /= 1024; index++; }
    // Promote values that would round to 1024 in the smaller unit.
    if (Math.round(value * 10) >= 10240 && index < units.length - 1) { value /= 1024; index++; }
    return `${(Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, '')} ${units[index]}`;
}
export function entry(path, available, total) {
    if (available === null || total === null || available < 0 || total <= 0)
        return `${path} - unavailable`;
    const percent = Math.max(0, Math.min(100, available / total * 100));
    return `${path} - ${size(available)} (${(Math.round(percent * 10) / 10).toFixed(1)}%)`;
}
export function usable(path, type) {
    return path === '/' || (!['proc', 'sysfs', 'tmpfs', 'devtmpfs', 'squashfs', 'overlay', 'autofs', 'cgroup', 'cgroup2', 'nfs', 'nfs4', 'cifs', 'smb3', '9p'].includes(type)
        && !type.startsWith('fuse') && !['/proc', '/sys', '/dev', '/run', '/snap'].some(p => path === p || path.startsWith(`${p}/`)));
}
export function interval(text) {
    return /^\d+$/.test(text) && Number(text) >= 1 && Number(text) <= 3600 ? Number(text) : null;
}
