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

goog.provide('shaka.offline.electrondb.V2StorageCell');

goog.require('shaka.util.Error');


/**
 * The V2StorageCell is for all stores that follow the shaka.externs V2 offline
 * types. This storage cell will work for both IndexedDB version 2 and 3 as
 * both used the shaka.externs V2 offline types.
 *
 * @implements {shaka.extern.StorageCell}
 */
shaka.offline.electrondb.V2StorageCell = class {
  /**
   * @param {IDBDatabase} db
   * @param {string} segmentStore
   * @param {string} manifestStore
   * @param {boolean} isFixedKey
   */
  constructor(db,
    segmentStore,
    manifestStore,
    isFixedKey) {
  this.db_ = db;

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
  destroy() { 
    return this.db_.abort(); 
  }

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
  getSegments(keys) { return this.get_(this.segmentStore_, keys); }

  /**
   * @override
   */
  addManifests(manifests) { return this.add_(this.manifestStore_, manifests); }

  /**
   * @override
   */
  async updateManifestExpiration(key, newExpiration) {
    let index = await this.db_.openIndex(this.manifestStore_);
    let found = await index.read(key);
    // If we can't find the value, then there is nothing for us to update.
    if (found) {
      found.expiration = newExpiration;
      await store.write(found, key);
    }
    return undefined;
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
  getManifests(keys) {
    return this.get_(this.manifestStore_, keys);
  }

  /**
   * @override
   */
  async getAllManifests() {
    let store = await this.db_.openIndex(this.manifestStore_);
    let transactions = [];
    let keys = store.keys();

    keys.forEach((key) => {
      // capture the rejects so that promise.all continues even in case of rejections
      let transaction = new Promise( (resolve, reject) => store.read(key)
        .then((result) => resolve(result))
        .catch((err) => resolve(err))
      );
      transactions.push(transaction);
    });

    // Wait until the operation completes or else values may be missing from
    // |values|.
    const results = await Promise.all(transactions).then((values) => {
      // filter out all the errors from the result
      for (let i = 0; i < values.length; ++i) {
        if (values[i] instanceof Error) {
          // file does not exist on disk, so cleanup key in the store
          if (values[i].code === "ENOENT") store.delete(keys[i]);
          // remove key and result from response
          keys.splice(i, 1);
          values.splice(i, 1);
        }
      }
      return values;
    });

    let values = {};
    for (let i = 0; i < keys.length; i++) {
      values[keys[i]] = results[i];
    }
    return values;
  }

  /**
   * @param {string} storeName
   * @param {!Array.<T>} values
   * @return {!Promise.<!Array.<number>>}
   * @template T
   * @private
   */
  async add_(storeName, values) {
    // In the case that this storage cell does not support add-operations, just
    // reject the request immediately instead of allowing it to try.
    if (this.isFixedKey_) {
      return Promise.reject(new shaka.util.Error(
        shaka.util.Error.Severity.RECOVERABLE,
        shaka.util.Error.Category.STORAGE,
        shaka.util.Error.Code.NEW_KEY_OPERATION_NOT_SUPPORTED,
        'Cannot add new value to ' + storeName));
    }

    let store = await this.db_.openIndex(storeName);

    /** @type {!Array.<Promise>} */
    let transactions = [];

    // Write each segment out.
    values.forEach((value) => {
      let transaction = store.write(value);
      transactions.push(transaction);
    });

    // Wait until the operation completes or else |keys| will not be fully
    // populated.
    /** @type {!Array.<number>} */
    let keys = await Promise.all(transactions);
    return keys;
  }

  /**
   * @param {string} storeName
   * @param {!Array.<number>} keys
   * @param {function(number)} onRemove
   * @return {!Promise}
   * @private
   */
  async remove_(storeName, keys, onRemove) {
    let store = await this.db_.openIndex(storeName);
    let transactions = [];
    keys.forEach((key) => {
      let transaction = store.delete(key).then(() => onRemove(key));
      transactions.push(transaction);
    });

    await Promise.all(transactions);
    return undefined;
  }

  /**
   * @param {string} storeName
   * @param {!Array.<number>} keys
   * @return {!Promise.<!Array.<T>>}
   * @template T
   * @private
   */
  async get_(storeName, keys) {
    let store = await this.db_.openIndex(storeName);

    let transactions = [];

    // Use a map to store the objects so that we can reorder the results to
    // match the order of |keys|.
    keys.forEach((key) => {
      let transaction = store.read(key);
      transactions.push(transaction);
    });

    // Wait until the operation completes or else values may be missing from
    // |values|. Use the original key list to convert the map to a list so that
    // the order will match.
    let values = await Promise.all(transactions);
    if (values.includes(undefined)) {
      return Promise.reject(new shaka.util.Error(
          shaka.util.Error.Severity.RECOVERABLE,
          shaka.util.Error.Category.STORAGE,
          shaka.util.Error.Code.KEY_NOT_FOUND,
          'Could not find values for ' + values.indexOf(undefined)
      ));
    }

    return values;
  }
};
