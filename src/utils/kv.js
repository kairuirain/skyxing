/**
 * KV 存储辅助函数
 */
export async function getJSON(kv, key, defaultValue = null) {
    try { const raw = await kv.get(key); return raw ? JSON.parse(raw) : defaultValue; }
    catch (e) { console.error(`[KV] getJSON ${key}:`, e.message); return defaultValue; }
}

export async function putJSON(kv, key, data, options) {
    await kv.put(key, JSON.stringify(data), options);
}

export async function getList(kv, key) { return getJSON(kv, key, []); }

export async function putList(kv, key, list) { await putJSON(kv, key, list); }

export async function getUser(kv, username) { return getJSON(kv, `user:${username}`); }

export async function putUser(kv, username, data) { await putJSON(kv, `user:${username}`, data); }

export async function prependToList(kv, key, item) {
    const list = await getList(kv, key); list.unshift(item); await putList(kv, key, list); return list;
}

export async function findInList(kv, key, id) {
    const list = await getList(kv, key);
    const index = list.findIndex(item => item.id === id);
    return index === -1 ? null : { index, item: list[index], list };
}

export async function removeFromList(kv, key, id) {
    const found = await findInList(kv, key, id);
    if (!found) return false;
    found.list.splice(found.index, 1);
    await putList(kv, key, found.list);
    return true;
}
