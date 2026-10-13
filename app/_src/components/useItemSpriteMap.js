'use client';

// Shared item-sprite-map store. loadItemSpriteMap() already fetches the map
// once and caches the promise; this exposes the resolved map to every tile/card
// through a single subscription (useSyncExternalStore) instead of each instance
// holding its own state + load effect.
import { useSyncExternalStore } from 'react';
import { loadItemSpriteMap } from '../utils/items/spritesheetMap';

let cachedMap = null;
let started = false;
const listeners = new Set();

function subscribe(listener) {
    listeners.add(listener);
    if (!started) {
        started = true;
        loadItemSpriteMap().then((map) => {
            cachedMap = map || {};
            for (const notify of listeners) notify();
        });
    }
    return () => listeners.delete(listener);
}

function getSnapshot() {
    return cachedMap;
}

function getServerSnapshot() {
    return null;
}

export function useItemSpriteMap() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
