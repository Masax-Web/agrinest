const STORAGE_KEY = 'agri-nest-local-db';

const defaultDbState = {
  users: [],
  farms: [],
  fields: [],
  listings: [],
  scans: [],
  transactions: [],
};

function readDbState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultDbState));
      return structuredClone(defaultDbState);
    }
    return { ...defaultDbState, ...JSON.parse(stored) };
  } catch (error) {
    console.warn('AGRI-NEST local DB read failed:', error);
    return structuredClone(defaultDbState);
  }
}

function writeDbState(nextState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

export const db = {
  getState() {
    return readDbState();
  },

  setState(nextState) {
    writeDbState(nextState);
    return nextState;
  },

  upsert(collection, item) {
    const state = readDbState();
    const list = state[collection] || [];
    const index = list.findIndex((entry) => entry.id === item.id || entry.user_id === item.user_id || entry.farm_id === item.farm_id);
    if (index >= 0) {
      list[index] = { ...list[index], ...item };
    } else {
      list.push(item);
    }
    state[collection] = list;
    writeDbState(state);
    return list;
  },

  list(collection) {
    return readDbState()[collection] || [];
  },

  find(collection, predicate) {
    return (readDbState()[collection] || []).find(predicate);
  },
};

export default db;
