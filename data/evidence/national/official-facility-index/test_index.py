#!/usr/bin/env python3
import hashlib,io,json,re,unittest,zipfile,xml.etree.ElementTree as ET
from build import address,classify,is_confirmed
from fetch import E,W,ROOT
class IndexTests(unittest.TestCase):
    def test_lot_and_municipality_not_erased(self):
        row={'name':'中央公民館','address':'土浦市大手町13-9'}
        self.assertEqual(address('茨城県土浦市大手町13番9号'),row['address'])
        self.assertIsNone(classify({'name':'中央公民館','address':'大阪府堺市大手町13-9'},row))
        self.assertFalse(classify({'name':'中央公民館','address':'茨城県土浦市大手町13-10'},row)[2])
        self.assertIsNone(classify({'name':'一中公民館','address':row['address']},row))
    def test_regional_coordinate_schema(self):
        self.assertTrue(is_confirmed({'coordinate':{'lat':36.1,'lng':140.2}}))
        self.assertFalse(is_confirmed({'coordinate':{'status':'unconfirmed'}}))
    def test_sources_and_axis_against_gml(self):
        z=zipfile.ZipFile(W/'P05-22_GML.zip')
        d=json.loads((ROOT/'data/national/location-updates/official-facility-index.json').read_text())
        self.assertEqual(len(d['updates']),3)
        self.assertTrue(all(c['status']!='confirmed' for c in d['candidates']))
        self.assertFalse(set(u['facilityId'] for u in d['updates']) & set(c['facilityId'] for c in d['candidates']))
        for u in d['updates']:
            p=u['candidate']['datasetPoint'];outer,loc=p['locator'].split('!');member,index=loc.split('#/features/');i=int(index)
            sub=zipfile.ZipFile(io.BytesIO(z.read(outer)));raw=sub.read(member)
            self.assertEqual(hashlib.sha256(raw).hexdigest(),p['memberSHA256'])
            f=json.loads(raw)['features'][i];self.assertEqual(f,p['rawFeature'])
            lng,lat=f['geometry']['coordinates'];self.assertEqual((u['coordinate']['lat'],u['coordinate']['lng']),(lat,lng))
            # Independent GML representation checks no lon/lat reversal or invented datum shift.
            xml=sub.read(member.replace('.geojson','.xml')).decode('utf-8')
            # Source GML has malformed publicOfficeClassification tags with spaces.
            # Read only raw Point blocks, never repair or reinterpret source attributes.
            blocks=re.findall(r'<gml:Point\b[^>]*>.*?</gml:Point>',xml,re.S)
            points=[ET.fromstring('<root xmlns:gml="http://schemas.opengis.net/gml/3.2.1/gml.xsd">'+b+'</root>')[0] for b in blocks]
            pairs=[tuple(map(float,v.find('{*}pos').text.split())) for v in points]
            self.assertTrue(any(abs(a-lat)<1e-7 and abs(b-lng)<1e-7 for a,b in pairs))
            for ev in [u['evidence'],u['distributionEvidence'],u['datasetEvidence']]:
                self.assertEqual(hashlib.sha256((ROOT/ev['snapshotPath']).read_bytes()).hexdigest(),ev['snapshotSHA256'])
        mito=next(u for u in d['updates'] if u['candidate']['datasetPoint']['name']=='水戸芸術館')
        self.assertAlmostEqual(mito['coordinate']['lat'],36.38038497383131)
        self.assertAlmostEqual(mito['coordinate']['lng'],140.46578600462854)
if __name__=='__main__':unittest.main()
