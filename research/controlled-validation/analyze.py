"""Summarize observed browser experiments; do not generate measurements."""
from pathlib import Path
import csv, hashlib, json, statistics as st

HERE=Path(__file__).resolve().parent
raw=json.loads((HERE/'observations.json').read_text())
assert raw.get('completed_utc'), 'Collection did not reach its stopping rule'
for name,digest in raw['source_sha256'].items():
    assert hashlib.sha256((HERE/name).read_bytes()).hexdigest()==digest, name
rows=[r for r in raw['observations'] if not r['excluded_warmup']]
assert len(rows)==102
assert sum(r['excluded_warmup'] for r in raw['observations'])==1
summary=[]
for condition in raw['protocol']['conditions']:
    group=[r for r in rows if r['condition']==condition['id']]
    assert len(group)==12 and {r['block'] for r in group}==set(range(12))
    assert all(r['command_success'] and r['task_success'] and r['page']['trusted_click'] for r in group)
    item={**condition,'n':len(group)}
    for key in ['command_duration_ms','page_response_ms','task_completion_duration_ms']:
        v=[r[key] for r in group]
        item[key]={'median':st.median(v),'min':min(v),'max':max(v)}
    if condition['mode']=='async':
        v=[r['page_response_ms']-r['command_duration_ms'] for r in group]
        item['response_minus_command_ms']={'median':st.median(v),'min':min(v),'max':max(v)}
    item['observations_with_event_timing']=sum(bool(r['page']['event_entries']) for r in group)
    summary.append(item)
controls=[]
for mode in raw['protocol']['failure_controls']:
    group=[r for r in rows if r['condition']==mode]
    assert len(group)==3 and all(not r['task_success'] and r['task_completion_duration_ms'] is None and r['page_response_ms'] is None for r in group)
    if mode=='missing-button': assert all(not r['command_success'] and r['command_duration_ms'] is None for r in group)
    if mode=='missing-feedback': assert all(r['command_success'] and r['command_duration_ms'] is not None for r in group)
    controls.append({'condition':mode,'n':3,'command_successes':sum(r['command_success'] for r in group),'task_successes':0,'missing_endpoints_are_null':True})
result={'protocol_version':raw['protocol']['protocol_version'],'experimental_observations':96,
        'failure_controls':controls,'excluded_warmup_observations':1,
        'total_logged_observations':len(raw['observations']),'conditions':summary,
        'environment':raw['environment'],'started_utc':raw['started_utc'],
        'completed_utc':raw['completed_utc'],'raw_sha256':hashlib.sha256((HERE/'observations.json').read_bytes()).hexdigest(),
        'source_hashes_verified':True,'participant_observations':0}
(HERE/'summary.json').write_text(json.dumps(result,indent=2)+'\n')
flat=[]
for r in raw['observations']:
    flat.append({k:r[k] for k in ['condition','block','excluded_warmup','delay_ms','command_success','task_success','command_duration_ms','page_response_ms','task_completion_duration_ms']})
with (HERE/'observations.csv').open('w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=list(flat[0]));w.writeheader();w.writerows(flat)
print(json.dumps(result,indent=2))
