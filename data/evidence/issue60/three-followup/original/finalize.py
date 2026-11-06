from pathlib import Path
import json, math,hashlib,shutil
from PIL import Image,ImageDraw
O=Path(__file__).parent
J=lambda p:json.load(open(p))
calc=J(O/'calculations.json'); ids={r['number']:r['facilityId']for r in J(O/'identity.json')['receiptRows']}
meta=J(O/'mosaic-metadata.json')
shutil.copyfile('/tmp/issue60-shiraoka-followup/layout.jpg',O/'40-plan.jpg')
def dist(a,b):
 r=6371008.8;phi=math.radians((a['lat']+b['lat'])/2);return math.hypot(math.radians(a['lat']-b['lat']),math.radians(a['lng']-b['lng'])*math.cos(phi))*r
user={7:{'lat':35.710432,'lng':139.8057884},13:{'lat':35.18845,'lng':139.6533},14:{'lat':35.4338,'lng':139.43125},40:{'lat':36.017642,'lng':139.677572},41:{'lat':36.19655,'lng':139.70990}}
rows=[]
findings={
7:('trial_only_not_adoption_candidate','E03表示を源森橋・小梅橋の高架交差位置間で内挿し、住所検索APIに依存しない数値を生成。元API依存点から約8m差。公式図は模式図で桁間隔の比例を保証せず、同じE03内か隣区画かを未使用局所基準で確認できない。','既存の建物指定は回答済み。残るのはE03の両隣境界と道路/橋の計量対応、又は旧住所検索API出力の提供元と再利用条件の確認。室内測量を求めない。'),
13:('trial_only_not_adoption_candidate','管理者寸法図の12.92m/14.56mを実際に尺度化。改札基準2仮説の独自座標を算出したが、写真では柱・改札が高架に隠れ、屋根突出部と地上改札の同一性が未確定。','柱1本又は改札位置を、既存高架外形の沿線距離へ結ぶ地上配置の対応だけが残る。構内図は模式図で写真の柱列を同定できなかった。資料不存在ではなく、この対応未解決。'),
14:('candidate_for_independent_review','公式図の道路東側・南100台区画を航空写真の南側空地へ対応させ、区画内画素から直接計算。原図全体のアフィン試算は未使用点18.9–55.5m差で棄却。直接読取点は原回答から約57m北西で、原回答点を写した値ではない。','親レビューで南100台区画と航空写真の囲いの対応を確認。現在の屋外配布位置への関係は既存公式/ユーザー回答を継承。2021写真は現駐車線や在庫を保証しない。'),
40:('candidate_for_independent_review','はぴす・味彩センター・東側道路交差を位置合わせの基準にし、水色仮設棟の内部点を独自導出。未使用のこもれび・池は約9.7m/6.6m差。原訂正クリックとは約8m差で、計算入力には未使用。','親の独立レビュー。写真2019には仮設棟がなく、現棟の存在・範囲は公式配置図と回答済み建物同定に依拠。写真だけから新棟を見たとはしない。'),
41:('candidate_requires_ground_correspondence_review','JR公式画像の2024年保存版を取得、図自体は2023年10月現在。1Fに古河観光案内所が明示。東西口自由通路とVAL南端を写真に対応させ、ブース表示から独自点を試算。未使用の東口南側端は約1.9m差。','親レビューで自由通路の両端を屋根/舗装から読む対応を確認。四隅は地上測量ではなく、屋根倒れ・ひさし・図の省略が残る。約1.9mを絶対精度やブース寸法保証にしない。')}
for n in [7,13,14,40,41]:
 cr=[r for r in calc if r['number']==n];chosen=cr[-1];status,finding,remaining=findings[n]
 r={'number':n,'facilityId':ids[n],'status':status,'finding':finding,'remaining':remaining,'adoptionApproved':False,'coordinate':chosen.get('coordinate'),'calculationIndices':[calc.index(x) for x in cr],'photoEdition':J(O/'photo-editions.json')[str(n)],'userOrPreviousPointForComparisonOnly':user[n],'numericOrigin':'GSI tile pixel inverse projection plus official-plan facts; no Google numeric input to derivation','absoluteAccuracyMeters':None}
 if r['coordinate']:r['comparisonDistanceMeters']=round(dist(r['coordinate'],user[n]),3)
 if n==7:r['comparisonPointNote']='This comparison is original address API projected candidate, NOT user Google point; user proximity 1.68m retained from task brief only.'
 rows.append(r)
(O/'assessment.json').write_text(json.dumps({'asOf':'2026-11-06','rows':rows,'notAnApproval':True,'headAtStart':'f56eee7f0b412767b02f2f6cb7a4b58ac6a8f8a5'},ensure_ascii=False,indent=2)+'\n')
(O/'candidates.json').write_text(json.dumps([r for r in rows if r['status'].startswith('candidate')],ensure_ascii=False,indent=2)+'\n')
for n in [40,41,14]:
 r=next(x for x in calc if x['number']==n and x.get('controls'))
 p=O/('40-plan.jpg'if n==40 else f'{n}-plan.png');im=Image.open(p);d=ImageDraw.Draw(im)
 for i,c in enumerate(r['controls']):
  x,y=c['planPixel'];d.ellipse((x-8,y-8,x+8,y+8),outline='blue',width=3);d.text((x+10,y),f'fit{i}',fill='blue')
 for i,c in enumerate(r['holdouts']):
  x,y=c['planPixel'];d.ellipse((x-8,y-8,x+8,y+8),outline='green',width=3);d.text((x+10,y),f'check{i}',fill='green')
 x,y=r['planTarget'];d.ellipse((x-8,y-8,x+8,y+8),outline='red',width=3);im.save(O/f'{n}-plan-annotated.png')
print([(r['number'],r.get('coordinate'),r.get('comparisonDistanceMeters'))for r in rows])
