'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var fetch = require('isomorphic-fetch');
var Rx = require('rx');
var url = require('url');

var OothClient = function () {
    function OothClient(_ref) {
        var oothUrl = _ref.oothUrl,
            standalone = _ref.standalone,
            apiLoginUrl = _ref.apiLoginUrl,
            apiLogoutUrl = _ref.apiLogoutUrl;

        _classCallCheck(this, OothClient);

        this.oothUrl = oothUrl;
        this.standalone = standalone;
        if (standalone) {
            this.apiLoginUrl = apiLoginUrl;
            this.apiLogoutUrl = apiLogoutUrl;
        }
    }

    _createClass(OothClient, [{
        key: 'start',
        value: function start() {
            var _this = this;

            return new Promise(function (resolve, reject) {
                if (!_this.started) {
                    _this.started = true;
                    _this.user();
                    _this.subscribeStatus();
                    return _this.status().then(resolve);
                } else {
                    return resolve(_this.user().getValue());
                }
            });
        }
    }, {
        key: 'user',
        value: function user() {
            if (!this.userSubject) {
                this.userSubject = new Rx.BehaviorSubject(null);
            }
            return this.userSubject;
        }
    }, {
        key: 'next',
        value: function next(user) {
            if (this.userSubject) {
                this.userSubject.onNext(user);
            }
            return user;
        }
    }, {
        key: 'authenticate',
        value: function authenticate(strategy, method, body) {
            var _this2 = this;

            return fetch(this.oothUrl + '/' + strategy + '/' + method, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: body && JSON.stringify(body),
                credentials: 'include'
            }).then(function (response) {
                return response.json();
            }).then(function (response) {
                if (response.status === 'error') {
                    throw new Error(response.message);
                }
                var user = response.user,
                    token = response.token;

                if (_this2.standalone) {
                    return fetch(_this2.apiLoginUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': 'JWT ' + token
                        },
                        credentials: 'include'
                    }).then(function () {
                        return user;
                    });
                } else {
                    return user;
                }
            }).then(function (user) {
                return _this2.next(user);
            });
        }
    }, {
        key: 'method',
        value: function method(strategy, _method, body) {
            var _this3 = this;

            return fetch(this.oothUrl + '/' + strategy + '/' + _method, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body),
                credentials: 'include'
            }).then(function (response) {
                return response.json();
            }).then(function (response) {
                if (response.status === 'error') {
                    throw new Error(response.message);
                } else {
                    if (response.user) {
                        _this3.next(response.user);
                    }
                    return response;
                }
            });
        }
    }, {
        key: 'logout',
        value: function logout() {
            var _this4 = this;

            return fetch(this.oothUrl + '/logout', {
                method: 'POST',
                credentials: 'include'
            }).then(function (response) {
                if (_this4.standalone) {
                    return fetch(_this4.apiLogoutUrl, {
                        method: 'POST',
                        credentials: 'include'
                    });
                }
            }).then(function () {
                return _this4.next(null);
            });
        }
    }, {
        key: 'status',
        value: function status(cookies) {
            var _this5 = this;

            var opts = {
                method: 'GET'
            };
            if (cookies) {
                opts.headers = {
                    'Cookie': Object.keys(cookies).map(function (key) {
                        return key + '=' + cookies[key];
                    }).join('; ')
                };
            } else {
                opts.credentials = 'include';
            }
            return fetch(this.oothUrl + '/status', opts).then(function (response) {
                return response.json();
            }).then(function (_ref2) {
                var user = _ref2.user;

                return _this5.next(user);
            });
        }
    }, {
        key: 'subscribeStatus',
        value: function subscribeStatus() {
            var _this6 = this;

            var HEARTBEAT = {
                ping: 'PING',
                pong: 'PONG',
                timeout: 33000
            };
            var pongTimeout = void 0;
            var heartBeat = function heartBeat(webSocket) {
                webSocket.send(JSON.stringify({ msg: HEARTBEAT.pong }));
                clearTimeout(pongTimeout);
                pongTimeout = setTimeout(function heartBeatCheck() {
                    console.log("Socket closing due to client inactivity");
                    webSocket.close();
                }, HEARTBEAT.timeout);
            };
            var stopHeartBeat = function stopHeartBeat() {
                clearTimeout(pongTimeout);
            };
            if (typeof WebSocket !== 'undefined') {
                var urlParts = url.parse(this.oothUrl);
                var protocol = urlParts.protocol === 'https:' ? 'wss' : 'ws';
                var wsUrl = protocol + '://' + urlParts.host + urlParts.path + '/status';
                var socket = new WebSocket(wsUrl);
                socket.onerror = function (err) {
                    console.error(err);
                    stopHeartBeat();
                };
                socket.onopen = function () {};
                socket.onclose = function () {
                    stopHeartBeat();
                };
                socket.onmessage = function (_ref3) {
                    var data = _ref3.data;

                    var _JSON$parse = JSON.parse(data),
                        user = _JSON$parse.user,
                        msg = _JSON$parse.msg;

                    if (msg && msg === HEARTBEAT.ping) {
                        heartBeat(socket);
                        return;
                    }
                    user = user || null;
                    return _this6.next(user);
                };
            }
        }
    }]);

    return OothClient;
}();

module.exports = OothClient;