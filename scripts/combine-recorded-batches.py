"""Create a pooled artifact only after both recorded batches have finished."""
import hashlib, json, shutil
from pathlib import Path

root=Path(__file__).resolve().parents[1]/'research'
out=root/'combined-study'
out.mkdir(exist_ok=True)
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def main():
    batches=[];pages=[];runs=[];manifest=[]
    for label,name in [('first','current-study'),('extension','extension-study')]:
        directory=root/name
        report=json.loads((directory/'data/report.json').read_text())
        raw=json.loads((directory/'data/runs.json').read_text())
        selected=json.loads((directory/'pages.json').read_text())
        assert report['metadata']['completed_utc'],f'{name} is incomplete'
        assert len(report['pages'])==len(raw['pages'])==len(selected['pages'])==100
        assert all(len(p['runs'])==5 for p in raw['pages'])
        target=out/'recorded-batches'/label
        target.mkdir(parents=True,exist_ok=True)
        for filename,expected in report['metadata']['source_sha256'].items():
            candidates=[directory/filename,directory/'recorded-source'/filename]
            source=next((p for p in candidates if p.exists() and digest(p)==expected),None)
            assert source is not None,filename
            shutil.copyfile(source,target/filename)
        for filename in ['report.json','runs.json']:
            shutil.copyfile(directory/'data'/filename,target/filename)
        for kind in ['browser','lighthouse']:
            destination=out/'data/raw'/kind
            destination.mkdir(parents=True,exist_ok=True)
            for p in (directory/'data/raw'/kind).glob('*.json'):
                assert not (destination/p.name).exists() or digest(destination/p.name)==digest(p),'Conflicting raw records'
                shutil.copyfile(p,destination/p.name)
        batches.append({'batch':label,'source_directory':name,'metadata':report['metadata'],'report_sha256':digest(directory/'data/report.json'),'runs_sha256':digest(directory/'data/runs.json'),'page_ids':[p['id'] for p in selected['pages']]})
        pages.extend([{**p,'collection_batch':label} for p in report['pages']])
        runs.extend([{**p,'collection_batch':label} for p in raw['pages']])
        manifest.extend([{**p,'collection_batch':label} for p in selected['pages']])
    assert len(pages)==200 and len({p['id'] for p in pages})==200
    assert len({p['url'] for p in pages})==200
    metadata={'dataset_id':'web-quality-two-batch-200-2026-10','started_utc':batches[0]['metadata']['started_utc'],'completed_utc':batches[-1]['metadata']['completed_utc'],'source_commit':batches[-1]['metadata']['source_commit'],'environment':batches[0]['metadata']['environment'],'collection_batches':batches,'provenance':'Two separately recorded batches. Extension selected after first-batch results. No observations regenerated during pooling.'}
    protocol={'protocol_id':'web-quality-two-batch-analysis-2026-10','analysis':batches[0]['metadata']['protocol']['analysis'],'collection':'Each batch follows its own recorded protocol. Five browser attempts per URL, one conditional Lighthouse audit. Protocols and executed source retained under recorded-batches.','extension_analysis_recorded_utc':batches[1]['metadata']['protocol']['recorded_before_collection_utc'],'interpretation':'Pooled descriptive analysis of a purposive two-batch sample; batch summaries supplied; no random-population or human UX inference.'}
    assert protocol['analysis']==batches[1]['metadata']['protocol']['analysis']
    for filename,value in [('pages.json',{'pages':manifest}),('protocol.json',protocol),('data/report.json',{'metadata':metadata,'pages':pages}),('data/runs.json',{'metadata':metadata,'pages':runs}),('data/pages.json',{'pages':manifest}),('data/protocol.json',protocol)]:
        (out/filename).write_text(json.dumps(value,indent=2)+'\n')
    events=root/'current-study/operational-events.json'
    if events.exists():shutil.copyfile(events,out/'operational-events.json')
    print(json.dumps({'urls':200,'browser_attempts':sum(len(p['runs']) for p in runs),'batches':[(b['batch'],b['metadata']['source_commit']) for b in batches]}))

if __name__=='__main__':main()
