import { decodeBuildParam } from './buildUrlCodec.js';

// Synthetic fixture only - not a real build token.
const token = 'v1_FIXTURE0000000000000000000000000000000000000000000000';
const result = decodeBuildParam(token, {});
console.log('decode with empty itemData:', result);
console.log('is null:', result === null);
