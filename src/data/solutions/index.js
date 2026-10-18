// [V7.18.0 新增] Static imports are bundled into the offline HTML; no runtime solver or fetch.
import halfPot from './river-half-pot.json' with { type: 'json' };
import pot from './river-pot.json' with { type: 'json' };
import turn from './turn-checkdown-half-pot.json' with { type: 'json' }; // [V7.18.1 新增]
import line from './turn-river-half-pot.json' with { type: 'json' };
import { validateSolutionPack } from '../../modules/solutionPackModel.js';
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const SOLUTION_PACKS = [halfPot, pot, turn, line].map(pack => freeze(validateSolutionPack(pack)));
export const getSolutionPack = id => SOLUTION_PACKS.find(pack => pack.id === id);
