"""Build one platform-independent, content-addressed offline resource archive."""
import hashlib, json, os, pathlib, sys, zipfile
ROOT = pathlib.Path(__file__).resolve().parents[1]

def digest_file(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def build(root, output, roots):
    files = []
    for name in roots:
        source = root / name
        if not source.exists(): raise ValueError(f'Missing resource: {name}')
        for path in sorted(source.rglob('*') if source.is_dir() else [source]):
            if path.is_symlink(): raise ValueError(f'Symlink not supported: {path}')
            if path.is_file() and path.name != '.DS_Store':
                files.append({'path': path.relative_to(root).as_posix(), 'size': path.stat().st_size, 'sha256': digest_file(path)})
    files.sort(key=lambda f: f['path'])
    identity = hashlib.sha256()
    for f in files: identity.update(f"{f['path']}\0{f['size']}\0{f['sha256']}\n".encode())
    manifest = {'format': 1, 'app': 'splatoon-blender', 'id': identity.hexdigest(), 'files': files}
    output.mkdir(parents=True, exist_ok=True)
    destination = output / f"Splatoon-Blender-Resources-v1-{manifest['id'][:12]}.zip"
    checksum_path = destination.with_suffix('.zip.sha256')
    if destination.exists() and checksum_path.exists() and digest_file(destination) == checksum_path.read_text().split()[0]:
        print(f'Reusing unchanged resource pack: {destination}')
        return destination
    temporary = destination.with_suffix('.zip.partial')
    try:
        with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as archive:
            info = zipfile.ZipInfo('manifest.json', (2020, 1, 1, 0, 0, 0))
            archive.writestr(info, json.dumps(manifest, ensure_ascii=False, separators=(',', ':')))
            for f in files:
                info = zipfile.ZipInfo('web/' + f['path'], (2020, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                with (root / f['path']).open('rb') as source, archive.open(info, 'w', force_zip64=True) as target:
                    while chunk := source.read(1024 * 1024): target.write(chunk)
        temporary.replace(destination)
        checksum_path.write_text(f'{digest_file(destination)}  {destination.name}\n')
        destination.with_suffix('.manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    finally:
        temporary.unlink(missing_ok=True)
    print(f'Resource pack: {destination} ({destination.stat().st_size:,} bytes; {len(files)} files)')
    return destination

if __name__ == '__main__':
    config = json.loads((ROOT / 'offline-resources.json').read_text())
    build(ROOT, ROOT / 'offline-release', config['roots'])
