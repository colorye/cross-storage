import shortId from "shortid";

const SHORTID_SEED =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$@";
export function genShortId() {
  function generate() {
    shortId.characters(SHORTID_SEED);
    return shortId.generate();
  }
  return generate();
}

class LoshipStorage {
  /** For ROOT */
  open = function(allowedDomains = []) {
    this.rootListener = function(message) {
      const origin = message.origin === "null" ? "file://" : message.origin;
      const isAllowed = allowedDomains.some(regx => {
        if (!regx instanceof RegExp) return false;
        return regx.test(origin);
      });
      if (!isAllowed) return;

      const req = (() => {
        try {
          return JSON.parse(message.data);
        } catch (err) {
          return;
        }
      })();
      if (!req) return;

      const res = (() => {
        try {
          const method = req.method.split("LoshipStorage:")[1];
          return JSON.stringify({
            id: req.id,
            result: this[`_${method}`](req.params)
          });
        } catch (err) {
          return JSON.stringify({
            id: req.id,
            error: err
          });
        }
      })();

      window.parent.postMessage(res, origin);
    };

    if (window.addEventListener) {
      window.addEventListener("message", this.rootListener.bind(this), false);
    } else {
      window.attachEvent("onmessage", this.rootListener.bind(this));
    }
  };
  close = function() {
    if (window.removeEventListener) {
      window.removeEventListener("message", this.rootListener, false);
    } else {
      window.detachEvent("onmessage", this.rootListener);
    }
  };
  _getItem = function({ key }) {
    return window.localStorage.getItem(key);
  };
  _setItem = function({ key, value }) {
    window.localStorage.setItem(key, value);
  };
  _removeItem = function({ key }) {
    window.localStorage.removeItem(key);
  };

  /** For CLIENT */
  requests = {};
  connect = function(rootDomain, frameId = "loship-storage") {
    let frame = document.getElementById(frameId);
    if (frame) frame.parentNode.removeChild(frame);
    frame = window.document.createElement("iframe");

    this.frame = frame;
    this.frame.id = frameId;
    this.frame.style["display"] = "none";
    window.document.body.appendChild(this.frame);
    this.frame.src = rootDomain;

    this.clientListener = function(message) {
      const origin = message.origin === "null" ? "file://" : message.origin;
      const isAllowed = origin === rootDomain;
      if (!isAllowed) return;

      const res = (() => {
        try {
          return JSON.parse(message.data);
        } catch (err) {
          return;
        }
      })();
      if (!res.id || typeof this.requests[res.id] !== "function") return;
      this.requests[res.id](res.error, res.result);
    };

    if (window.addEventListener) {
      window.addEventListener("message", this.clientListener.bind(this), false);
    } else {
      window.attachEvent("onmessage", this.clientListener.bind(this));
    }

    return new Promise(resolve => {
      this.frame.onload = () => {
        this.connectionStatus = "CONNECTED";
        resolve(this);
      };
    });
  };
  disconnect = function() {
    if (this.frame) this.frame.parentNode.removeChild(this.frame);

    this.connectionStatus = "DISCONNECTED";
    if (window.removeEventListener) {
      window.removeEventListener("message", this.clientListener, false);
    } else {
      window.detachEvent("onmessage", this.clientListener);
    }
  };
  getItem = function(key) {
    return this._request("getItem", { key });
  };
  setItem = function(key, value) {
    this._request("setItem", { key, value });
  };
  removeItem = function(key) {
    this._request("removeItem", { key });
  };
  _request = async function(method, params) {
    if (this.connectionStatus !== "CONNECTED") {
      return console.error("ERROR: LoshipStorage has not been up yet.");
    }

    const req = {
      id: genShortId(),
      method: "LoshipStorage:" + method,
      params
    };

    return new Promise((resolve, reject) => {
      this.timeout = setTimeout(() => {
        if (!this.requests[req.id]) return;
        delete this.requests[req.id];
        reject(new Error("timeout"));
      }, 5000);

      this.requests[req.id] = (err, result) => {
        clearTimeout(this.timeout);
        delete this.requests[req.id];
        if (err) return reject(new Error(err));
        resolve(result);
      };

      this.frame.contentWindow.postMessage(JSON.stringify(req), this.frame.src);
    }).catch(function(e) {
      console.error("ERROR: ", e);
    });
  };
}

const loshipStorage = new LoshipStorage();
export default loshipStorage;
