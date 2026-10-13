"""Analyze 200 recorded URLs in two batches; never generate observations."""
import csv, hashlib, json, math, re, statistics as st
from pathlib import Path
import numpy as np
HERE=Path(__file__).resolve().parent
DATA=HERE/'data'
def inverse(x, upper):
    if not isinstance(upper, (int, float)) or isinstance(upper, bool) or not math.isfinite(upper) or upper <= 0:
        raise ValueError('Normalization upper bound must be finite and positive')
    if not isinstance(x, (int, float)) or isinstance(x, bool) or not math.isfinite(x) or x < 0:
        return None
    return 100 * (1 - min(float(x) / upper, 1))

def midranks(x):
    x = np.asarray(x)
    order = np.argsort(x, kind='stable')
    r = np.empty(len(x), dtype=float)
    i = 0
    while i < len(x):
        j = i + 1
        while j < len(x) and x[order[j]] == x[order[i]]:
            j += 1
        r[order[i:j]] = (i + j - 1) / 2 + 1
        i = j
    return r

def rho(x, y):
    a, b = midranks(x), midranks(y)
    if np.std(a) == 0 or np.std(b) == 0:
        return None
    return float(np.corrcoef(a, b)[0, 1])

def rankstats(x, y, ids):
    x, y = np.asarray(x), np.asarray(y)
    a, b = midranks(-x), midranks(-y)
    c = d = tx = ty = both = 0
    for i in range(len(x)):
        for j in range(i + 1, len(x)):
            dx, dy = np.sign(x[i] - x[j]), np.sign(y[i] - y[j])
            if dx == 0 and dy == 0: both += 1
            elif dx == 0: tx += 1
            elif dy == 0: ty += 1
            elif dx == dy: c += 1
            else: d += 1
    denom = math.sqrt((c+d+tx)*(c+d+ty))
    def top(v):
        return set(sorted(range(len(v)), key=lambda i: (-v[i], ids[i]))[:10])
    return {'n': len(x), 'pearson': float(np.corrcoef(x,y)[0,1]) if np.std(x) and np.std(y) else None,
            'spearman':rho(x,y),'kendall':(c-d)/denom if denom else None,
            'concordant':c,'discordant':d,'ties_x':tx,'ties_y':ty,'ties_both':both,
            'pair_reversal_pct':100*d/(c+d) if c+d else None,
            'changed_pct':100*float(np.mean(a != b)),
            'median_displacement':float(np.median(abs(a-b))),
            'max_displacement':float(np.max(abs(a-b))),
            'top10_overlap':len(top(x)&top(y))}

def incomplete_score_bounds(scores, weights):
    """Tight deterministic bounds, not imputed values or confidence intervals."""
    if len(scores) != len(weights) or not scores:
        raise ValueError('Scores and weights must have the same nonzero length')
    if not all(isinstance(w,(int,float)) and not isinstance(w,bool) and math.isfinite(w) and w>=0 for w in weights):
        raise ValueError('Weights must be finite and nonnegative')
    if not math.isclose(sum(weights),1,rel_tol=0,abs_tol=1e-12):
        raise ValueError('Weights must sum to one')
    if not all(v is None or (isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v) and 0<=v<=100) for v in scores):
        raise ValueError('Observed category scores must be finite and in [0,100]')
    total_weight=math.fsum(weights)
    weights=[w/total_weight for w in weights]
    available_weight=min(1.0,math.fsum(w for v,w in zip(scores,weights) if v is not None))
    observed_sum=min(100.0,math.fsum(v*w for v,w in zip(scores,weights) if v is not None))
    return {'available_weight':available_weight,
            'available_mean':observed_sum/available_weight if available_weight else None,
            'lower':observed_sum,'upper':observed_sum+100*(1-available_weight)}

def categories(lcp,cls,duration,audit,resources,bounds=(4000,.25,500)):
    normalized=[inverse(lcp,bounds[0]),inverse(cls,bounds[1]),inverse(duration,bounds[2])]
    if any(v is None for v in normalized):return None
    if not all(isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v) and 0<=v<=100 for v in [audit,resources]):return None
    return [(normalized[0]+normalized[1])/2,normalized[2],audit,resources]

def coverage_adjusted_score(scores,weights,available_fraction,gamma=.5):
    bounds=incomplete_score_bounds(scores,weights)
    if not isinstance(available_fraction,(int,float)) or isinstance(available_fraction,bool) or not math.isfinite(available_fraction) or not 0<=available_fraction<=1:raise ValueError('Coverage fraction must be in [0,1]')
    if not isinstance(gamma,(int,float)) or isinstance(gamma,bool) or not math.isfinite(gamma) or gamma<0:raise ValueError('Coverage exponent must be finite and nonnegative')
    mean=bounds['available_mean']
    return None if mean is None else mean*(max(available_fraction,.01)**gamma if gamma>0 else 1)

def recognized_interstitial(run):
    title=run.get('document_title') or ''
    return bool(re.search(r'client challenge|^oh noes!$|your access has been blocked|are you a robot|access to this page has been denied|^error page\s*\|\s*ebay$|^page not found(?:\s*[-|].*)?$|^hang tight!\s*routing to checkout',title,re.I))

def valid_runs(runs):
    result=[]
    for r in runs:
        actions=r.get('actions',[]);network=r.get('network',{})
        if not r.get('eligible') or recognized_interstitial(r) or len(actions)!=2:continue
        if not all(a.get('command_success') and isinstance(a.get('command_duration_ms'),(int,float)) and not isinstance(a.get('command_duration_ms'),bool) and math.isfinite(a['command_duration_ms']) and a['command_duration_ms']>=0 for a in actions):continue
        total=network.get('request_count');successful=network.get('successful_request_count')
        if not all(isinstance(v,int) and not isinstance(v,bool) and v>=0 for v in [total,successful]) or successful>total:continue
        result.append(r)
    return result

def run_values(runs):
    durations=[a['command_duration_ms'] for r in runs for a in r['actions']]
    total=sum(r['network']['request_count'] for r in runs)
    successful=sum(r['network']['successful_request_count'] for r in runs)
    return (st.mean(durations) if durations else None,100*successful/total if total else None)

def main():
    if not (DATA/'report.json').exists():
        from restore_data import restore
        restore()
    report=json.loads((DATA/'report.json').read_text());raw=json.loads((DATA/'runs.json').read_text())
    protocol=json.loads((HERE/'protocol.json').read_text());manifest=json.loads((HERE/'pages.json').read_text())
    assert report['metadata']['completed_utc'],'Collection must finish before final analysis'
    assert len(report['pages'])==len(manifest['pages'])==200
    assert {p['id'] for p in report['pages']}=={p['id'] for p in manifest['pages']}
    assert len(raw['pages'])==200 and all(len(p['runs'])==5 for p in raw['pages'])
    for batch in report['metadata']['collection_batches']:
        for name,digest in batch['metadata']['source_sha256'].items():
            source=HERE/'recorded-batches'/batch['batch']/name
            assert hashlib.sha256(source.read_bytes()).hexdigest()==digest,name
    settings=protocol['analysis'];seed=settings['bootstrap_seed'];replicates=settings['bootstrap_replicates']
    rng=np.random.default_rng(seed);runmap={p['pageId']:p['runs'] for p in raw['pages']};rows=[];excluded=[]
    for p in report['pages']:
        lh=p['lighthouse'];rr=valid_runs(runmap[p['id']]);duration,resources=run_values(rr)
        vals=categories(lh.get('lcp_ms') if lh.get('success') else None,lh.get('cls') if lh.get('success') else None,duration,lh.get('accessibility_audit_score') if lh.get('success') else None,resources)
        if len(rr)<settings['minimum_action_runs'] or vals is None:
            reasons=list(p['exclusion_reasons'])
            if any(recognized_interstitial(r) for r in runmap[p['id']]):reasons.append('recognized challenge or error document in additional content screen')
            excluded.append({'pageId':p['id'],'url':p['url'],'archetype':p['category'],'collection_batch':p['collection_batch'],'eligible_runs':len(rr),'reasons':'; '.join(reasons) or 'invalid retained measurement'})
            continue
        assert p['eligible']
        rows.append({'pageId':p['id'],'url':p['url'],'archetype':p['category'],'collection_batch':p['collection_batch'],'lcp_ms':lh['lcp_ms'],'cls':lh['cls'],'duration_ms':duration,'audit_score':lh['accessibility_audit_score'],'resource_pct':resources,'action_runs':len(rr),'categories':vals,'runs':rr})
    assert len(rows)>=3,'Insufficient eligible observations for ranking analysis'
    ids=[r['pageId'] for r in rows];a=np.array([r['categories'] for r in rows]);baseline=a[:,0];q=np.mean(a,axis=1)
    configurations=[('Equal weights',[.25]*4),('Declared preference',[.30,.25,.25,.20])]
    for j,name in enumerate(['Performance','Wheel command','Accessibility','Resources']):
        for factor,label in [(1.5,'higher'),(.5,'lower')]:
            w=np.ones(4);w[j]=factor;w/=sum(w);configurations.append((name+' '+label,w.tolist()))
    sensitivity=[]
    for name,w in configurations:
        scores=a@w;sensitivity.append({'configuration':name,'weights':w,'vs_primary':rankstats(q,scores,ids),'vs_performance':rankstats(baseline,scores,ids)})
    for j,name in enumerate(['Performance','Wheel command','Accessibility','Resources']):
        w=np.ones(4);w[j]=0;w/=sum(w);scores=a@w;sensitivity.append({'configuration':'Remove '+name,'weights':w.tolist(),'vs_primary':rankstats(q,scores,ids),'vs_performance':rankstats(baseline,scores,ids)})
    for name,bounds in [('LCP bound 8000 ms',(8000,.25,500)),('CLS bound 0.50',(4000,.50,500)),('Action bound 1000 ms',(4000,.25,1000))]:
        alt=np.array([categories(r['lcp_ms'],r['cls'],r['duration_ms'],r['audit_score'],r['resource_pct'],bounds) for r in rows]);scores=alt.mean(axis=1)
        sensitivity.append({'configuration':name,'bounds':bounds,'vs_primary':rankstats(q,scores,ids),'vs_performance':rankstats(alt[:,0],scores,ids)})
    boot_rho=[];boot_rank=[];boot_score=[]
    for _ in range(replicates):
        sample=[]
        for r in rows:
            rr=r['runs'];selected=[rr[i] for i in rng.integers(0,len(rr),len(rr))];duration,resources=run_values(selected)
            sample.append(categories(r['lcp_ms'],r['cls'],duration,r['audit_score'],resources))
        scores=np.mean(sample,axis=1);boot_rho.append(rho(baseline,scores));boot_rank.append(midranks(-scores));boot_score.append(scores)
    rankint=np.percentile(boot_rank,[2.5,97.5],axis=0);scoreint=np.percentile(boot_score,[2.5,97.5],axis=0)
    weights=np.random.default_rng(settings['weight_scenario_seed']).uniform(*settings['raw_weight_bounds'],(settings['weight_scenarios'],4));weights/=weights.sum(axis=1)[:,None]
    sweep=[rankstats(q,a@w,ids) for w in weights]
    for i,r in enumerate(rows):
        r.update({'performance_score':float(baseline[i]),'composite_score':float(q[i]),'performance_rank':float(midranks(-baseline)[i]),'composite_rank':float(midranks(-q)[i]),'rank_low':float(rankint[0,i]),'rank_high':float(rankint[1,i]),'score_low':float(scoreint[0,i]),'score_high':float(scoreint[1,i])})
        r.pop('runs');r.pop('categories')
    category_names=['Performance','Wheel command','Accessibility','Resources']
    category_descriptives={name:{'min':float(np.min(a[:,i])),'median':float(np.median(a[:,i])),'max':float(np.max(a[:,i])),'sample_sd':float(np.std(a[:,i],ddof=1))} for i,name in enumerate(category_names)}
    raw_descriptives={key:{'min':min(r[key] for r in rows),'median':st.median(r[key] for r in rows),'max':max(r[key] for r in rows)} for key in ['lcp_ms','cls','duration_ms','audit_score','resource_pct']}
    classes=sorted({p['category'] for p in manifest['pages']})
    output={'collection_metadata':report['metadata'],'seed':seed,'bootstraps':replicates,'primary':rankstats(baseline,q,ids),'sensitivity':sensitivity,'conditional_spearman_interval':np.percentile(boot_rho,[2.5,97.5]).tolist(),'median_conditional_rank_width':float(np.median(rankint[1]-rankint[0])),'weight_sweep':{'n':len(weights),'raw_uniform_bounds':settings['raw_weight_bounds'],'spearman_range':[min(s['spearman'] for s in sweep),max(s['spearman'] for s in sweep)],'top10_overlap_range':[min(s['top10_overlap'] for s in sweep),max(s['top10_overlap'] for s in sweep)]},'eligible_archetypes':{c:sum(r['archetype']==c for r in rows) for c in classes},'raw_archetypes':{c:sum(p['category']==c for p in manifest['pages']) for c in classes},'eligible_lcp_saturation':sum(r['lcp_ms']>=4000 for r in rows),'excluded':excluded,'pages':rows,'category_descriptives':category_descriptives,'raw_descriptives':raw_descriptives,'checks':'200 URLs, 1000 browser attempts, two recorded source snapshots, eligibility and preserved unavailable values verified'}
    output['content_screening']={'protocol':json.loads((HERE/'content-screening.json').read_text()),'recognized_interstitial_attempts':sum(recognized_interstitial(r) for p in raw['pages'] for r in p['runs']),'collector_eligible_urls':sum(p['eligible'] for p in report['pages']),'screened_eligible_urls':len(rows),'raw_collector_flags_preserved':True}
    output['checks']='200 URLs, 1000 browser attempts, two recorded source snapshots, eligibility and preserved unavailable values verified'
    output['batch_summaries']={}
    for batch in ['first','extension']:
        selected=[r for r in rows if r['collection_batch']==batch]
        output['batch_summaries'][batch]={'raw_urls':100,'eligible_urls':len(selected),'excluded_urls':100-len(selected),'primary':rankstats([r['performance_score'] for r in selected],[r['composite_score'] for r in selected],[r['pageId'] for r in selected]) if len(selected)>=3 else None}
    (HERE/'reanalysis.json').write_text(json.dumps(output,indent=2)+'\n')
    for name,data,fields in [('eligible-pages.csv',rows,list(rows[0])),('excluded-pages.csv',excluded,['pageId','url','archetype','collection_batch','eligible_runs','reasons'])]:
        with (HERE/name).open('w',newline='') as f:
            writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader();writer.writerows(data)
    hashes={str(p.relative_to(HERE)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted([p for p in DATA.rglob('*') if p.is_file()]+[p for p in (HERE/'recorded-batches').rglob('*') if p.is_file()]+[p for p in (HERE/'recorded-dependencies').rglob('*') if p.is_file()]+[HERE/'pages.json',HERE/'protocol.json',HERE/'reanalyze.py',HERE/'content-screening.json',HERE/'check_analysis.py'])}
    (HERE/'data-hashes.json').write_text(json.dumps(hashes,indent=2)+'\n')
    print(json.dumps({k:output[k] for k in ['primary','conditional_spearman_interval','eligible_archetypes','eligible_lcp_saturation','checks']},indent=2))

if __name__=='__main__':main()
