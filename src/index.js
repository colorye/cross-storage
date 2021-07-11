import { openDB } from 'idb';
import nanoId from 'nanoid/generate';
import 'regenerator-runtime/runtime';

const SEED = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

async function handleRequest (protocol, params) {
  const method = protocol.split('CrossStorage:')[1];

  if (method === 'getItem') {
    return localStorage.getItem(...params);
  }
  if (method === 'setItem') {
    return localStorage.setItem(...params);
  }
  if (method === 'removeItem') {
    return localStorage.removeItem(...params);
  }

  const db = await openDB('cross-storage', 1, {
    upgrade: db => db.createObjectStore('generic'),
  });

  if (method === 'getIndexed') {
    const res = await db.get('generic', ...params);
    db.close();
    return res;
  }
  if (method === 'setIndexed') {
    const res = await db.put('generic', params[1], params[0]);
    db.close();
    return res;
  }
  if (method === 'removeIndexed') {
    const res = await db.delete('generic', ...params);
    db.close();
    return res;
  }
}

class CrossStorage {
  /** For ROOT */
  open = function (allowedDomains = []) {
    this.__rootListener = async function (message) {
      const origin = message.origin === 'null' ? 'file://' : message.origin;
      const isAllowed = allowedDomains.some(regx => {
        if (!(regx instanceof RegExp)) return false;
        return regx.test(origin);
      });
      if (!isAllowed) return;

      const req = (() => {
        try { return JSON.parse(message.data); } catch {}
      })();
      if (!req) return;

      const res = { id: req.id };
      try {
        res.result = await handleRequest(req.method, req.params);
      } catch (err) {
        res.error = err;
      }
      window.parent.postMessage(JSON.stringify(res), origin);
    };

    if (window.addEventListener) {
      window.addEventListener('message', this.__rootListener.bind(this), false);
    } else {
      window.attachEvent('onmessage', this.__rootListener.bind(this));
    }
  };

  close = function () {
    if (window.removeEventListener) {
      window.removeEventListener('message', this.__rootListener, false);
    } else {
      window.detachEvent('onmessage', this.__rootListener);
    }
  };

  /** For CLIENT */
  connect = function (rootDomain, { frameId = 'cross-storage' } = {}) {
    if (rootDomain === 'local') return this.connectLocal();

    if (this.__connectionStatus === 'CONNECTED') {
      return this;
    }

    let frame = document.getElementById(frameId);
    if (frame) {
      return console.error(
          `ERROR: ${frameId} has already be used. Please provide different frameId`,
      );
    }
    frame = window.document.createElement('iframe');

    this.__frame = frame;
    this.__frame.id = frameId;
    this.__frame.style.display = 'none';
    window.document.body.appendChild(this.__frame);
    this.__frame.src = rootDomain;

    this.__clientListener = function (message) {
      const origin = message.origin === 'null' ? 'file://' : message.origin;
      const isAllowed = origin === rootDomain;
      if (!isAllowed) return;

      const res = (() => {
        try { return JSON.parse(message.data); } catch (err) {}
      })();
      if (!res || !res.id || typeof this.__requests[res.id] !== 'function') return;
      this.__requests[res.id](res.error, res.result);
    };

    this.__request = function (method, params) {
      if (this.__connectionStatus !== 'CONNECTED') {
        return console.error('ERROR: CrossStorage has not been up yet.');
      }

      const req = {
        id: nanoId(SEED, 10),
        method: 'CrossStorage:' + method,
        params,
      };

      return new Promise((resolve, reject) => {
        this.__timeout = setTimeout(() => {
          if (!this.__requests[req.id]) return;
          delete this.__requests[req.id];
          reject(new Error('timeout'));
        }, 5000);

        this.__requests[req.id] = (err, result) => {
          clearTimeout(this.__timeout);
          delete this.__requests[req.id];
          if (err) return reject(new Error(err));
          resolve(result);
        };

        this.__frame.contentWindow.postMessage(
          JSON.stringify(req),
          this.__frame.src,
        );
      }).catch(function (e) {
        console.error('ERROR: ', e);
      });
    };

    if (window.addEventListener) {
      window.addEventListener(
        'message',
        this.__clientListener.bind(this),
        false,
      );
    } else {
      window.attachEvent('onmessage', this.__clientListener.bind(this));
    }
    return new Promise(resolve => {
      this.__frame.onload = () => {
        this.__connectionStatus = 'CONNECTED';
        this.__requests = {};

        resolve(this);
      };
    });
  };

  connectLocal = function () {
    this.__request = function (method, params) {
      const req = {
        id: nanoId(SEED, 10),
        method: 'CrossStorage:' + method,
        params,
      };

      return handleRequest(req.method, params);
    };
    return this;
  }

  disconnect = function () {
    if (this.__frame) this.__frame.parentNode.removeChild(this.__frame);

    this.__connectionStatus = 'DISCONNECTED';
    if (window.removeEventListener) {
      window.removeEventListener('message', this.__clientListener, false);
    } else {
      window.detachEvent('onmessage', this.__clientListener);
    }
  };

  getItem = function (key) {
    return this.__request('getItem', [key]);
  };

  setItem = function (key, value) {
    return this.__request('setItem', [key, value]);
  };

  removeItem = function (key) {
    return this.__request('removeItem', [key]);
  };

  getIndexed = function (key) {
    return this.__request('getIndexed', [key]);
  };

  setIndexed = function (key, value) {
    return this.__request('setIndexed', [key, value]);
  };

  removeIndexed = function (key, value) {
    return this.__request('removeIndexed', [key, value]);
  };
}

const crossStorage = new CrossStorage();
export default crossStorage;
