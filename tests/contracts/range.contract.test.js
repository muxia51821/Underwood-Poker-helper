import test from 'node:test';
import assert from 'node:assert/strict';
import { RANGE_HANDS, rangeCombos, newPreflopRange, validatePreflopRange, parseRangeText, rangeTextEntries, withRangeHand, rangeSummary, rangeFile, readRangeFile, sameRangeConditions } from '../../src/modules/preflopRangeModel.js';
import { RANGE_LIBRARY_KEY, emptyRangeState, createRangeStore, mergeRangeStates } from '../../src/store/rangeStore.js';
import { planRestore } from '../../src/store/backup.js';
function storage() { let raw = null; return { getItem: () => raw, setItem: (_key, value) => { raw = value; } }; }
function chart(id = 'synthetic') { return { ...newPreflopRange(id), hands: rangeTextEntries('AA:0.5, AKs', 'raise') }; }

test('169 classes represent 1326 combinations; partial and zero weight remain distinct from Fold', () => {
  assert.equal(new Set(RANGE_HANDS).size, 169); assert.equal(RANGE_HANDS.reduce((sum, hand) => sum + rangeCombos(hand), 0), 1326);
  const range = chart(), result = rangeSummary(range);
  assert.equal(result.knownCombos, 10); assert.equal(result.weightedCombos, 7); assert.equal(result.actions.raise, 7); assert.equal(result.actions.fold, 0);
  const zero = withRangeHand(range, 'KK', rangeTextEntries('KK:0', 'fold')[0]);
  assert.equal(rangeSummary(zero).classes, 3); assert.equal(rangeSummary(zero).weightedCombos, 7);
  assert.equal(rangeSummary(withRangeHand(zero, 'KK', null)).classes, 2);
});
test('pinned parser expands pair and suited intervals without collapsing exact suit combinations', () => {
  assert.deepEqual(parseRangeText('QQ+').map(item => item.hand).sort(), ['AA','KK','QQ']);
  assert.equal(parseRangeText('A5s-A2s:0.5').length, 4); assert.equal(parseRangeText('AK').length, 2);
  assert.deepEqual(parseRangeText('AA-AA'), [{hand:'AA',weight:1}]);
  assert.deepEqual(parseRangeText('KQs-JTs').map(item => item.hand), ['KQs','QJs','JTs']);
  for (const text of ['AhKh', 'KAo', 'AAs', 'QQ+,KK', 'AKs:1.1', 'AA:-1', 'junkAKs', 'AKs:', 'A5s-K6s', 'AJs-KQs', 'KQs-AJs', 'A2s-K3s', 'AKs-AKo']) assert.throws(() => parseRangeText(text), text);
});
test('mixed frequencies are conditional on range inclusion, with strict sums and finite weights', () => {
  const range = newPreflopRange('mixed');
  const entry = {weight:0.5,frequencies:{fold:0.2,call:0.3,raise:0.5,allin:0}};
  const mixed = withRangeHand(range, 'AA', entry); assert.ok(Math.abs(rangeSummary(mixed).actions.call - 0.9) < 1e-9);
  for (const bad of [{...entry,weight:NaN}, {...entry,weight:0}, {...entry,frequencies:{...entry.frequencies,raise:0.4}}, {...entry,frequencies:{...entry.frequencies,check:0}}]) assert.throws(() => withRangeHand(range,'AA',bad));
  assert.throws(() => validatePreflopRange({...mixed,hands:[...mixed.hands,...mixed.hands]}));
});
test('native range files retain conditions, provenance and extension fields, without upgrading authority', () => {
  const range = chart(); range.kind = 'reference'; range.source.title = 'Synthetic unverified'; range.extension = { retained: true };
  const imported = readRangeFile(JSON.stringify(rangeFile(range))); assert.deepEqual(imported,range); assert.ok(sameRangeConditions(range,imported));
  imported.conditions.effectiveStack = 100; assert.equal(sameRangeConditions(range,imported),false);
  assert.throws(() => readRangeFile({version:9,range}));
});
test('drafts and unfinished numeric text survive refresh; concurrent and failed writes preserve previous bytes', () => {
  const local=storage(), first=createRangeStore(local), state=first.read(); state.drafts.synthetic=chart();state.selectedId='synthetic';
  state.editors.synthetic={hand:'AA',values:{AA:{weight:'50',fold:'',call:'12.',raise:'88',allin:'0'}}};first.write(state);
  const second=createRangeStore(local); assert.deepEqual(second.read(),state);
  const before=local.getItem(RANGE_LIBRARY_KEY);const failing=createRangeStore({getItem:local.getItem,setItem(){throw Error('quota');}});failing.read();assert.throws(()=>failing.write({...state,selectedId:null}));assert.equal(local.getItem(RANGE_LIBRARY_KEY),before);
  second.write({...state,selectedId:null});assert.throws(()=>first.write(state),/其他页面/);
});
test('full backup includes ranges and editor drafts; merging retains unique charts and preferred revisions', () => {
  const local=emptyRangeState();local.ranges=[chart('local')];local.selectedId='local';
  const incoming=emptyRangeState();incoming.ranges=[{...chart('local'),name:'incoming'},chart('extra')];incoming.drafts.draft=chart('draft');incoming.editors.draft={hand:'AKs',values:{AKs:{raise:''}}};
  const merged=mergeRangeStates(local,incoming);assert.deepEqual(merged.ranges.map(item=>item.id),['local','extra']);assert.equal(merged.ranges[0].name,'新范围');assert.ok(merged.drafts.draft);
  const raw=JSON.stringify(incoming), current={sessions:[],localState:{version:1,values:{[RANGE_LIBRARY_KEY]:JSON.stringify(local)}}};
  const plan=planRestore({sessions:[],localState:{version:1,values:{[RANGE_LIBRARY_KEY]:raw}}},current);
  assert.deepEqual(plan.issues,[]);assert.equal(plan.archivedKeys.length,0);assert.deepEqual(JSON.parse(plan.rows.find(row=>row.key===RANGE_LIBRARY_KEY).value),merged);
  const prefer=planRestore(plan.incoming,current,{preferIncoming:[RANGE_LIBRARY_KEY]});assert.equal(JSON.parse(prefer.rows.find(row=>row.key===RANGE_LIBRARY_KEY).value).ranges[0].name,'incoming');
});
