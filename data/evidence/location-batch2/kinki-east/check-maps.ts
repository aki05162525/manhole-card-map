import { facilityMapLink } from '../../../../web/src/ui';
import { readFileSync } from 'node:fs';
const data=JSON.parse(readFileSync('data/work/location-batch2/kinki-east/adoption/after-generated/details.json','utf8'));
for(const id of ['facility:kinki-5d739ed0da591dafd1d2','facility:kinki-5d377b6a926c0d1e6fa1']) {
 const place=data.places.find(p=>p.id===id);
 const relations=data.relations.filter(r=>r.placeId===id);
 if (!relations.length) throw Error('Missing relation');
 for (const relation of relations) {
  const link=facilityMapLink(place,relation);
  if(!link || new URL(link.href).searchParams.get('query')!==`${place.coordinate.lat},${place.coordinate.lng}`) throw Error('Wrong Maps destination');
  console.log(JSON.stringify({id,cardId:relation.cardId,link}));
 }
}
