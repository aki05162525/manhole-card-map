from research import *
queries={0:'荒川水循環',1:'荒川水循環',2:'元荒川水循環',3:'新河岸川水循環',4:'中川水循環',5:'古利根川水循環',6:'荒川上流水循環',7:'市野川水循環',8:'小山川水循環',15:'キュポ',18:'上下水道局',20:'所沢市役所',22:'野老澤',23:'YOT',24:'飯能商工会議所',26:'環境浄化センター',32:'本庄早稲田',34:'狭山市市民交流',35:'キヤッセ',36:'ひなの里',38:'天空の里',40:'深谷テラス',41:'道の駅おかべ',42:'道の駅かわもと',43:'上尾市上下水道',44:'お土産・観光センター',45:'草加宿芭蕉庵',46:'草加市文化会館',47:'越谷市市民活動',49:'水辺のまちづくり',50:'新曽南',51:'さくらパル',52:'戸田公園駅前行政',57:'中山道宿場館',58:'桶川市観光協会',59:'富士見市役所',61:'蓮田駅西口',62:'蓮田市中央公民館',63:'石井水処理',64:'日高市浄化',65:'日高市役所',66:'高麗公民館',67:'ラッピーランド',68:'ふじみ野市役所',71:'ふじみ野市役所',72:'伊奈町総合センター',73:'伊奈町上下水道',76:'むすびめ',77:'川島町コミュニティ',79:'吉見百穴',80:'Yotteco',81:'新しい村',82:'宮代町上下水道',83:'無印良品 東武'}
rows=[]
for i,q in queries.items():
 u='https://www.saitama-support.jp/map/search/index?keyword='+urllib.parse.quote(q)
 m=fetch(u);soup=BeautifulSoup(content(m),'html.parser')
 links=list(dict.fromkeys((a.get_text(' ',strip=True),urllib.parse.urljoin(u,a['href']).split('#')[0]) for a in soup.select('td.name a[href]')))
 rows.append({'index':i,'query':q,'url':u,'results':links});print(i,q,links,flush=True)
 (ROOT/'directory-results.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
