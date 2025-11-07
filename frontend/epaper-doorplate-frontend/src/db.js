// db.js
import { openDB } from 'idb'

const DB_NAME = 'MyAppDB';
const STORE_NAME = 'jsonStore';
const DB_VERSION = 1;

// 初始化資料庫
const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    },
  })
}

// 儲存 JSON 檔，支援自訂 key
const saveJSON = async (data, key = 'data') => {
  const db = await initDB()
  await db.put(STORE_NAME, data, key)
}

// 讀取 JSON 檔，支援自訂 key
const loadJSON = async (key = 'data') => {
  const db = await initDB()
  return await db.get(STORE_NAME, key)
}

// 刪除 JSON 檔，支援自訂 key
const clearJSON = async (key = 'data') => {
  const db = await initDB()
  await db.delete(STORE_NAME, key)
}

// 統一 export
export default {
  initDB,
  saveJSON,
  loadJSON,
  clearJSON
}
