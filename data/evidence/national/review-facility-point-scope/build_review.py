import json,hashlib,re,copy,zipfile
from pathlib import Path
from inspect import rows,txt
ROOT=Path('data/evidence/national/review-facility-point-scope')
# Explicit per-record findings from the primary documents, not a scope-label rule.
N={
0:'県観光原本は2020年更新の資料館で、4棟を復元した「外観」と館内シアターを説明。市配布原本は同館受付（入館せず受取可）を指定。港・緑地全体ではなく、この資料館の公開目的地点として採用。',
1:'県原本は土偶のお腹をイメージした博物館建物を説明し、縄文広場・隣接する年縞博物館とは区別。町配布原本も若狭三方縄文博物館を指定。博物館の公開点として採用。',
2:'施設自身のaccessに吾妻町426番地と施設マーカーがある。市原本はこのプラザ1階管理事務室と明記。建物の公開点で案内可能で、1階の室内座標は要求しない。',
3:'県原本は源泉浴場・露天風呂のある「原町温泉 ゆくら妻有」を案内。市原本にはミオンなかさと休館日の木曜日に同館で配布する記載がある。季節・曜日条件は変えず温泉施設の建物目的地点を採用。',
4:'市配布本文は富山市民芸術創造センター受付を指定し、同じ原本のmarkers[4]が当該センターのカード配布先を名指しする。市全体のpoints中心と区別でき、受付を含む施設建物の案内点として採用。',
5:'市原本の配布方法は「入口受付」。Googleリンクのfeatureは勝興寺全体であり、入口受付の建物を特定する情報ではない。寺院本堂・境内代表点を受付建物に読み替えない。',
6:'県原本は旧敦賀港駅舎を再現した資料館の建物を説明。市配布原本も同資料館窓口を指定する。港やムゼウムとは別の個別資料館として採用。',
7:'市施設原本の本文は水道記念館所在地を足羽1丁目7番35号と指定し本文に施設地図を置く。市配布原本の休日配布先も同記念館。フッターの市役所・上下水道局地図と分離されている。',
8:'GIS OBJECTID=23は「佐渡市役所」。市配布原本は本庁総合案内だが、根拠に挙げた市民センター一覧では同じ千種232の金井市民センターは「佐渡市役所第2庁舎1階」。旧市役所が現市民センターになったとの説明は誤り。GIS点が本庁舎を指す棟別裏付けが不足。',
9:'市CSV NO=19は中央公民館自身の行（元町13-1）で分館の別行とは区別される。市配布原本は令和6年9月30日から同館で月曜等に配布すると明記する。建物を対象とする公開施設点を採用。',
10:'県原本のGeoCoordinatesは佐渡金銀山ガイダンス施設「きらりうむ佐渡」自身を対象とし住所は18番地1。市配布原本は18番地だが県ページは市公式施設ページ5294へ直接リンクしており、市公式館内案内5306は総合インフォメーション・展示室を備えた同一ガイダンス館を説明。住所の省略一致だけでなく施設リンクと館内機能で同定。18を18-1へ台帳変更せず建物点を採用。',
11:'GIS OBJECTID=24は両津支所。市配布原本は令和8年4月1日の両津市民センターへの名称変更と所在地不変を明記。現行連絡先一覧も同建物2階の各課を示す。旧名だけを現在名と推測したものではない。',
12:'市の当該配布リンクの展開先featureは「交流物産館 あぐりの里」であり、単なる道の駅敷地全体でない。市本文の「道の駅越後川口あぐりの里」と結び付き、物産館への案内地点として採用。',
13:'GIS OBJECTID=23は佐渡市役所全体。配布原本は本庁の宿日直室だが、市民センター一覧の金井市民センターは同番地の第2庁舎。旧名称・電話番号を現市民センターと同定したという説明は成立しない。本庁舎と第2庁舎を区別する位置根拠が不足。',
14:'GIS OBJECTID=34の赤泊行政サービスセンターを、市配布原本の名称変更・所在地不変の記載と現行センター一覧（1階・電話0259-87-3111）で同定。建物点を共有し、宿直室の室内位置とはしない。',
15:'県原本は新津鉄道資料館の1階常設展示・2階企画展示と屋外展示を区別。市配布本文もこの資料館（新津東町2-5-6）を指定。館の公開点を採用し、屋外車両展示や周辺高校の点へ置換しない。',
16:'県原本は時代館・石油記念館・物産館・レストラン・公園が集まる道の駅全体を説明し、その全体のGeoCoordinatesである。町配布原本は時代館受付を指定。時代館と物産館のどちらを数値点が指すか未確定。',
17:'町配布原本は「穴水町物産館四季彩々」。座標原本は穴水駅併設の「道の駅あなみず」で、販売機能は説明するが四季彩々という建物と数値点の対応を明記しない。駅・道の駅・物産館の同定を同番地だけで完了できない。',
18:'市CSV NO=75は三条下水処理センター全体の行。市配布原本はセンターでの配布を確認できるが、処理施設敷地内の窓口のある管理建物とCSV点を結ぶ根拠がない。広い処理場を建物点に昇格しない。',
19:'県原本はイトヨを観察し生態を学ぶ本願清水イトヨの里施設を対象とする。市配布原本も同館（糸魚町8-44）を指定。清水の自然水域一般ではなく展示施設の公開目的地点として採用。',
20:'市配布ページの住所文字列に付くリンクを読んだところ、URLのplace名は「砺波市観光案内所」でfeature ID付き。別リンクのヤロバの泉（蓋側）と分離されている。住所検索点ではなく、配布案内に明示された案内所の建物目的地点として採用。',
21:'県原本は室内プール・スケートリンク・浴場・総合受付のあるアクアパークを説明し、市配布案内の同施設と一致。広域公園ではなく複合屋内施設の公開目的地点として採用。',
22:'運営者access本文は「越坂18字18番１」で、直後のGoogle Mapを見るリンクを展開したfeatureがイカの駅つくモール（ID 0x50624158121f0471）。18字6番1は外部のルート文字列に現れる別表記であり採用住所の根拠にしない。運営者が自らこの建物へのアクセスとして結んだfeatureを使うため、同名・同番地だけの同定ではない。',
23:'三条鍛冶道場自身の公式アクセスが元町11-53とGoogle Mapリンクを掲げ、展開先featureも三条鍛冶道場。市配布案内が同道場での配布を指定。建物目的地として採用。',
24:'市配布本文は牛島本町二丁目1番20号の上下水道局1階給排水サービス課。markers[3]はこの配布先そのものを名指しし、別の市役所西館とは区別される。局の建物案内点を採用。',
25:'市配布本文は長岡花火ミュージアム内を明示。公式リンクの展開先featureも「長岡花火ミュージアム」である。道の駅全体や物産棟の点でないことをfeature名で確認し採用。',
26:'GIS OBJECTID=29は畑野行政サービスセンター。市配布原本は令和8年4月1日から畑野市民センターとなり所在地不変、休日は裏口宿直室と明記。現行一覧も同住所・電話と2階の各課を示す。建物点は採用でき、裏口の測位は不要。',
27:'県原本はおしゃぎりを館内展示する村上市郷土資料館を対象とし、若林家住宅・村上歴史文化館は共通券の別施設として記載する。市配布原本の同会館へ案内する建物公開点として採用。',
28:'県原本は道の駅胎内を「たるが橋観光交流センター」と明記し、その中で観光案内を行うこと、問い合わせ先が胎内市観光協会であることを記載。市配布原本の協会と運営・機能を結び付けられ、同番地だけに依存しない。センター建物の公開点として採用。',
29:'県原本はラブロ恋路の客室・大浴場をもつ宿泊建物を説明。配布先も同施設で、海岸全体や恋路駅の点ではない。宿泊施設の建物目的地点を採用。',
30:'公式FAQは組合への西門からの入り方を説明し、展開先featureは「中新川広域行政事務組合総務課」。配布先は下水道課。総務課と下水道課が同一建物である棟・配置根拠を原本から確認できず、同じ国重242という所在地のみで共有しない。',
31:'市配布本文がCiCビル3階の国際交流センターを指定し、markers[1]が同配布先を指す。駅全体の点ではなくCiC内施設の明示マーカーとして採用。階・室内測量を必要条件としない。',
32:'県原本はサンプラザ内の1階飲食店・2階逸品館を説明し、総合産業会館という建物を対象にしている。市配布原本の同館へ案内できる建物公開点として採用。',
33:'県原本はSORAIRO国上全体として温泉・公園・キャンプ・市場をまとめる。配布先名はふれあい交流センターを含むが、この棟とGeoCoordinatesの対応は示されない。市場や温泉の代表点を交流センター点として確定できない。',
34:'公式リンクのplaceは「加茂七谷温泉美人の湯」、featureの!3d/!4dと本文のアクセスに対応する温泉施設。表示中心@やBBQ広場を採用せず、配布施設建物の目的地として採用。',
35:'県原本は江戸期の紙漉き家屋を移築改修した卯立の工芸館と明記。紙の文化博物館・パピルス館とは別の施設ページである。和紙の里全体でなく個別建物の公開点を採用。',
36:'県原本は燕市産業史料館の展示・体験を紹介する個別施設で、市配布原本も同史料館を指定。工業地域全体や近隣の体験事業者ではなく、史料館の公開目的地点として採用。',
37:'市配布本文とmarkers[9]はいずれも路面電車等公共交通案内所を名指しし、富山駅全体ではない。駅停留場内の案内施設への目的地点として採用し、8番ホーム側窓口の精密位置とはしない。',
38:'県原本は道の駅のショップ・レストランを案内し、市配布原本も道の駅を指定。ただし公開点と実際の配布受付のある建物の対応（屋外コキア畑等を除く）が保存原本では明示されず、敷地内建物の特定は保留。',
39:'市本文の西棟3階に対し、公式リンク展開先feature自体が「シティホールプラザ アオーレ長岡 西棟」。東棟の総合窓口や広場とは分離できる。西棟の建物目的地点として採用。',
40:'市配布本文はミライエ長岡3階、公式リンク展開先も米百俵プレイス ミライエ長岡という建物feature。3階室内位置を要求せず採用。',
41:'市本文は市民プラザ1階管理事務所、markers[5]も市民プラザのカード配布先を指定する。隣接する城址公園や市役所の点ではない。建物の明示配布目的地点を採用。',
42:'県原本は宿泊の「本館」「新館」を別に記載する複合温泉施設。市配布本文はミオンなかさとを指定するが、配布受付の棟と施設GeoCoordinatesの対応までは確認できない。',
43:'県原本は錦鯉の里の庭池・日本庭園・屋内水槽を含む展示施設を説明する。配布先は同施設だが、施設全体のGeoCoordinatesが受付建物を指す根拠は不足。庭園点を建物点と扱わない。',
44:'県原本は市民交流センター「ネーブルみつけ」内のみらい市場、喫茶、ギャラリーを明記し、1階・屋上駐車場を持つ建物として説明。配布先みらい市場が当該建物内にある関係を確認できるため採用。',
45:'GIS OBJECTID=28の新穂行政サービスセンターと現行新穂市民センターを、市配布原本の名称変更・所在地不変、現行一覧の1階部署と電話で結ぶ。建物公開点として採用。',
46:'市配布本文は道の駅雨晴2階売店を指定し、直結したGoogle featureも道の駅雨晴。階を持つ当該駅舎を目的地としているため採用。雨晴海岸や蓋の地点とは別。',
47:'県原本は「館内には…観光案内所」と明記し、まつだい駅併設のふるさと会館を対象にする。配布案内所の入居建物が原文から確認でき、会館目的地点として採用。',
48:'県の個別施設名は「道の駅 笹川流れ 夕日会館」でJR桑川駅併設の施設として説明。海岸全域でなく配布対象の夕日会館の目的地を指すため採用。橋・公園・展望台への窓口精度を主張しない。',
49:'市配布本文と公式Google featureは道の駅R290とちお全体を対象にする。物産等の配布受付の所在建物を原本で分離できないため、道の駅全体を建物確定点にはしない。',
50:'市配布原本がまちからの名称・西本町3-2-8と施設地図リンクを一体で掲載し、展開先featureもかしわざき市民活動センター。建物目的地として採用。',
51:'市観光原本の個別案内所ページと市配布原本が中央1丁目2-1のまちなか案内所を指定する。ハピリン総合受付は原本の別スポットとして区別され、駅前広場全体の点とはしない。案内所の公開点として採用。',
52:'町施設原本は「穴水町役場」の施設詳細で、initlat/initlongを参照JSがMarker.positionへ渡す。町配布原本は役場会計課と休日の日直を指定し、別の物産館配布先とも区別。役場建物の目的地として採用。',
53:'県原本は岩瀬カナル会館の館内飲食・物販・観光情報を説明。市配布原本はその1階管理事務所。運河や水上ライン航路全体の点でなく会館の公開点として採用。',
54:'県原本は四つの展示室を持つ長善館史料館を説明し、市配布原本の粟生津97番地の同館と結び付く。歴史的学塾の地域全体ではなく史料館の公開点として採用。',
55:'公社配布原本は「新潟浄化センター管理棟2階事務室」だが、明示リンクのfeatureは新潟浄化センター全体。管理棟の位置を識別する原典がない。「建物代表点」と断言した現evidenceは過大。',
56:'県原本はTOPPAKUの常設展示・企画展示を持つ博物館を説明し、市配布原本は令和2年更新の同館を指定。西本町一丁目448番地9の博物館個別地点として採用。',
57:'県原本は産直館織姫市場・フードコート・情報コーナー・ドッグランを含む道の駅全体を説明。町配布原本は道の駅までしか指定せず、公開点が配布を扱う建物を指す根拠は不足。',
58:'施設GIS OBJECTID=19は「南佐渡総合案内所(マリンプラザ小木)」という具体的な案内施設。市配布原本は南佐渡観光案内所（小木町1935番地26）。港全体ではなくマリンプラザの案内施設として特定できる公開点を採用。',
59:'市原本のmarkers[2]は本丸1番45号の「まちなか観光案内所」を個別に指定する。城址公園全体の中心ではないため、案内所建物の目的地点として採用。',
60:'県原本はホテルのロビー・館内レストランと、敷地内の別グランピング施設を区別する。市配布原本はロイヤル胎内パークホテルを名指し。ホテルの公開目的地点を採用し、別ドームの点とはしない。',
61:'県原本は漁業文化交流センター内のシアター・飲食を説明。市原本は令和8年4月から同センターへの配布先変更を明記。旧氷見駅観光協会や漁港全体でなくセンター建物を採用。',
62:'市配布本文は西館2階だがmarkers[0]の対象名は「富山市役所」のみでリンクも市トップ。西館と他館の配置・数値点の対応を確認できない。配布先一覧のマーカーであることだけでは西館の建物特定にならない。'
}
deferred={5,8,13,16,17,18,30,33,38,42,43,49,55,57,62}
K={
1:'市の現行原本は鶴ヶ峰駅南口からココロットに入り、エレベーターで4階へ向かう導線まで示す。P05の施設名はこのみなくるで、単なる駅名や住所点ではない。建物入居関係は成立するが、P05の出典・原座標系・加工内容の追補が必要。',
2:'DBは桜木町駅観光案内所という個別LocalBusinessで、市配布原本のJR南改札正面の案内所と機能が一致。ただし建物内対応の追加裏付けと、DB由来座標の再公開・保存原本の公開条件が未確定。市公式tic取得失敗をDBの自由利用と読み替えない。',
4:'DBは与瀬1183（相模湖駅前）の個別案内所。市配布原本も同案内所を指定するが、DB利用条件はP05と異なり、公開マップへの抽出再利用と原本公開の許諾が確認できない。座標が誤りと断定せず保留。',
12:'市配布原本と地元協会案内に茅ヶ崎市観光案内所があり、DBも同案内所の個別レコード。ただし同一番地以外の建物との位置対応が十分でなく、DBの抽出再利用・原本公開条件も未解決。',
13:'市配布原本は道の駅湘南ちがさきサービスカウンターを指定。運営者施設案内は1階ショップ・2階フードコートを備える施設と情報コーナーを説明し、運営者自身のGoogle MAPリンクが当該施設featureを指す。公式フロアマップp1を画像でも読み、サービスカウンターが農産物売場・レジと同じ主建物1階にあり、右側の24時間道路情報・トイレ部分とは異なることを確認。運営者の主施設featureをこの建物の案内点として採用。',
14:'市・運営協会とDBは上宮田1450-4の観光インフォメーションセンターを指す。ただしDBの抽出再利用・原本公開条件を確認できず保留。三浦市役所の移転とは別対象であり、本件から庁舎移転を自動承認しない。',
15:'運営観光協会は秦野駅改札横の案内所を説明し、DBは案内所固有LocalBusiness。駅内施設の同定は可能だが、DB由来座標の公開利用・保存原本公開の許諾は確認できない。建物精度不足だけを理由に排除するものではない。',
17:'市現行施設案内は改札から南口方面へ直進し小田急マルシェ伊勢原2階と具体的な建物を示す。P05の市役所駅窓口センターという専用施設Pointを対応させられるが、出典表示とJGD2011・抽出方法の明示が必要。',
26:'町配布原本は役場1階生活環境課窓口を明記。P05の役場Pointは部署と別の大規模公園等ではなく、1階窓口を含む役場建物の公開点として利用可能。ただし出典・原座標系・加工内容を明記してから採用。',
27:'町配布原本は役場1階夜間休日窓口を明記。平日窓口と同じ役場建物の公開Pointを共有でき、室内窓口位置は不要。ただしP05出典・原座標系・加工内容の追補が必要。',
31:'村配布原本と庁舎案内415は役場1階環境上下水道課を明記し、同番地のせせらぎ館とは区別できる。P05の清川村役場Pointを建物案内に使えるが、出典・JGD2011・抽出加工の明示が必要。',
32:'村配布原本は清川村役場1階宿直室窓口。庁舎案内とP05役場Pointにより建物を案内できる。同番地のせせらぎ館を流用せず、P05出典・JGD2011・抽出加工の明示後に採用。'
}
C={6:'市CSVは観賞植物園という園全体の行。市施設原本6709は大温室・サボテン温室、7829は植物園窓口を説明するが、CSV点が窓口建物に対応する記載はない。園点を受付建物に読み替えず保留。',12:'県原本は渚の博物館・海辺の広場・海のマルシェ・食堂をまとめた複合施設。市配布本文は渚の駅とだけ指定し、GeoCoordinatesと配布受付建物の対応が未確定。蓋の設置図は採用しない。',21:'県原本は緑花木市場・東金マルシェ・レストラン・イベント広場等をまとめた道の駅の公開点。配布を扱う建物がこの数値点の対象であるとの棟別根拠がなく保留。',25:'県・市原本は母屋、土蔵、旧漉場、門・塀等を含む9棟の歴史的建造物を説明する。配布受付建物と施設代表点の対応が不明なため保留。9棟すべてが受付用の建物とは解釈しない。',34:'運営者原本は道の駅を農産物直売所と店内喫茶・情報コーナーとして説明し、姉妹店「空の駅」は別施設と明記する。accessのJSは道の駅専用myLatlngをMarker.positionに使い、空の駅と表示中心は別変数。町配布原本の休日配布先もこの店舗。店舗建物の公開アクセス点として採用。'}
P05={1,17,26,27,31,32}
chain={x['facilityId']:x for x in json.load(open('data/evidence/national/locations-chubu-east-north/evidence-chains.json'))}
kreview={x['facilityId']:x for x in json.load(open('data/evidence/national/kanto-south-locations-kanagawa/review.json'))}
manifest=[]
for d in ['locations-chubu-east-north','kanto-south-locations-kanagawa','kanto-south-locations-chiba']:
 manifest+=json.load(open('data/evidence/national/'+d+'/manifest.json'))
manifest+=json.load(open(ROOT/'additional-manifest.json'))
by_path={str(Path(x['snapshotPath']).resolve()):x for x in manifest if x.get('snapshotPath')}
def ref(p,url=None):
 p=Path(p); b=p.read_bytes();m=by_path.get(str(p.resolve()),{});return {'snapshotPath':str(p.resolve().relative_to(Path.cwd())), 'snapshotSHA256':hashlib.sha256(b).hexdigest(),'sourceUrl':url or m.get('url'),'role':'primary-source'}
results=[];readings=[];corrections=[]
for r in rows:
 g,i,u,t=r['group'],r['index'],r['update'],r['target'];fid=u['facilityId'];e=u['evidence'];supp=[]
 if g=='chubu-east-north':
  reason=N[i];status='deferred' if i in deferred else 'accepted'
  for v in chain[fid].values():
   if isinstance(v,dict) and v.get('snapshotPath'):supp.append(v['snapshotPath'])
  if i in {8,11,13,14,26,45}:supp.append('data/evidence/national/locations-chubu-east-north/84894a0ed2bff76b8514d658.html')
  if i==10:supp+=['data/evidence/national/review-facility-point-scope/12628250cd38dfa3cd34.html']
 elif g=='kanto-south-kanagawa':
  reason=K[i];status='correction-required' if i in P05 else 'accepted' if i==13 else 'deferred'
  supp += [x['snapshotPath'] for x in kreview[fid]['attempts'] if x.get('snapshotPath') and x.get('status')==200]
  if i==13:supp += [str(ROOT/'2910e80e494045fe5dce.html')]
  if i in P05:supp+=['data/evidence/national/kanto-south-locations-kanagawa/28d45067bfd5191b2a49.html',str(ROOT/'8b3d596123345c99c3b6.html')]
  elif i!=13:supp += [str(ROOT/'e3435082ce53dfe3d1c2.html'),str(ROOT/'b4ba1e3d3a7910c39004.html')]
 else:
  reason=C[i];status='accepted' if i==34 else 'deferred'
  if i==6:supp+=['data/evidence/national/kanto-south-locations-chiba/c0460dea841a452c5024.html','data/evidence/national/kanto-south-locations-chiba/db1545098bfd31e07c8b.html']
  if i==34:supp+=['data/evidence/national/kanto-south-locations-chiba/7c9c6fcd03a5d4ecc5f5.html','data/evidence/national/kanto-south-locations-chiba/aae02d8990a3046a60a4.html']
 paths=list(dict.fromkeys([e['snapshotPath'],t['evidence']['snapshotPath']]+supp))
 sources=[ref(p) for p in paths]
 for source in sources:
  if source['sourceUrl'] is None:
   if source['snapshotPath']==e['snapshotPath']:source['sourceUrl']=e['sourceUrl']
   if source['snapshotPath']==t['evidence']['snapshotPath']:source['sourceUrl']=t['evidence']['sourceUrl']
 scope='building-representative' if status in ['accepted','correction-required'] else 'facility-only-building-unresolved'
 if g=='kanto-south-kanagawa' and i in {2,4,12,14,15}:scope='named-office-point-reuse-unresolved'
 rec={'facilityId':fid,'patchPath':'data/national/location-updates/'+g+'.json','updateIndex':i,'name':t['name'],'address':t['address'],'coordinate':u['coordinate'],'status':status,'buildingScope':{'assessment':scope,'intendedDestination':t['name'],'indoorOrFloorSurveyRequired':False,'reason':reason},'sourcesRead':sources,'reason':reason}
 if status=='deferred':rec['requiredBeforeAdoption']='配布建物と当該数値点を結ぶ公式の棟別案内・個別施設featureを追加確認する。' if scope!='named-office-point-reuse-unresolved' else '利用条件を満たす保存・公開方法を確認するか、別の自治体・運営者原典の個別施設点へ差し替え、必要な建物対応も確認する。'
 if g=='kanto-south-kanagawa' and i in P05:
  old=copy.deepcopy(e);new=copy.deepcopy(e)
  new['sourceLocator'] += ' 原本ZIP内P05-22_14.geojsonのcrsはEPSG:6668（JGD2011）、coordinates順は経度・緯度。元座標値を変換せず抽出（WGS84への変換済みとの主張はしない）。出典：国土交通省「国土数値情報 市町村役場等及び公的集会施設データ」2022年4月、https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P05-v3_0.html。名称を現行配布窓口と照合しレコード抽出・lat/lng字段への組替えを実施。'
  new['verificationMethod']='AIがP05原本の施設レコードと現行公式の入居建物・階・導線案内を照合した。公開施設Pointを建物案内に用いるもので室内・入口を測量した値ではない。原座標系はJGD2011（EPSG:6668）、座標変換は行っていない。国土交通省データの出典と抽出加工を公開成果にも表示する。原ZIPを保存し、抽出レコードは派生資料として区別する。'
  fix={'facilityId':fid,'path':'/updates/'+str(i)+'/evidence','old':old,'new':new,'changesCoordinate':False,'additionalAdoptionConditions':['公開成果で国土交通省のデータ名・原典URL・抽出加工の出典表示を行う。','JGD2011の公開Pointとしての精度を維持し、室内・入口精度やWGS84変換済みと表示しない。','原本ZIPとhashを保持する。抽出Featureだけをダウンロード原本と呼ばない。']}
  corrections.append(fix);rec['evidenceCorrection']=fix
  rec['requiredBeforeAdoption']='添付old/new evidence訂正と公開時の出典表示・座標系の扱いを親で反映。座標値の変更提案はない。'
 if g=='chubu-east-north' and i in {5,8,13,30,55}:
  new=copy.deepcopy(e);new['verificationMethod']='AI原典再照合。'+reason+' 現段階では建物地点として採用保留。'
  fix={'facilityId':fid,'path':'/updates/'+str(i)+'/evidence','old':copy.deepcopy(e),'new':new,'changesCoordinate':False,'warning':'説明を訂正しても位置採用条件は満たさない。追加の建物同定が必要。'};corrections.append(fix);rec['evidenceCorrection']=fix
 results.append(rec)
 # Review digest; primary bytes remain at their existing immutable paths.
 extracts=[]
 for source in sources:
  p=source['snapshotPath']
  if p.endswith('.zip'):
   z=zipfile.ZipFile(p);d=json.loads(z.read('P05-22_14.geojson'));fs=[f for f in d['features'] if f['geometry']['coordinates']==[u['coordinate']['lng'],u['coordinate']['lat']]]
   extracts.append({'source':source,'crs':d.get('crs'),'matchingFeatures':fs});continue
  b=Path(p).read_bytes()
  if b.startswith(b'%PDF'):continue
  s=txt(p);ls=s.splitlines();ix=set();keys=[t['name'],t['name'].split(' ')[0],'配布場所','受付','窓口','建物','棟','所在地','住所','階','無断転','出典','JGD2011','18番','18字','総合インフォメーション']
  for j,l in enumerate(ls):
   if any(k and k in l for k in keys):ix.update(range(max(0,j-1),min(len(ls),j+3)))
  # Preserve selected contextual excerpts, not just the other agent's conclusion.
  extracts.append({'source':source,'textExcerpts':['\n'.join(ls[j] for j in sorted(ix))[:14000]]})
 readings.append({'facilityId':fid,'readings':extracts})
counts={g:{s:sum(x['status']==s and x['patchPath'].endswith(g+'.json') for x in results) for s in ['accepted','deferred','correction-required']} for g in ['chubu-east-north','kanto-south-kanagawa','kanto-south-chiba']}
report={'schema':1,'reviewedAt':'2026-11-05','actorType':'ai','purpose':'現行マップで配布先を案内できる建物目的地点の独立レビュー','reviewedCount':len(results),'summary':counts,'acceptedFacilityIds':[x['facilityId'] for x in results if x['status']=='accepted'],'deferredFacilityIds':[x['facilityId'] for x in results if x['status']=='deferred'],'correctionRequiredFacilityIds':[x['facilityId'] for x in results if x['status']=='correction-required'],'criteria':['scopeの語による一律採否ではなく原典の対象を判定。','建物の公開施設目的地点は利用可能。室内窓口・階・入口の測量を要求しない。','同名・同番地のみでは認定せず、配布原典の入居関係、個別棟feature、現行建物案内と照合。','複数棟・寺院境内・処理場・園全体は建物との対応が確認できなければ保留。','acceptedは建物案内用途の推奨であり、元台帳への反映・全利用条件の法的保証ではない。','三浦庁舎の移転proposalは審査対象外で自動採用しない。'], 'evidenceCorrections':corrections,'results':results,'sourcePolicyFindings':[
 {'source':'P05-22','finding':'P05原本GeoJSONのCRSはEPSG:6668/JGD2011。原ZIPのまま保存されhashがある。今回の抽出レコードは派生物。6件は建物案内の意味は確認できるが、出典・抽出加工・原座標系の説明を添付訂正案で補う。CC BY4.0と他DBを同一扱いしない。追加取得した現行国交省規約は2026-03-23からPDL1.0適用と記載するため、現行表示はその原本を参照。'},
 {'source':'JAPAN 47 GO','finding':'運営者aboutは無料閲覧とコンテンツの無断転用・転載禁止を併記し、DB活用案内は別に利用相談・見積を案内。座標そのものの法的権利を断定しないが、本リポジトリの抽出再利用・HTML原本公開が許諾済みと確認できないため5件保留。P05のオープンデータ条件を流用しない。'},
 {'source':'Google','finding':'原公式ページの明示リンク由来featureのみ照合。/@表示中心・viewport・住所ジオコードを新規作成していない。施設featureであっても勝興寺や新潟浄化センター全体は受付棟の根拠にならない。'}],
 'documentationCodeDiscrepancies':[], 'evidenceDiscrepancies':[{'facilityIds':[rows[i]['update']['facilityId'] for i in [8,13]],'finding':'佐渡市役所を旧名称として現市民センターと住所電話で同定した記述は原本に反する。金井市民センターは同番地の第2庁舎1階、電話0259-63-3843であり、市役所代表0259-63-3111と異なる。'},{'facilityIds':[rows[55]['update']['facilityId']],'finding':'管理棟を示すとしたverificationMethodに対し、URL feature名は新潟浄化センター全体。'},{'facilityIds':[rows[5]['update']['facilityId']],'finding':'寺院の建物代表点という記述に対し、配布原典は入口受付。寺全体featureでは受付棟未同定。'}],
 'limitations':['親で成功済みの数値・hash・公式リンクvalidate.pyの結果を前提にした独立scopeレビュー。既存validate.pyやbuildは元成果を更新し得るため再実行していない。','現地調査・建物輪郭の測量はしていない。未確認の建物対応は保留として残す。','元台帳、他担当成果、コード、commit、push、PRは変更していない。']}
Path('data/national/reviews/facility-point-scope.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(ROOT/'primary-readings.json').write_text(json.dumps(readings,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(counts,ensure_ascii=False));print('records',len(results),'corrections',len(corrections))
