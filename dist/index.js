"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _generate = _interopRequireDefault(require("nanoid/generate"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var SEED = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

var CrossStorage = function CrossStorage() {
  _defineProperty(this, "open", function (allowedDomains) {
    if (allowedDomains === void 0) {
      allowedDomains = [];
    }

    this.__rootListener = function (message) {
      var _this = this;

      var origin = message.origin === "null" ? "file://" : message.origin;
      var isAllowed = allowedDomains.some(function (regx) {
        if (!regx instanceof RegExp) return false;
        return regx.test(origin);
      });
      if (!isAllowed) return;

      var req = function () {
        try {
          return JSON.parse(message.data);
        } catch (err) {
          return;
        }
      }();

      if (!req) return;

      var res = function () {
        try {
          var method = req.method.split("CrossStorage:")[1];
          return JSON.stringify({
            id: req.id,
            result: _this["__" + method](req.params)
          });
        } catch (err) {
          return JSON.stringify({
            id: req.id,
            error: err
          });
        }
      }();

      window.parent.postMessage(res, origin);
    };

    if (window.addEventListener) {
      window.addEventListener("message", this.__rootListener.bind(this), false);
    } else {
      window.attachEvent("onmessage", this.__rootListener.bind(this));
    }
  });

  _defineProperty(this, "close", function () {
    if (window.removeEventListener) {
      window.removeEventListener("message", this.__rootListener, false);
    } else {
      window.detachEvent("onmessage", this.__rootListener);
    }
  });

  _defineProperty(this, "__getItem", function (_ref) {
    var key = _ref.key;
    return window.localStorage.getItem(key);
  });

  _defineProperty(this, "__setItem", function (_ref2) {
    var key = _ref2.key,
        value = _ref2.value;
    window.localStorage.setItem(key, value);
  });

  _defineProperty(this, "__removeItem", function (_ref3) {
    var key = _ref3.key;
    window.localStorage.removeItem(key);
  });

  _defineProperty(this, "__requests", {});

  _defineProperty(this, "connect", function (rootDomain, frameId) {
    var _this2 = this;

    if (frameId === void 0) {
      frameId = "cross-storage";
    }

    var frame = document.getElementById(frameId);
    if (frame) return console.error("ERROR: " + frameId + " has already be used. Please provide different frameId");
    frame = window.document.createElement("iframe");
    this.__frame = frame;
    this.__frame.id = frameId;
    this.__frame.style["display"] = "none";
    window.document.body.appendChild(this.__frame);
    this.__frame.src = rootDomain;

    this.__clientListener = function (message) {
      var origin = message.origin === "null" ? "file://" : message.origin;
      var isAllowed = origin === rootDomain;
      if (!isAllowed) return;

      var res = function () {
        try {
          return JSON.parse(message.data);
        } catch (err) {}
      }();

      if (!res.id || typeof this.__requests[res.id] !== "function") return;

      this.__requests[res.id](res.error, res.result);
    };

    if (window.addEventListener) {
      window.addEventListener("message", this.__clientListener.bind(this), false);
    } else {
      window.attachEvent("onmessage", this.__clientListener.bind(this));
    }

    return new Promise(function (resolve) {
      _this2.__frame.onload = function () {
        _this2.__connectionStatus = "CONNECTED";
        resolve(_this2);
      };
    });
  });

  _defineProperty(this, "disconnect", function () {
    if (this.__frame) this.__frame.parentNode.removeChild(this.__frame);
    this.__connectionStatus = "DISCONNECTED";

    if (window.removeEventListener) {
      window.removeEventListener("message", this.__clientListener, false);
    } else {
      window.detachEvent("onmessage", this.__clientListener);
    }
  });

  _defineProperty(this, "getItem", function (key) {
    return this.__request("getItem", {
      key: key
    });
  });

  _defineProperty(this, "setItem", function (key, value) {
    this.__request("setItem", {
      key: key,
      value: value
    });
  });

  _defineProperty(this, "removeItem", function (key) {
    this.__request("removeItem", {
      key: key
    });
  });

  _defineProperty(this, "__request", function (method, params) {
    var _this3 = this;

    if (this.__connectionStatus !== "CONNECTED") {
      return console.error("ERROR: CrossStorage has not been up yet.");
    }

    var req = {
      id: (0, _generate.default)(SEED, 10),
      method: "CrossStorage:" + method,
      params: params
    };
    return new Promise(function (resolve, reject) {
      _this3.__timeout = setTimeout(function () {
        if (!_this3.__requests[req.id]) return;
        delete _this3.__requests[req.id];
        reject(new Error("timeout"));
      }, 5000);

      _this3.__requests[req.id] = function (err, result) {
        clearTimeout(_this3.__timeout);
        delete _this3.__requests[req.id];
        if (err) return reject(new Error(err));
        resolve(result);
      };

      _this3.__frame.contentWindow.postMessage(JSON.stringify(req), _this3.__frame.src);
    }).catch(function (e) {
      console.error("ERROR: ", e);
    });
  });
};

var crossStorage = new CrossStorage();
var _default = crossStorage;
exports.default = _default;