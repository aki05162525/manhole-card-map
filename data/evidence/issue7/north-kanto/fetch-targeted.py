# Re-fetch only when intentionally repeating research; verification requires no network.
from additional import fetch,save,ids
pairs=[
('https://www.city.shibukawa.lg.jp/shisetsu/000346/p003056.html','shibukawa-sewerage'),
('https://www.city.moriya.ibaraki.jp/shisei/profile/1004324/1004325/index.html','45e8eab7ba6d2bdde8e5'),
('https://www.city.oyama.tochigi.jp/data/doc/1772432999_doc_311_0.pdf','8c9c3d00b39e57cb61d7'),
('https://www.city.nasukarasuyama.lg.jp/page/page000546.html','186aaf0b34375b1f039d'),
('https://www.city.ryugasaki.ibaraki.jp/kurashi/todokede/syuttyoujyo/2016050200152.html','e9c407539fac35ab201d')]
if __name__=='__main__':save('targeted-fetch-records.json',[fetch((u,[i for i in ids if i.endswith(s)])) for u,s in pairs])
