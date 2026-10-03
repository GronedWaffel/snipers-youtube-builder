// SPDX-License-Identifier: MIT
using System.Security.Cryptography;
using System.Text.Json;
using UFS2Tool;

if (args.Length == 2 && args[0] == "--inspect") {
    string input = Path.GetFullPath(args[1]);
    var files = new List<object>();
    using (var volume = new Ufs2Volume(input)) {
        foreach (var entry in volume.Entries.Where(e => !e.IsDirectory && !e.IsSymlink)) {
            using var data = volume.OpenFile(entry.Path);
            files.Add(new { path = entry.Path, bytes = entry.Size, mode = entry.Mode,
                uid = entry.Uid, gid = entry.Gid,
                sha256 = Convert.ToHexString(SHA256.HashData(data)).ToLowerInvariant() });
        }
    }
    using var image = new Ufs2Image(input, readOnly: true);
    var check = image.FsckUfs();
    Console.WriteLine(JsonSerializer.Serialize(new { image = input, files,
        errors = check.Errors }, new JsonSerializerOptions { WriteIndented = true }));
    return;
}

if (args.Length != 2) throw new ArgumentException("Usage: ImageBuilder SOURCE_DIRECTORY NEW_IMAGE");
string source = Path.GetFullPath(args[0]), output = Path.GetFullPath(args[1]);
if (!Directory.Exists(source) || File.Exists(output)) throw new IOException("Source missing or output already exists");
var creator = new Ufs2ImageCreator {
    FilesystemFormat = 2, BlockSize = 32768, FragmentSize = 4096, SectorSize = 512,
    SoftUpdates = false, SoftUpdatesJournal = false, NoSnapDir = true,
    Output = TextWriter.Null, ErrorOutput = Console.Error
};
creator.CreateImageFromDirectory(output, source, 336789504);
// Cobalt refreshes writable splash.html with the normal YouTube page. Keep
// that entry point read-only (0444), while allowing normal cache writes.
uint[] inodes;
uint splashInode;
using (var volume = new Ufs2Volume(output))
{
    inodes = volume.Entries.Select(e => e.InodeNumber).Append(2u).Distinct().ToArray();
    splashInode = volume.Entries.Single(e => e.Path == "cache/splash_screen/aHR0cHM6Ly93d3cueW91dHViZS5jb20vdHY=/splash.html").InodeNumber;
}
using (var image = new Ufs2Image(output, readOnly: false)) {
    foreach (uint number in inodes) {
        var inode = image.ReadInode(number);
        inode.Mode = (ushort)((inode.Mode & 0xf000) | (number == splashInode ? 0x124 : 0x1ff));
        image.WriteInode(number, inode);
    }
}
var receipt = new List<object>();
using (var volume = new Ufs2Volume(output)) {
    var entries = volume.Entries.Where(e => !e.IsDirectory).ToArray();
    string[] sources = Directory.GetFiles(source, "*", SearchOption.AllDirectories);
    if (entries.Length != sources.Length) throw new IOException("Image file inventory mismatch");
    foreach (string path in sources) {
        string relative = Path.GetRelativePath(source, path).Replace('\\', '/');
        using var original = File.OpenRead(path);
        using var stored = volume.OpenFile(relative);
        string expected = Convert.ToHexString(SHA256.HashData(original)).ToLowerInvariant();
        string actual = Convert.ToHexString(SHA256.HashData(stored)).ToLowerInvariant();
        if (expected != actual) throw new IOException("Image readback mismatch: " + relative);
        var entry = entries.Single(e => e.Path == relative);
        receipt.Add(new { path = relative, sha256 = actual, mode = entry.Mode & 0x1ff });
    }
    if (volume.Entries.Any(e => (e.Mode & 0x1ff) != (e.InodeNumber == splashInode ? 0x124 : 0x1ff)))
        throw new IOException("Image permissions mismatch");
}
using (var image = new Ufs2Image(output, readOnly: true)) {
    var result = image.FsckUfs();
    if (result.Errors.Count != 0) throw new IOException("UFS consistency check failed: " + string.Join("; ", result.Errors));
}
File.WriteAllText(output + ".verification.json", JsonSerializer.Serialize(new {
    hardwareValidated = false, imageBytes = new FileInfo(output).Length,
    files = receipt
}, new JsonSerializerOptions {WriteIndented = true}));
Console.WriteLine("Verified UFS2 image: " + receipt.Count + " files, exact SHA-256 readback, 336789504 bytes");
