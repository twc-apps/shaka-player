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

goog.provide('shaka.offline.electron.V2StorageCell');

goog.require('shaka.util.PublicPromise');
goog.require('shaka.util.Error');


/**
 * The V2StorageCell is for all stores that follow the shaka.externs V2 offline
 * types. This storage cell will work for both IndexedDB version 2 and 3 as
 * both used the shaka.externs V2 offline types.
 *
 * @implements {shaka.extern.StorageCell}
 */
shaka.offline.electron.V2StorageCell = class {
  /**
   * @param {IDBDatabase} connection
   * @param {string} segmentStore
   * @param {string} manifestStore
   * @param {boolean} isFixedKey
   */
  constructor(dlmStorageManager,
    segmentStore,
    manifestStore,
    isFixedKey) {
  /** @private {!shaka.offline.indexeddb.DBConnection} */
  this.manager = dlmStorageManager;

  /** @private {string} */
  this.segmentStore_ = segmentStore;
  /** @private {string} */
  this.manifestStore_ = manifestStore;

  /** @private {boolean} */
  this.isFixedKey_ = isFixedKey;
}

  /**
   * @override
   */
  destroy() { return this.manager.clear(); }

  /**
   * @override
   */
  hasFixedKeySpace() { return this.isFixedKey_; }

  /**
   * @override
   */
  addSegments(segments) { return this.add_(this.segmentStore_, segments); }

  /**
   * @override
   */
  removeSegments(keys, onRemove) {
    return this.remove_(this.segmentStore_, keys, onRemove);
  }

  /**
   * @override
   */
  getSegments(keys) { 
    console.log("getSegments", keys);
    return this.get_(this.segmentStore_, keys);
  }

  /**
   * @override
   */
  addManifests(manifests) { return this.add_(this.manifestStore_, manifests); }

  /**
   * @override
   */
  async updateManifestExpiration(key, newExpiration) {
    return await this.manager.updateManifestExpiration(key, newExpiration);
  }

  /**
   * @override
   */
  removeManifests(keys, onRemove) {
    return this.remove_(this.manifestStore_, keys, onRemove);
  }

  /**
   * @override
   */
  getManifests(keys) { return this.get_(this.manifestStore_, keys); }

  /**
   * @override
   */
  getAllManifests() {
    console.log("getAllManifests");
    return this.manager.getAllManifests().then((response) => {
      let values = {};
      if (response.length !== 0) {
        response.map((item, index) => {
          values[index] = item;
        });
      }
      return values;
    });
  }

  /**
   * @param {string} storeName
   * @param {!Array.<T>} values
   * @return {!Promise.<!Array.<number>>}
   * @template T
   * @private
   */
  add_(storeName, values) {
    // In the case that this storage cell does not support add-operations, just
    // reject the request immediately instead of allowing it to try.
    if (this.isFixedKey_) {
      return Promise.reject(new shaka.util.Error(
        shaka.util.Error.Severity.RECOVERABLE,
        shaka.util.Error.Category.STORAGE,
        shaka.util.Error.Code.NEW_KEY_OPERATION_NOT_SUPPORTED,
        'Cannot add new value to ' + storeName));
    }
    /** @type {!Array.<number>} */
    let transactions = [];

    values.forEach((value) => {
      transactions.push(this.manager.write(storeName, value));
    });
    return Promise.all(transactions).then((keys) => {
      return keys
    });
  }

  /**
   * @param {string} storeName
   * @param {!Array.<number>} keys
   * @param {function(number)} onRemove
   * @return {!Promise}
   * @private
   */
  remove_(storeName, keys, onRemove) {
    /** @type {!Array.<number>} */
    let transactions = [];

    keys.forEach((value) => {
      transactions.push(this.manager.delete(value, storeName)).then((key) => {
        onRemove(key);
      });
    });
    return Promise.all(transactions).then((keys) => {
      return keys
    });
  }

  /**
   * @param {string} storeName
   * @param {!Array.<number>} keys
   * @return {!Promise.<!Array.<T>>}
   * @template T
   * @private
   */
  get_(storeName, keys) {
    console.log("get_", storeName, keys);
    let transactions = [];
    let missing = [];

    // Use a map to store the objects so that we can reorder the results to
    // match the order of |keys|.
    keys.forEach((key) => {
      console.log("key", key);
      let prom = this.manager.get(key, storeName).then((response) => {
        console.log("get_ response", response);
        if (response == undefined) {
          missing.push(key);
        }
        return response;
      });
      transactions.push(prom);
    });

    // Wait until the operation completes or else values may be missing from
    // |values|. Use the original key list to convert the map to a list so that
    // the order will match.
    return Promise.all(transactions).then((values) => {
      if (missing.length) {
        return Promise.reject(new shaka.util.Error(
            shaka.util.Error.Severity.RECOVERABLE,
            shaka.util.Error.Category.STORAGE,
            shaka.util.Error.Code.KEY_NOT_FOUND,
            'Could not find values for ' + missing
        ));
      }
      console.log("get_ values", values)
      return values;
    });
  }

};