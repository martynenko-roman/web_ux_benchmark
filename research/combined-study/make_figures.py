"""Create vector research figures and 600 dpi PNGs from reanalysis.json."""
from pathlib import Path
import json, os
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pdf2image import convert_from_path

HERE=Path(__file__).resolve().parent
OUT=HERE/'figures';OUT.mkdir(exist_ok=True)
X=json.loads((HERE/'reanalysis.json').read_text())
FONT=Path(os.environ.get('STUDY_FONT','/System/Library/Fonts/Supplemental/Arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialEmbedded',str(FONT)))
W=241
BLUE=(.0,.35,.49)

def begin(n,h):
    c=canvas.Canvas(str(OUT/f'marty{n}.pdf'),pagesize=(W,h))
    c.setFont('ArialEmbedded',8.5);c.setLineWidth(.6)
    return c

def finish(c,n):
    c.save()
    convert_from_path(str(OUT/f'marty{n}.pdf'),dpi=600)[0].save(OUT/f'marty{n}.png',dpi=(600,600))

def label(c,x,y,t,center=False):
    c.setFillColorRGB(0,0,0)
    (c.drawCentredString if center else c.drawString)(x,y,t)

c=begin(1,172)
boxes=[('Recorded collection protocols','Five attempts and a conditional audit'),('Observed measurements','Record provenance and unavailable endpoints'),('Eligibility and content screening','Require common retained measurements'),('Scoring and sensitivity','Expose weights bounds ties and exclusions')]
for i,(a,b) in enumerate(boxes):
    y=137-i*42;c.setStrokeColorRGB(*BLUE);c.roundRect(4,y,W-8,31,3)
    c.setFont('ArialEmbedded',9);label(c,W/2,y+19,a,True)
    c.setFont('ArialEmbedded',8);label(c,W/2,y+7,b,True)
    if i<3:
        c.line(W/2,y,W/2,y-10);c.line(W/2,y-10,W/2-3,y-6);c.line(W/2,y-10,W/2+3,y-6)
finish(c,1)

c=begin(2,210);left,bottom,right,top=34,32,229,170
sx=lambda x:left+(right-left)*x/100
sy=lambda y:bottom+(top-bottom)*y/100
for t in [0,25,50,75,100]:
    xx=sx(t);c.setStrokeColorRGB(.83,.83,.83);c.line(xx,bottom,xx,top);label(c,xx,bottom-12,str(t),True)
for t in [0,20,40,60,80,100]:
    yy=sy(t);c.setStrokeColorRGB(.83,.83,.83);c.line(left,yy,right,yy);label(c,10,yy-3,str(t))
c.setStrokeColorRGB(0,0,0);c.line(left,bottom,right,bottom);c.line(left,bottom,left,top)
def scatter_mark(x,y,batch):
    if batch=='first':
        c.setFillColorRGB(*BLUE);c.circle(x,y,1.8,stroke=0,fill=1)
    else:
        c.setFillColorRGB(.15,.15,.15);p=c.beginPath();p.moveTo(x,y+2);p.lineTo(x-2,y-1.5);p.lineTo(x+2,y-1.5);p.close();c.drawPath(p,stroke=0,fill=1)
for p in X['pages']:scatter_mark(sx(p['performance_score']),sy(p['composite_score']),p['collection_batch'])
label(c,(left+right)/2,4,'Loading and layout score',True)
c.saveState();c.translate(7,104);c.rotate(90);label(c,0,0,'Technical composite score',True);c.restoreState()
label(c,35,199,f"{X['primary']['n']} complete-measurement URLs")
scatter_mark(42,186,'first');label(c,49,183,'First batch')
scatter_mark(114,186,'extension');label(c,121,183,'Extension')
finish(c,2)

configs=['Declared preference','Performance lower','Remove Performance','Remove Wheel command','Remove Accessibility','Remove Resources','LCP bound 8000 ms','CLS bound 0.50','Action bound 1000 ms']
names=['Declared weights','Less performance','No performance','No wheel command','No accessibility','No resources','LCP bound doubled','CLS bound doubled','Action bound doubled']
c=begin(3,197);left,right,bottom,top=112,232,29,180
lower=min(.7, min(z['vs_primary']['spearman'] for z in X['sensitivity'] if z['configuration'] in configs))
lower=max(-1, int(lower*10-1)/10)
ticks=[lower+(1-lower)*i/3 for i in range(4)]
for t in ticks:
    xx=left+(right-left)*(t-lower)/(1-lower);c.setStrokeColorRGB(.82,.82,.82);c.line(xx,bottom,xx,top+3);label(c,xx,bottom-12,f'{t:.1f}',True)
for i,(config,name) in enumerate(zip(configs,names)):
    z=next(s for s in X['sensitivity'] if s['configuration']==config);v=z['vs_primary']['spearman'];y=top-i*17
    label(c,1,y-3,name);c.setStrokeColorRGB(*BLUE);c.setLineWidth(1.1)
    xx=left+(right-left)*(v-lower)/(1-lower);c.line(left,y,xx,y);c.setFillColorRGB(*BLUE);c.circle(xx,y,2,fill=1,stroke=0)
label(c,171,3,'Correlation with primary ranks',True)
finish(c,3)

rows=sorted(X['pages'],key=lambda r:(-r['composite_score'],r['pageId']))[:10]
c=begin(4,204);left,right,bottom,top=107,234,29,186
maximum=max(20,max(r['rank_high'] for r in rows));maximum=5*int((maximum+4.999)/5)
fx=lambda x:left+(right-left)*(x-1)/(maximum-1)
step=max(5,5*int((maximum/5+4.999)/5))
for t in [1]+list(range(step,int(maximum)+1,step)):
    xx=fx(t);c.setStrokeColorRGB(.85,.85,.85);c.line(xx,bottom,xx,top+4);label(c,xx,bottom-12,str(t),True)
for i,r in enumerate(rows):
    y=top-i*17;name=r['pageId'].replace('-home','').replace('-search','').replace('-product','')
    size=8.5
    while pdfmetrics.stringWidth(name,'ArialEmbedded',size)>left-6 and size>6.5:size-=.25
    c.setFont('ArialEmbedded',size);label(c,0,y-3,name);c.setFont('ArialEmbedded',8.5);c.setStrokeColorRGB(*BLUE);c.setLineWidth(1.2);c.line(fx(r['rank_low']),y,fx(r['rank_high']),y)
    c.line(fx(r['rank_low']),y-3,fx(r['rank_low']),y+3);c.line(fx(r['rank_high']),y-3,fx(r['rank_high']),y+3)
    c.setFillColorRGB(*BLUE);c.circle(fx(r['composite_rank']),y,2,fill=1,stroke=0)
label(c,170,3,'Conditional composite rank',True)
finish(c,4)
(OUT/'figure-inputs.json').write_text(json.dumps({'scatter':X['pages'],'sensitivity':[s for s in X['sensitivity'] if s['configuration'] in configs],'rank_intervals':rows},indent=2))
print('Created four vector PDFs and 600 dpi PNGs')
