"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _idb = require("idb");

var _generate = _interopRequireDefault(require("nanoid/generate"));

require("regenerator-runtime/runtime");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var SEED = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function handleRequest(protocol, params) {
  var method, _localStorage, _localStorage2, _localStorage3, db, res, _res, _res2;

  return regeneratorRuntime.async(function handleRequest$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          method = protocol.split('CrossStorage:')[1];

          if (!(method === 'getItem')) {
            _context.next = 3;
            break;
          }

          return _context.abrupt("return", (_localStorage = localStorage).getItem.apply(_localStorage, params));

        case 3:
          if (!(method === 'setItem')) {
            _context.next = 5;
            break;
          }

          return _context.abrupt("return", (_localStorage2 = localStorage).setItem.apply(_localStorage2, params));

        case 5:
          if (!(method === 'removeItem')) {
            _context.next = 7;
            break;
          }

          return _context.abrupt("return", (_localStorage3 = localStorage).removeItem.apply(_localStorage3, params));

        case 7:
          _context.next = 9;
          return regeneratorRuntime.awrap((0, _idb.openDB)('cross-storage', 1, {
            upgrade: function upgrade(db) {
              return db.createObjectStore('generic');
            }
          }));

        case 9:
          db = _context.sent;

          if (!(method === 'getIndexed')) {
            _context.next = 16;
            break;
          }

          _context.next = 13;
          return regeneratorRuntime.awrap(db.get.apply(db, ['generic'].concat(params)));

        case 13:
          res = _context.sent;
          db.close();
          return _context.abrupt("return", res);

        case 16:
          if (!(method === 'setIndexed')) {
            _context.next = 22;
            break;
          }

          _context.next = 19;
          return regeneratorRuntime.awrap(db.put('generic', params[1], params[0]));

        case 19:
          _res = _context.sent;
          db.close();
          return _context.abrupt("return", _res);

        case 22:
          if (!(method === 'removeIndexed')) {
            _context.next = 28;
            break;
          }

          _context.next = 25;
          return regeneratorRuntime.awrap(db.delete.apply(db, ['generic'].concat(params)));

        case 25:
          _res2 = _context.sent;
          db.close();
          return _context.abrupt("return", _res2);

        case 28:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, null, Promise);
}

var CrossStorage = function CrossStorage() {
  _defineProperty(this, "open", function (allowedDomains) {
    if (allowedDomains === void 0) {
      allowedDomains = [];
    }

    this.__rootListener = function _callee(message) {
      var origin, isAllowed, req, res;
      return regeneratorRuntime.async(function _callee$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              origin = message.origin === 'null' ? 'file://' : message.origin;
              isAllowed = allowedDomains.some(function (regx) {
                if (!(regx instanceof RegExp)) return false;
                return regx.test(origin);
              });

              if (isAllowed) {
                _context2.next = 4;
                break;
              }

              return _context2.abrupt("return");

            case 4:
              req = function () {
                try {
                  return JSON.parse(message.data);
                } catch (_unused) {}
              }();

              if (req) {
                _context2.next = 7;
                break;
              }

              return _context2.abrupt("return");

            case 7:
              res = {
                id: req.id
              };
              _context2.prev = 8;
              _context2.next = 11;
              return regeneratorRuntime.awrap(handleRequest(req.method, req.params));

            case 11:
              res.result = _context2.sent;
              _context2.next = 17;
              break;

            case 14:
              _context2.prev = 14;
              _context2.t0 = _context2["catch"](8);
              res.error = _context2.t0;

            case 17:
              window.parent.postMessage(JSON.stringify(res), origin);

            case 18:
            case "end":
              return _context2.stop();
          }
        }
      }, null, null, [[8, 14]], Promise);
    };

    if (window.addEventListener) {
      window.addEventListener('message', this.__rootListener.bind(this), false);
    } else {
      window.attachEvent('onmessage', this.__rootListener.bind(this));
    }
  });

  _defineProperty(this, "close", function () {
    if (window.removeEventListener) {
      window.removeEventListener('message', this.__rootListener, false);
    } else {
      window.detachEvent('onmessage', this.__rootListener);
    }
  });

  _defineProperty(this, "connect", function (rootDomain, _temp) {
    var _this2 = this;

    var _ref = _temp === void 0 ? {} : _temp,
        _ref$frameId = _ref.frameId,
        frameId = _ref$frameId === void 0 ? 'cross-storage' : _ref$frameId;

    if (rootDomain === 'local') return this.connectLocal();

    if (this.__connectionStatus === 'CONNECTED') {
      return this;
    }

    var frame = document.getElementById(frameId);

    if (frame) {
      return console.error("ERROR: " + frameId + " has already be used. Please provide different frameId");
    }

    frame = window.document.createElement('iframe');
    this.__frame = frame;
    this.__frame.id = frameId;
    this.__frame.style.display = 'none';
    window.document.body.appendChild(this.__frame);
    this.__frame.src = rootDomain;

    this.__clientListener = function (message) {
      var origin = message.origin === 'null' ? 'file://' : message.origin;
      var isAllowed = origin === rootDomain;
      if (!isAllowed) return;

      var res = function () {
        try {
          return JSON.parse(message.data);
        } catch (err) {}
      }();

      if (!res || !res.id || typeof this.__requests[res.id] !== 'function') return;

      this.__requests[res.id](res.error, res.result);
    };

    this.__request = function (method, params) {
      var _this = this;

      if (this.__connectionStatus !== 'CONNECTED') {
        return console.error('ERROR: CrossStorage has not been up yet.');
      }

      var req = {
        id: (0, _generate.default)(SEED, 10),
        method: 'CrossStorage:' + method,
        params: params
      };
      return new Promise(function (resolve, reject) {
        _this.__timeout = setTimeout(function () {
          if (!_this.__requests[req.id]) return;
          delete _this.__requests[req.id];
          reject(new Error('timeout'));
        }, 5000);

        _this.__requests[req.id] = function (err, result) {
          clearTimeout(_this.__timeout);
          delete _this.__requests[req.id];
          if (err) return reject(new Error(err));
          resolve(result);
        };

        _this.__frame.contentWindow.postMessage(JSON.stringify(req), _this.__frame.src);
      }).catch(function (e) {
        console.error('ERROR: ', e);
      });
    };

    if (window.addEventListener) {
      window.addEventListener('message', this.__clientListener.bind(this), false);
    } else {
      window.attachEvent('onmessage', this.__clientListener.bind(this));
    }

    return new Promise(function (resolve) {
      _this2.__frame.onload = function () {
        _this2.__connectionStatus = 'CONNECTED';
        _this2.__requests = {};
        resolve(_this2);
      };
    });
  });

  _defineProperty(this, "connectLocal", function () {
    this.__request = function (method, params) {
      var req = {
        id: (0, _generate.default)(SEED, 10),
        method: 'CrossStorage:' + method,
        params: params
      };
      return handleRequest(req.method, params);
    };

    return this;
  });

  _defineProperty(this, "disconnect", function () {
    if (this.__frame) this.__frame.parentNode.removeChild(this.__frame);
    this.__connectionStatus = 'DISCONNECTED';

    if (window.removeEventListener) {
      window.removeEventListener('message', this.__clientListener, false);
    } else {
      window.detachEvent('onmessage', this.__clientListener);
    }
  });

  _defineProperty(this, "getItem", function (key) {
    return this.__request('getItem', [key]);
  });

  _defineProperty(this, "setItem", function (key, value) {
    return this.__request('setItem', [key, value]);
  });

  _defineProperty(this, "removeItem", function (key) {
    return this.__request('removeItem', [key]);
  });

  _defineProperty(this, "getIndexed", function (key) {
    return this.__request('getIndexed', [key]);
  });

  _defineProperty(this, "setIndexed", function (key, value) {
    return this.__request('setIndexed', [key, value]);
  });

  _defineProperty(this, "removeIndexed", function (key, value) {
    return this.__request('removeIndexed', [key, value]);
  });
};

var crossStorage = new CrossStorage();
var _default = crossStorage;
exports.default = _default;