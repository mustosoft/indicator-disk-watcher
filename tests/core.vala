int main (string[] args) {
    string content;
    try { FileUtils.get_contents (args[1], out content); }
    catch (Error e) { error ("%s", e.message); }
    foreach (string line in content.strip ().split ("\n")) {
        string[] fields = line.split ("|");
        string actual = DiskWatcher.entry (fields[0], double.parse (fields[1]), double.parse (fields[2]));
        if (actual != fields[3]) { stderr.printf ("Expected %s, got %s\n", fields[3], actual); return 1; }
    }
    assert (DiskWatcher.usable ("/media/user/My Drive", "ext4"));
    assert (!DiskWatcher.usable ("/run/user/1000", "tmpfs"));
    stdout.printf ("Vala formatting fixtures passed\n");
    return 0;
}
