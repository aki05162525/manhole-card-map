import { facilityMapLink } from '../../../../web/src/ui';
import { readFileSync, writeFileSync } from 'node:fs';
const dir='data/work/location-batch2/kyushu-okinawa/recheck/';
const data=JSON.parse(readFileSync(dir+'after-generated/details.json','utf8'));
const adoption=JSON.parse(readFileSync('data/national/location-batch2/kyushu-okinawa/integration.json','utf8'));
const results=[];
for (const id of adoption.adoptedFacilityIds) {
  const place=data.places.find(p=>p.id===id);
  const relations=data.relations.filter(r=>r.placeId===id);
  if (!relations.length || place.locationReview.status!=='confirmed') throw Error('Missing confirmed detail');
  for (const relation of relations) {
    const link=facilityMapLink(place,relation);
    if (!link || new URL(link.href).searchParams.get('query')!==`${place.coordinate.lat},${place.coordinate.lng}`) throw Error('Wrong Maps destination');
    results.push({id,cardId:relation.cardId,link});
  }
}
writeFileSync('data/evidence/location-batch2/kyushu-okinawa/maps-check.json',JSON.stringify({method:'実生成detailsと本番facilityMapLinkを直接検査。ブラウザー・Google Maps外部画面は未操作。',results},null,2)+'\n');
console.log(JSON.stringify(results));
