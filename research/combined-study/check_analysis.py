"""Independent arithmetic and data-integrity checks for the recorded study."""
from pathlib import Path
import csv,hashlib,itertools,json,math,random,statistics as st
from datetime import datetime
import reanalyze as model

HERE=Path(__file__).resolve().parent

def ranks(values):
    ordered=sorted(enumerate(values),key=lambda p:p[1]);result=[0.0]*len(values);index=0
    while index<len(ordered):
        end=index+1
        while end<len(ordered) and ordered[end][1]==ordered[index][1]:end+=1
        for original,_ in ordered[index:end]:result[original]=(index+end+1)/2
        index=end
    return result

def correlation(x,y):
    mx,my=st.mean(x),st.mean(y)
    numerator=math.fsum((a-mx)*(b-my) for a,b in zip(x,y))
    denominator=math.sqrt(math.fsum((a-mx)**2 for a in x)*math.fsum((b-my)**2 for b in y))
    return numerator/denominator if denominator else None

def properties():
    rng=random.Random(20261012);count=0
    assert model.inverse(None,500) is None and model.inverse(0,500)==100
    assert model.run_values([])==(None,None)
    for bad in [float('nan'),float('inf'),-1,'0',True]:assert model.inverse(bad,500) is None
    example={'eligible':True,'actions':[{'command_success':True,'command_duration_ms':1},{'command_success':True,'command_duration_ms':2}],'network':{'request_count':4,'successful_request_count':3}}
    assert len(model.valid_runs([example]))==1 and model.run_values([example])==(1.5,75)
    for title in ['Client Challenge','Oh noes!','Bloomberg - Are you a robot?','Error Page | eBay','Page Not Found']:
        assert not model.valid_runs([{**example,'document_title':title}])
    invalid={**example,'network':{'request_count':4,'successful_request_count':5}}
    assert not model.valid_runs([invalid])
    no_requests={**example,'network':{'request_count':0,'successful_request_count':0}}
    assert model.run_values([no_requests])==(1.5,None)
    for weights in [[-.1,.4,.3,.4],[0,0,0,0],[.2,.2,.2,.2]]:
        try:model.incomplete_score_bounds([10,20,None,30],weights)
        except ValueError:pass
        else:raise AssertionError('Invalid weights accepted')
    assert model.categories(1000,0,None,90,99) is None
    assert model.coverage_adjusted_score([None]*4,[.25]*4,0) is None
    assert abs(model.coverage_adjusted_score([0,100],[.5,.5],1)-50)<1e-12
    assert abs(model.coverage_adjusted_score([None,100],[.5,.5],.5)-100*math.sqrt(.5))<1e-12
    assert correlation(ranks([1,2,2]),ranks([2,3,3]))==1
    for _ in range(1000):
        scores=[rng.random()*100 for _ in range(4)];raw=[rng.random() for _ in range(4)];weights=[v/sum(raw) for v in raw]
        full=math.fsum(a*b for a,b in zip(scores,weights));observed=[v if rng.random()>.4 else None for v in scores]
        bounds=model.incomplete_score_bounds(observed,weights)
        assert bounds['lower']-1e-10<=full<=bounds['upper']+1e-10
        zero=math.fsum((v or 0)*w for v,w in zip(observed,weights));maximum=math.fsum((100 if v is None else v)*w for v,w in zip(observed,weights))
        assert abs(zero-bounds['lower'])<1e-10 and abs(maximum-bounds['upper'])<1e-10
        x=rng.random()*8000;up=x+rng.random()*1000
        assert 0<=model.inverse(x,4000)<=100 and model.inverse(up,4000)<=model.inverse(x,4000)
        count+=1
    return count

def main():
    properties_count=properties()
    data=json.loads((HERE/'data/report.json').read_text());runs=json.loads((HERE/'data/runs.json').read_text());analysis=json.loads((HERE/'reanalysis.json').read_text());protocol=json.loads((HERE/'protocol.json').read_text())
    manifest=json.loads((HERE/'pages.json').read_text());manifest_ids={p['id'] for p in manifest['pages']}
    assert len(data['pages'])==len(runs['pages'])==200
    assert {p['id'] for p in data['pages']}==manifest_ids=={p['pageId'] for p in runs['pages']}
    assert sum(len(p['runs']) for p in runs['pages'])==1000
    assert all(len(p['runs'])==5 and [r['run'] for r in p['runs']]==list(range(5)) for p in runs['pages'])
    assert len({p['url'] for p in manifest['pages']})==200
    for batch in data['metadata']['collection_batches']:
        metadata=batch['metadata'];directory=HERE/'recorded-batches'/batch['batch']
        bp=json.loads((directory/'protocol.json').read_text());bm=json.loads((directory/'pages.json').read_text())
        assert datetime.fromisoformat(bp['recorded_before_collection_utc'])<datetime.fromisoformat(metadata['started_utc'])<datetime.fromisoformat(metadata['completed_utc'])
        assert hashlib.sha256((directory/'report.json').read_bytes()).hexdigest()==batch['report_sha256']
        assert hashlib.sha256((directory/'runs.json').read_bytes()).hexdigest()==batch['runs_sha256']
        expected=[p['id'] for p in bm['pages']];state=bp['order_seed']
        for i in range(len(expected)-1,0,-1):
            state=(1664525*state+1013904223)&0xffffffff;j=int(state/4294967296*(i+1));expected[i],expected[j]=expected[j],expected[i]
        assert expected==[p['id'] for p in data['pages'] if p['collection_batch']==batch['batch']]
        for name,digest in metadata['source_sha256'].items():
            assert hashlib.sha256((directory/name).read_bytes()).hexdigest()==digest,name
        original=json.loads((directory/'report.json').read_text())['pages']
        original_runs=json.loads((directory/'runs.json').read_text())['pages']
        pooled=[{k:v for k,v in p.items() if k!='collection_batch'} for p in data['pages'] if p['collection_batch']==batch['batch']]
        pooled_runs=[{k:v for k,v in p.items() if k!='collection_batch'} for p in runs['pages'] if p['collection_batch']==batch['batch']]
        assert original==pooled and original_runs==pooled_runs,'Pooling changed observations'
    assert len(list((HERE/'data/raw/browser').glob('*.json')))==len(list((HERE/'data/raw/lighthouse').glob('*.json')))==200
    records={p['pageId']:p['runs'] for p in runs['pages']};observed={p['id']:p for p in data['pages']}
    for page in analysis['pages']:
        p=observed[page['pageId']];assert p['eligible']
        rr=model.valid_runs(records[page['pageId']]);assert len(rr)>=3
        durations=[a['command_duration_ms'] for r in rr for a in r['actions']]
        requests=sum(r['network']['request_count'] for r in rr);successes=sum(r['network']['successful_request_count'] for r in rr)
        assert abs(page['duration_ms']-st.mean(durations))<1e-12
        assert abs(page['resource_pct']-100*successes/requests)<1e-12
        lh=json.loads((HERE/'data/raw/lighthouse'/f"{page['pageId']}.json").read_text())
        assert lh['success'] and lh['effective_settings']['formFactor']=='desktop' and lh['effective_settings']['throttlingMethod']=='provided'
        assert page['lcp_ms']==lh['audits']['largest-contentful-paint']['numeric_value']
        assert page['cls']==lh['audits']['cumulative-layout-shift']['numeric_value']
        category=(100*(1-min(page['lcp_ms']/4000,1))+100*(1-min(page['cls']/.25,1)))/2
        composite=(category+100*(1-min(page['duration_ms']/500,1))+page['audit_score']+page['resource_pct'])/4
        assert abs(category-page['performance_score'])<1e-10 and abs(composite-page['composite_score'])<1e-10
    pages=analysis['pages'];x=[p['performance_score'] for p in pages];y=[p['composite_score'] for p in pages]
    primary=analysis['primary'];assert primary['n']==len(pages)
    assert abs(correlation(x,y)-primary['pearson'])<1e-12
    assert abs(correlation(ranks(x),ranks(y))-primary['spearman'])<1e-12
    concordant=discordant=tx=ty=both=0
    for i,j in itertools.combinations(range(len(x)),2):
        dx=(x[i]>x[j])-(x[i]<x[j]);dy=(y[i]>y[j])-(y[i]<y[j])
        if not dx and not dy:both+=1
        elif not dx:tx+=1
        elif not dy:ty+=1
        elif dx==dy:concordant+=1
        else:discordant+=1
    assert [concordant,discordant,tx,ty,both]==[primary[k] for k in ['concordant','discordant','ties_x','ties_y','ties_both']]
    tau=(concordant-discordant)/math.sqrt((concordant+discordant+tx)*(concordant+discordant+ty))
    assert abs(tau-primary['kendall'])<1e-12
    assert len(pages)+len(analysis['excluded'])==200
    with (HERE/'eligible-pages.csv').open(newline='') as f:assert len(list(csv.DictReader(f)))==len(pages)
    with (HERE/'excluded-pages.csv').open(newline='') as f:assert len(list(csv.DictReader(f)))==len(analysis['excluded'])
    result={'all_200_urls_retained':True,'all_1000_browser_attempts_retained':True,'collection_source_hashes_verified':True,'each_batch_protocol_precedes_its_collection':True,'pooling_preserves_original_observations':True,'eligible_urls':len(pages),'excluded_urls':len(analysis['excluded']),'independent_pearson_spearman_tau_and_pair_counts_match':True,'raw_audit_values_and_run_pooling_match':True,'seeded_scoring_and_tight_bound_cases':properties_count,'participant_observations':0}
    (HERE/'validation.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))

if __name__=='__main__':main()
