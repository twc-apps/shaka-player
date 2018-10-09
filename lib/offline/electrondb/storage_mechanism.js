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

goog.provide('shaka.offline.electrondb.StorageMechanism');

goog.require('shaka.log');
goog.require('shaka.offline.StorageMuxer');
goog.require('shaka.offline.electrondb.V2StorageCell');
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
shaka.offline.electrondb.StorageMechanism = class {
  constructor() {
    this.db_ = null;
    this.v3_ = null;
  }

  /**
   * @override
   */
  init() {
    const name = shaka.offline.electrondb.StorageMechanism.DB_NAME;
    const version = shaka.offline.electrondb.StorageMechanism.VERSION;

    let p = new shaka.util.PublicPromise();
    let open = window.electronDB.open(name, version);
    open.then((db) => {
      this.db_ = db;
      this.createStores_(this.db_);
      this.v3_ = shaka.offline.electrondb.StorageMechanism.createV3_(db);
      p.resolve();
    }).catch((error) => {
      p.reject(new shaka.util.Error(
          shaka.util.Error.Severity.CRITICAL,
          shaka.util.Error.Category.STORAGE,
          shaka.util.Error.Code.INDEXED_DB_ERROR,
          error));
    });
    return p;
  }

  /**
   * @override
   */
  async destroy() {
    if (this.v3_) { await this.v3_.destroy(); }
  }

  /**
   * @override
   */
  getCells() {
    let map = {};

    if (this.v3_) { map['v3'] = this.v3_; }

    return map;
  }

  /**
   * @override
   */
  async erase() {
    // Not all cells may have been created, so only destroy the ones that
    // were created.
    if (this.v3_) { await this.v3_.destroy(); }
    await shaka.offline.indexeddb.StorageMechanism.deleteAll_();

    // Reset before initializing.
    this.db_ = null;
    this.v3_ = null;

    await this.init();
  }

  /**
   * @param {!IDBDatabase} db
   * @return {shaka.extern.StorageCell}
   * @private
   */
  static createV3_(db) {
    const StorageMechanism = shaka.offline.electrondb.StorageMechanism;
    const segmentStore = StorageMechanism.V3_SEGMENT_STORE;
    const manifestStore = StorageMechanism.V3_MANIFEST_STORE;
    const stores = db.indexStores;
    if (stores.includes(manifestStore) && stores.includes(segmentStore)) {
      shaka.log.debug('Mounting v3 idb storage cell');

      // Version 3 uses the same structure as version 2, so we can use the same
      // cells but it can support new entries.
      return new shaka.offline.electrondb.V2StorageCell(
          db,
          segmentStore,
          manifestStore,
          false); // Are keys locked? No, this means we can add new entries.
    }
    return null;
  }

  /**
   * @param {!IDBDatabase} db
   * @private
   */
  createStores_(db) {
    const segmentStore =
        shaka.offline.electrondb.StorageMechanism.V3_SEGMENT_STORE;
    const manifestStore =
        shaka.offline.electrondb.StorageMechanism.V3_MANIFEST_STORE;

    db.openIndex(manifestStore);
    db.openIndex(segmentStore);
  }

  /**
   * Delete the indexed db instance so that all stores are deleted and cleared.
   * This will force the database to a like-new state next time it opens.
   *
   * @return {!Promise}
   * @private
   */
  static deleteAll_() {
    const name = shaka.offline.electrondb.StorageMechanism.DB_NAME;

    let p = new shaka.util.PublicPromise();

    window.electronDB.delete(name)
    .then(() => {
      p.resolve();
    })
    .catch((error) => {
      p.reject(new shaka.util.Error(
          shaka.util.Error.Severity.CRITICAL,
          shaka.util.Error.Category.STORAGE,
          shaka.util.Error.Code.INDEXED_DB_ERROR,
          error));
    });

    return p;
  }
};

/** @const {string} */
shaka.offline.electrondb.StorageMechanism.DB_NAME = 'shaka_offline_db';
/** @const {number} */
shaka.offline.electrondb.StorageMechanism.VERSION = 3;
/** @const {string} */
shaka.offline.electrondb.StorageMechanism.V3_SEGMENT_STORE = 'segment-v3';
/** @const {string} */
shaka.offline.electrondb.StorageMechanism.V3_MANIFEST_STORE = 'manifest-v3';


// Since this may be called before the polyfills remove indexeddb support from
// some platforms (looking at you Chromecast), we need to check for support
// when we create the mechanism.
//
// Thankfully the storage muxer api allows us to return a null mechanism
// to indicate that the mechanism is not supported on this platform.
shaka.offline.StorageMuxer.register(
    'electrondb',
    () => {
      return window.electronDB ?
              new shaka.offline.electrondb.StorageMechanism() :
              null;
    });
