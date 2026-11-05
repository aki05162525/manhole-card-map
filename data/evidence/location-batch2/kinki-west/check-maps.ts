import { facilityMapLink } from '../../../../web/src/ui';
import { readFileSync } from 'node:fs';
const data=JSON.parse(readFileSync('data/work/location-batch2/kinki-west/revision/after-generated/details.json','utf8'));
for(const id of ['facility:kinki-0df3699f1debe84ccd2a','facility:kinki-1ca68b2dbec83466c8f0']) {
 const place=data.places.find(p=>p.id===id);
 const relations=data.relations.filter(r=>r.placeId===id);
 if (!relations.length) throw Error('Missing relation');
 for (const relation of relations) {
  const link=facilityMapLink(place,relation);
  if(!link || new URL(link.href).searchParams.get('query')!==`${place.coordinate.lat},${place.coordinate.lng}`) throw Error('Wrong Maps destination');
  console.log(JSON.stringify({id,cardId:relation.cardId,link}));
 }
}
