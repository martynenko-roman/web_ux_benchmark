"""Render the measured timing endpoints with empirical min/max ranges."""
from pathlib import Path
import json, os
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pdf2image import convert_from_path
here=Path(__file__).resolve().parent
data=json.loads((here/'summary.json').read_text())
out=here.parent/'figures'
out.mkdir(exist_ok=True)
pdfmetrics.registerFont(TTFont('ArialEmbedded',os.environ.get('BENCHMARK_FONT','/System/Library/Fonts/Supplemental/Arial.ttf')))
c=canvas.Canvas(str(out/'marty5.pdf'),pagesize=(241,220))
c.setFont('ArialEmbedded',8)
left,right,bottom,top=39,231,46,199
fx=lambda v:left+(right-left)*v/850
fy=lambda v:bottom+(top-bottom)*v/850
for tick in [0,200,400,600,800]:
 c.setStrokeColorRGB(.85,.85,.85);c.setLineWidth(.4)
 c.line(fx(tick),bottom,fx(tick),top);c.line(left,fy(tick),right,fy(tick))
 c.setFillColorRGB(0,0,0);c.drawCentredString(fx(tick),bottom-12,str(tick));c.drawRightString(left-5,fy(tick)-3,str(tick))
c.setStrokeColorRGB(.5,.5,.5);c.setDash(2,2);c.line(fx(0),fy(0),fx(850),fy(850));c.setDash()
c.setStrokeColorRGB(0,0,0);c.line(left,bottom,right,bottom);c.line(left,bottom,left,top)
colors={'sync':(.1,.1,.1),'async':(0,.35,.49),'ready':(.65,.15,.1)}
for row in data['conditions']:
 x=row['command_duration_ms'];y=row['page_response_ms'];px,py=fx(x['median']),fy(y['median'])
 c.setStrokeColorRGB(*colors[row['mode']]);c.setFillColorRGB(*colors[row['mode']]);c.setLineWidth(.8)
 c.line(fx(x['min']),py,fx(x['max']),py);c.line(px,fy(y['min']),px,fy(y['max']))
 if row['mode']=='sync':c.circle(px,py,2.5,fill=1,stroke=0)
 elif row['mode']=='async':
  path=c.beginPath();path.moveTo(px,py+3);path.lineTo(px-3,py-2.5);path.lineTo(px+3,py-2.5);path.close();c.drawPath(path,fill=1,stroke=0)
 else:c.rect(px-2.7,py-2.7,5.4,5.4,fill=1,stroke=0)
 # Delay labels identify distinct conditions; endpoints are actual observations.
 dx,dy=(5,5) if row['mode']=='sync' else (7,7)
 if row['mode']=='sync' and row['delay_ms']==700:dx,dy=-26,7
 if row['mode']=='ready':dx,dy=6,8
 c.drawString(px+dx,py+dy,str(row['delay_ms']))
c.setFillColorRGB(0,0,0);c.drawCentredString((left+right)/2,18,'Click-command duration (ms)')
c.saveState();c.translate(9,(top+bottom)/2);c.rotate(90);c.drawCentredString(0,0,'Handler-to-result duration (ms)');c.restoreState()
c.setFont('ArialEmbedded',7.5)
for i,(label,color) in enumerate([('Synchronous',colors['sync']),('Asynchronous',colors['async']),('Readiness',colors['ready'])]):
 c.setFillColorRGB(*color);c.drawString(12+i*80,5,label)
c.save()
convert_from_path(str(out/'marty5.pdf'),dpi=600)[0].save(out/'marty5.png',dpi=(600,600))
(out/'controlled-figure-inputs.json').write_text(json.dumps(data['conditions'],indent=2))
print('Created measured endpoint figure as vector PDF and 600-dpi PNG')
