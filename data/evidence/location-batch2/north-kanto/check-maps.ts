// Run from repository root with mise exec -- bun <this file>.
import { facilityMapLink } from '../../../../web/src/ui';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const data = JSON.parse(readFileSync('data/work/location-batch2/north-kanto/after-generated/details.json','utf8'));
const updates = JSON.parse(readFileSync('data/national/location-batch2/north-kanto/locations.json','utf8')).updates;
const results = updates.map((u:any) => {
 const place = data.places.find((p:any) => p.id === u.facilityId);
 const relations = data.relations.filter((r:any) => r.placeId === place.id);
 assert(relations.length > 0);
 const links = relations.map((r:any) => facilityMapLink(place,r));
 for (const link of links) {
  assert(link); assert.equal(new URL(link.href).searchParams.get('query'),`${u.coordinate.lat},${u.coordinate.lng}`);
  assert.equal(link.label,'配布施設をGoogle Mapsで表示（確定座標）');
 }
 return { facilityId:place.id, relations:relations.length, links };
});
console.log(JSON.stringify({method:'生成detailsの施設・関係を実UI facilityMapLinkへ渡して検査。外部Mapsへの遷移・現地ナビは未検証。',results},null,2));
