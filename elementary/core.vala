namespace DiskWatcher {
    public string size (double bytes) {
        string[] units = {"B", "KiB", "MiB", "GiB", "TiB"};
        double value = double.max (0, bytes);
        int index = 0;
        while (value >= 1024 && index < units.length - 1) { value /= 1024; index++; }
        if (Math.floor (value * 10 + 0.5) >= 10240 && index < units.length - 1) { value /= 1024; index++; }
        string number = "%.1f".printf (Math.floor (value * 10 + 0.5) / 10);
        if (number.has_suffix (".0")) number = number.substring (0, number.length - 2);
        return number + " " + units[index];
    }
    public string entry (string path, double available, double total) {
        if (available < 0 || total <= 0) return path + " - unavailable";
        double percent = double.max (0, double.min (100, available / total * 100));
        return "%s - %s (%.1f%%)".printf (path, size (available), Math.floor (percent * 10 + 0.5) / 10);
    }
    public bool usable (string path, string type) {
        if (path == "/") return true;
        string[] excluded = {"proc", "sysfs", "tmpfs", "devtmpfs", "squashfs", "overlay", "autofs", "cgroup", "cgroup2", "nfs", "nfs4", "cifs", "smb3", "9p"};
        if (type in excluded || type.has_prefix ("fuse")) return false;
        foreach (string prefix in new string[] {"/proc", "/sys", "/dev", "/run", "/snap"})
            if (path == prefix || path.has_prefix (prefix + "/")) return false;
        return true;
    }
}
