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

// goog.require('shaka.log');
goog.require('shaka.offline.StorageMuxer');
// goog.require('shaka.offline.indexeddb.V1StorageCell');
// goog.require('shaka.offline.indexeddb.V2StorageCell');
// goog.require('shaka.util.Error');
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
  }

  /**
   * @override
   */
  init() {
    const name = shaka.offline.electron.StorageMechanism.DB_NAME;
    console.log(name);
    let p = new shaka.util.PublicPromise();
    ///---
    return p;
  }

  /**
   * @override
   */
  async destroy() {
  }

  /**
   * @override
   */
  getCells() {
  }

  /**
   * @override
   */
  async erase() {
  }

  // /**
  //  * @param {!IDBDatabase} db
  //  * @private
  //  */
  // createStores_(db) {
  //   console.log(db);
  // }

  // /**
  //  * Delete the indexed db instance so that all stores are deleted and cleared.
  //  * This will force the database to a like-new state next time it opens.
  //  *
  //  * @return {!Promise}
  //  * @private
  //  */
  // static deleteAll_() {
  //   const name = shaka.offline.electron.StorageMechanism.DB_NAME;
  //   console.log(name);
  //   let p = new shaka.util.PublicPromise();

  //   return p;
  // }
};

/** @const {string} */
shaka.offline.electron.StorageMechanism.DB_NAME = 'shaka_offline_db';
/** @const {string} */
shaka.offline.electron.StorageMechanism.V3_SEGMENT_STORE = 'segment-v3';
/** @const {string} */
shaka.offline.electron.StorageMechanism.V3_MANIFEST_STORE = 'manifest-v3';


// Since this may be called before the polyfills remove electron support from
// some platforms (looking at you Chromecast), we need to check for support
// when we create the mechanism.
//
// Thankfully the storage muxer api allows us to return a null mechanism
// to indicate that the mechanism is not supported on this platform.
shaka.offline.StorageMuxer.register(
    'electron',
    () => {
      return window && window.process && window.process.type ?
              new shaka.offline.electron.StorageMechanism() :
              null;
    });