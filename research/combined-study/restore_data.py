"""Restore exact recorded files from the repository's checksum-verified ZIP parts."""
from pathlib import Path, PurePosixPath
from io import BytesIO
from zipfile import ZipFile
import hashlib,json
HERE=Path(__file__).resolve().parent
def restore():
    manifest=json.loads((HERE/'recorded-data/manifest.json').read_text())
    pieces=[]
    for part in manifest['parts']:
        data=(HERE/'recorded-data'/part['name']).read_bytes()
        assert len(data)==part['bytes'] and hashlib.sha256(data).hexdigest()==part['sha256'],'Archive part is corrupt'
        pieces.append(data)
    payload=b''.join(pieces)
    assert hashlib.sha256(payload).hexdigest()==manifest['archive_sha256'],'Recorded archive is corrupt'
    with ZipFile(BytesIO(payload)) as archive:
        assert archive.testzip() is None
        assert set(archive.namelist())==set(manifest['files_sha256'])
        for member in archive.namelist():
            relative=PurePosixPath(member)
            assert not relative.is_absolute() and '..' not in relative.parts
            assert relative.parts[0] in ['data','recorded-batches','recorded-dependencies']
            data=archive.read(member)
            assert hashlib.sha256(data).hexdigest()==manifest['files_sha256'][member],member
            target=HERE/member
            if target.exists():
                assert hashlib.sha256(target.read_bytes()).hexdigest()==manifest['files_sha256'][member],'Refusing to replace changed recorded file: '+member
            else:
                target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
    return len(manifest['files_sha256'])
if __name__=='__main__':print(json.dumps({'exact_recorded_files_restored':restore(),'observations_generated':0}))
