/**
 * @license
 * Copyright 2016 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

goog.provide('shaka.offline.electron.StorageMechanism');

goog.require('shaka.log');
goog.require('shaka.offline.StorageMuxer');
goog.require('shaka.offline.electron.V1StorageCell');
goog.require('shaka.offline.electron.V2StorageCell');
goog.require('shaka.util.Error');
goog.require('shaka.util.PublicPromise');


/**
 * A storage mechanism to manage storage cells for an indexed db instance.
 * The cells are just for interacting with the stores that are found in the
 * database instance. The mechanism is responsible for creating new stores
 * when opening the database. If the database is too old of a version, a
 * cell will be added for the old stores but the cell won't support add
 * operations. The mechanism will create the new versions of the stores and
 * will allow add operations for those stores.
 *
 * @implements {shaka.extern.StorageMechanism}
 */
shaka.offline.electron.StorageMechanism = class {
  constructor() {
    /** @private {shaka.extern.StorageCell} */
    this.dlmStorage = null;
  }

  /**
   * @override
   */
  init() {
    const name = shaka.offline.electron.StorageMechanism.DB_NAME;
    const version = shaka.offline.electron.StorageMechanism.VERSION;

    let p = new shaka.util.PublicPromise();
    if (window.dlmStorageManager) {
      this.dlmStorage = shaka.offline.electron.StorageMechanism.createV3_(window.dlmStorageManager);
      p.resolve();
    } else {
      console.warn("shaka INDEXED_DB_ERROR")
      p.reject(new shaka.util.Error(
        shaka.util.Error.Severity.CRITICAL,
        shaka.util.Error.Category.STORAGE,
        shaka.util.Error.Code.INDEXED_DB_ERROR));
    }
    return p;
  }

  /**
   * @override
   */
  async destroy() {
    if (this.dlmStorage) { await this.dlmStorage.destroy(); }
  }

  /**
   * @override
   */
  getCells() {
    let map = {};
    if (this.dlmStorage) { map["dlmStorage"] = this.dlmStorage; }
    console.log("StorageMechanism::getCells() :map", map);
    return map;
  }

  /**
   * @override
   */
  async erase() {
    console.log("StorageMechanism::erase()");
    if (this.dlmStorage) { await this.dlmStorage.clearAll(); }

    this.dlmStorage = null;
    
    await this.init();
  }

  /**
   * @param {!IDBDatabase} db
   * @return {shaka.extern.StorageCell}
   * @private
   */
  static createV3_(storageManager) {
    console.log("StorageMechanism::createV3_(), db:", storageManager);
    const StorageMechanism = shaka.offline.electron.StorageMechanism;
    const segmentStore = StorageMechanism.V3_SEGMENT_STORE;
    const manifestStore = StorageMechanism.V3_MANIFEST_STORE;
    const stores = [segmentStore, manifestStore];
    shaka.log.debug('Mounting electron custom storage cell');
    return new shaka.offline.electron.V2StorageCell(storageManager, segmentStore, manifestStore, false);
  }

  /**
   * @param {!IDBDatabase} db
   * @private
   */
  createStores_(db) {
    console.log("StorageMechanism.createStores_()");
    const segmentStore =
        shaka.offline.electron.StorageMechanism.V3_SEGMENT_STORE;
    const manifestStore =
        shaka.offline.electron.StorageMechanism.V3_MANIFEST_STORE;

    const storeSettings = {autoIncrement: true};

    db.createObjectStore(manifestStore, storeSettings);
    db.createObjectStore(segmentStore, storeSettings);
  }

  /**
   * Delete the indexed db instance so that all stores are deleted and cleared.
   * This will force the database to a like-new state next time it opens.
   *
   * @return {!Promise}
   * @private
   */
  static deleteAll_() {
    console.log("StorageMechanism.deleteAll_()");
    // const name = shaka.offline.electron.StorageMechanism.DB_NAME;
    
    let p = new shaka.util.PublicPromise();
    
    this.dlmStorage.manager.clearAll().then((resolve) => {
      p.resolve();
    }).catch((error) => {
      p.reject();
    });

    return p;
  }
};

/** @const {string} */
shaka.offline.electron.StorageMechanism.DB_NAME = 'shaka_offline_db';
/** @const {number} */
shaka.offline.electron.StorageMechanism.VERSION = 3;
/** @const {string} */
shaka.offline.electron.StorageMechanism.V1_SEGMENT_STORE = 'segment';
/** @const {string} */
shaka.offline.electron.StorageMechanism.V2_SEGMENT_STORE = 'segment-v2';
/** @const {string} */
shaka.offline.electron.StorageMechanism.V3_SEGMENT_STORE = 'segment-electron';
/** @const {string} */
shaka.offline.electron.StorageMechanism.V1_MANIFEST_STORE = 'manifest';
/** @const {string} */
shaka.offline.electron.StorageMechanism.V2_MANIFEST_STORE = 'manifest-v2';
/** @const {string} */
shaka.offline.electron.StorageMechanism.V3_MANIFEST_STORE = 'manifest-electron';


// Since this may be called before the polyfills remove indexeddb support from
// some platforms (looking at you Chromecast), we need to check for support
// when we create the mechanism.
//
// Thankfully the storage muxer api allows us to return a null mechanism
// to indicate that the mechanism is not supported on this platform.
shaka.offline.StorageMuxer.register(
    'electron',
    () => {
      return window.process.type ?
              new shaka.offline.electron.StorageMechanism() :
              null;
    });
