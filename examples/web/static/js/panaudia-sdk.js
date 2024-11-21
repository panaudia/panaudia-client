class Z {
  constructor(t, e, n, s) {
    this.uuid = t, this.name = e, this.ticket = n, this.connection = s;
  }
  static fromJson(t) {
    let e = JSON.parse(t);
    return e ? new Z(
      e.uuid,
      e.name,
      e.ticket,
      e.connection
    ) : null;
  }
}
class U {
  constructor(t = 0, e = 0, n = 0, s = 1) {
    this.isQuaternion = !0, this._x = t, this._y = e, this._z = n, this._w = s;
  }
  get x() {
    return this._x;
  }
  set x(t) {
    this._x = t;
  }
  get y() {
    return this._y;
  }
  set y(t) {
    this._y = t;
  }
  get z() {
    return this._z;
  }
  set z(t) {
    this._z = t;
  }
  get w() {
    return this._w;
  }
  set w(t) {
    this._w = t;
  }
  set(t, e, n, s) {
    return this._x = t, this._y = e, this._z = n, this._w = s, this;
  }
  clone() {
    return new this.constructor(this._x, this._y, this._z, this._w);
  }
  copy(t) {
    return this._x = t.x, this._y = t.y, this._z = t.z, this._w = t.w, this;
  }
  setFromEuler(t, e = !0) {
    const n = t._x, s = t._y, c = t._z, r = t._order, h = Math.cos, f = Math.sin, a = h(n / 2), o = h(s / 2), l = h(c / 2), _ = f(n / 2), u = f(s / 2), d = f(c / 2);
    switch (r) {
      case "XYZ":
        this._x = _ * o * l + a * u * d, this._y = a * u * l - _ * o * d, this._z = a * o * d + _ * u * l, this._w = a * o * l - _ * u * d;
        break;
      case "YXZ":
        this._x = _ * o * l + a * u * d, this._y = a * u * l - _ * o * d, this._z = a * o * d - _ * u * l, this._w = a * o * l + _ * u * d;
        break;
      case "ZXY":
        this._x = _ * o * l - a * u * d, this._y = a * u * l + _ * o * d, this._z = a * o * d + _ * u * l, this._w = a * o * l - _ * u * d;
        break;
      case "ZYX":
        this._x = _ * o * l - a * u * d, this._y = a * u * l + _ * o * d, this._z = a * o * d - _ * u * l, this._w = a * o * l + _ * u * d;
        break;
      case "YZX":
        this._x = _ * o * l + a * u * d, this._y = a * u * l + _ * o * d, this._z = a * o * d - _ * u * l, this._w = a * o * l - _ * u * d;
        break;
      case "XZY":
        this._x = _ * o * l - a * u * d, this._y = a * u * l - _ * o * d, this._z = a * o * d + _ * u * l, this._w = a * o * l + _ * u * d;
        break;
      default:
        console.warn(
          "THREE.Quaternion: .setFromEuler() encountered an unknown order: " + r
        );
    }
    return this;
  }
}
class D {
  constructor(t = 0, e = 0, n = 0) {
    D.prototype.isVector3 = !0, this.x = t, this.y = e, this.z = n;
  }
}
class $ {
  constructor(t, e, n, s, c, r, h, f, a, o, l, _, u, d, C, F) {
    $.prototype.isMatrix4 = !0, this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], t !== void 0 && this.set(
      t,
      e,
      n,
      s,
      c,
      r,
      h,
      f,
      a,
      o,
      l,
      _,
      u,
      d,
      C,
      F
    );
  }
  makeRotationFromQuaternion(t) {
    return this.compose(N, t, Q);
  }
  compose(t, e, n) {
    const s = this.elements, c = e._x, r = e._y, h = e._z, f = e._w, a = c + c, o = r + r, l = h + h, _ = c * a, u = c * o, d = c * l, C = r * o, F = r * l, E = h * l, B = f * a, O = f * o, J = f * l, v = n.x, R = n.y, A = n.z;
    return s[0] = (1 - (C + E)) * v, s[1] = (u + J) * v, s[2] = (d - O) * v, s[3] = 0, s[4] = (u - J) * R, s[5] = (1 - (_ + E)) * R, s[6] = (F + B) * R, s[7] = 0, s[8] = (d + O) * A, s[9] = (F - B) * A, s[10] = (1 - (_ + C)) * A, s[11] = 0, s[12] = t.x, s[13] = t.y, s[14] = t.z, s[15] = 1, this;
  }
}
const N = /* @__PURE__ */ new D(0, 0, 0), Q = /* @__PURE__ */ new D(1, 1, 1), L = /* @__PURE__ */ new $(), W = /* @__PURE__ */ new U();
function w(i, t, e) {
  return Math.max(t, Math.min(e, i));
}
class g {
  constructor(t = 0, e = 0, n = 0, s = g.DEFAULT_ORDER) {
    this.isEuler = !0, this._x = t, this._y = e, this._z = n, this._order = s;
  }
  get x() {
    return this._x;
  }
  set x(t) {
    this._x = t;
  }
  get y() {
    return this._y;
  }
  set y(t) {
    this._y = t;
  }
  get z() {
    return this._z;
  }
  set z(t) {
    this._z = t;
  }
  get order() {
    return this._order;
  }
  set order(t) {
    this._order = t;
  }
  set(t, e, n, s = this._order) {
    return this._x = t, this._y = e, this._z = n, this._order = s, this;
  }
  clone() {
    return new this.constructor(this._x, this._y, this._z, this._order);
  }
  copy(t) {
    return this._x = t._x, this._y = t._y, this._z = t._z, this._order = t._order, this;
  }
  setFromRotationMatrix(t, e = this._order, n = !0) {
    const s = t.elements, c = s[0], r = s[4], h = s[8], f = s[1], a = s[5], o = s[9], l = s[2], _ = s[6], u = s[10];
    switch (e) {
      case "XYZ":
        this._y = Math.asin(w(h, -1, 1)), Math.abs(h) < 0.9999999 ? (this._x = Math.atan2(-o, u), this._z = Math.atan2(-r, c)) : (this._x = Math.atan2(_, a), this._z = 0);
        break;
      case "YXZ":
        this._x = Math.asin(-w(o, -1, 1)), Math.abs(o) < 0.9999999 ? (this._y = Math.atan2(h, u), this._z = Math.atan2(f, a)) : (this._y = Math.atan2(-l, c), this._z = 0);
        break;
      case "ZXY":
        this._x = Math.asin(w(_, -1, 1)), Math.abs(_) < 0.9999999 ? (this._y = Math.atan2(-l, u), this._z = Math.atan2(-r, a)) : (this._y = 0, this._z = Math.atan2(f, c));
        break;
      case "ZYX":
        this._y = Math.asin(-w(l, -1, 1)), Math.abs(l) < 0.9999999 ? (this._x = Math.atan2(_, u), this._z = Math.atan2(f, c)) : (this._x = 0, this._z = Math.atan2(-r, a));
        break;
      case "YZX":
        this._z = Math.asin(w(f, -1, 1)), Math.abs(f) < 0.9999999 ? (this._x = Math.atan2(-o, a), this._y = Math.atan2(-l, c)) : (this._x = 0, this._y = Math.atan2(h, u));
        break;
      case "XZY":
        this._z = Math.asin(-w(r, -1, 1)), Math.abs(r) < 0.9999999 ? (this._x = Math.atan2(_, a), this._y = Math.atan2(h, c)) : (this._x = Math.atan2(-o, u), this._y = 0);
        break;
      default:
        console.warn(
          "THREE.Euler: .setFromRotationMatrix() encountered an unknown order: " + e
        );
    }
    return this._order = e, this;
  }
  setFromQuaternion(t, e, n) {
    return L.makeRotationFromQuaternion(t), this.setFromRotationMatrix(L, e, n);
  }
  setFromVector3(t, e = this._order) {
    return this.set(t.x, t.y, t.z, e);
  }
  reorder(t) {
    return W.setFromEuler(this), this.setFromQuaternion(W, t);
  }
  equals(t) {
    return t._x === this._x && t._y === this._y && t._z === this._z && t._order === this._order;
  }
  fromArray(t) {
    return this._x = t[0], this._y = t[1], this._z = t[2], t[3] !== void 0 && (this._order = t[3]), this._onChangeCallback(), this;
  }
  toArray(t = [], e = 0) {
    return t[e] = this._x, t[e + 1] = this._y, t[e + 2] = this._z, t[e + 3] = this._order, t;
  }
  *[Symbol.iterator]() {
    yield this._x, yield this._y, yield this._z, yield this._order;
  }
}
g.DEFAULT_ORDER = "XYZ";
class m {
  constructor(t = 0, e = 0, n = 0, s = 0, c = 0, r = 0, h = 0, f = 0, a = "") {
    this.x = t, this.y = e, this.z = n, this.yaw = s, this.pitch = c, this.roll = r, this.volume = h, this.gone = f !== 0, this.uuid = a;
  }
  static fromWebGLCoordinates2(t, e, n, s, c, r) {
    let h = new g(s, c, r);
    h.reorder("YXZ");
    let f = t / 2 + 0.5, a = -(n / 2) + 0.5, o = e / 2 + 0.5;
    return new m(
      f,
      a,
      o,
      p(h.y),
      p(h.x),
      -p(h.z)
    );
  }
  static fromWebGLCoordinates(t, e, n, s, c, r) {
    let h = new g(s, c, r);
    h.reorder("YXZ");
    let f = -(n / 2) + 0.5, a = -(t / 2) + 0.5, o = e / 2 + 0.5;
    return new m(
      f,
      a,
      o,
      p(h.y),
      p(h.x),
      p(h.z)
    );
  }
  static fromDataBuffer(t) {
    const e = new DataView(t), n = ("0000000000000000" + e.getBigUint64(0, !1).toString(16)).slice(-16), s = ("0000000000000000" + e.getBigUint64(8, !1).toString(16)).slice(-16), c = `${n.slice(0, 8)}-${n.slice(8, 12)}-${n.slice(12, 16)}-${s.slice(0, 4)}-${s.slice(4, 16)}`;
    return new m(
      e.getFloat32(16, !0),
      e.getFloat32(20, !0),
      e.getFloat32(24, !0),
      e.getFloat32(28, !0),
      e.getFloat32(32, !0),
      e.getFloat32(36, !0),
      e.getFloat32(40, !0),
      e.getInt32(44, !0),
      c
    );
  }
  static fromBlobAsWeb(t, e) {
    var n, s = new FileReader();
    s.onload = function(c) {
      n = c.target.result;
      const r = new DataView(n), h = ("0000000000000000" + r.getBigUint64(0, !1).toString(16)).slice(-16), f = ("0000000000000000" + r.getBigUint64(8, !1).toString(16)).slice(-16), a = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${f.slice(0, 4)}-${f.slice(4, 16)}`, o = new m(
        r.getFloat32(16, !0),
        r.getFloat32(20, !0),
        r.getFloat32(24, !0),
        r.getFloat32(28, !0),
        r.getFloat32(32, !0),
        r.getFloat32(36, !0),
        r.getFloat32(40, !0),
        r.getInt32(44, !0),
        a
      );
      e(o.asWebGLCoordinates());
    }, s.readAsArrayBuffer(t);
  }
  toDataBuffer() {
    const t = new ArrayBuffer(48), e = new DataView(t);
    return e.setFloat32(16, this.x, !0), e.setFloat32(20, this.y, !0), e.setFloat32(24, this.z, !0), e.setFloat32(28, this.yaw, !0), e.setFloat32(32, this.pitch, !0), e.setFloat32(36, this.roll, !0), t;
  }
  asWebGLCoordinates2() {
    let t = new g(
      b(this.pitch),
      b(this.yaw),
      -b(this.roll),
      "YXZ"
    );
    return t.reorder("XYZ"), {
      uuid: this.uuid,
      position: {
        x: (this.x - 0.5) * 2,
        y: (this.z - 0.5) * 2,
        z: -((this.y - 0.5) * 2)
      },
      rotation: { x: t.x, y: t.y, z: t.z },
      volume: this.volume,
      gone: this.gone
    };
  }
  asWebGLCoordinates() {
    let t = new g(
      b(this.pitch),
      b(this.yaw),
      b(this.roll),
      "YXZ"
    );
    return t.reorder("XYZ"), {
      uuid: this.uuid,
      position: {
        x: -((this.y - 0.5) * 2),
        y: (this.z - 0.5) * 2,
        z: -((this.x - 0.5) * 2)
      },
      rotation: { x: t.x, y: t.y, z: t.z },
      volume: this.volume,
      gone: this.gone
    };
  }
}
function p(i) {
  return i / Math.PI * 180;
}
function b(i) {
  return i / 180 * Math.PI;
}
let x, y, T, z, X, S, Y, M;
function I(i) {
  X = i;
}
function V(i) {
  S = i;
}
function j(i) {
  Y = i;
}
function H(i) {
  M = i;
}
function P(i, t) {
  if (z !== void 0 && z.readyState === "open") {
    let e = m.fromWebGLCoordinates(
      i.x,
      i.y,
      i.z,
      t.x,
      t.y,
      t.z
    );
    z.send(e.toDataBuffer());
  }
}
function K(i) {
  if (z !== void 0 && z.readyState === "open") {
    let t = new m(
      i.x,
      i.y,
      i.z,
      i.yaw,
      i.pitch,
      i.roll
    );
    z.send(t.toDataBuffer());
  }
}
function q() {
  x.close();
}
function tt(i, t, e, n, s, c = {}, r = "https://panaudia.com/entrance") {
  let h = m.fromWebGLCoordinates(
    n.x,
    n.y,
    n.z,
    s.x,
    s.y,
    s.z
  );
  G(i, t, e, h, c, r);
}
function G(i, t, e, n, s = {}, c = "https://panaudia.com/entrance") {
  let r = {
    x: n.x,
    y: n.y,
    z: n.z,
    yaw: n.yaw,
    pitch: n.pitch,
    roll: n.roll
  };
  t === !0 && (r.data = "true"), fetch(c + "?ticket=" + i).then((h) => {
    if (h.ok)
      return h.json();
  }).then((h) => {
    if (h.status === "ok") {
      const f = new URLSearchParams({
        ticket: i,
        ...s,
        ...r
      }), a = h.url + "?" + f.toString();
      et(a, e);
    } else
      console.error("lookup failed");
  }).catch((h) => console.error("lookup error:", h));
}
function et(i, t) {
  M("connecting", "Connecting"), navigator.mediaDevices.getUserMedia({
    audio: {
      autoGainControl: !0,
      channelCount: 2,
      echoCancellation: !1,
      latency: 0,
      noiseSuppression: !1,
      sampleRate: 48e3,
      sampleSize: 16,
      volume: 1
    }
  }).then((e) => {
    y = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun.l.google.com:5349" },
        { urls: "stun:stun1.l.google.com:3478" },
        { urls: "stun:stun1.l.google.com:5349" }
      ]
    }), e.getTracks().forEach((n) => y.addTrack(n, e)), st(y), y.createOffer().then((n) => {
      n.sdp = n.sdp.replace("a=fmtp:111 ", "a=fmtp:111 stereo=1; "), n.sdp = n.sdp.replace("stereo=1;", "stereo=1; sprop-stereo=1;"), y.setLocalDescription(n).then((s) => {
        nt(i);
      });
    }), y.ontrack = function(n) {
      M("connected", "Connected");
      let s = document.createElement(n.track.kind);
      s.srcObject = n.streams[0], s.autoplay = !0, s.controls = !0, s.id = "panaudia-player", document.getElementById(t).prepend(s), n.track.onmute = function(c) {
        s.play();
      }, n.streams[0].onremovetrack = ({ track: c }) => {
        s.parentNode && s.parentNode.removeChild(s);
      };
    };
  }).catch(window.alert);
}
function st(i) {
  X !== void 0 && (T = i.createDataChannel("attributes"), T.onmessage = (e) => {
    let n = Z.fromJson(e.data);
    if (!n)
      return k("failed to parse attributes");
    X(n);
  });
  let t = i.createDataChannel("state");
  t.onopen = () => {
    z = t, M("data_connected", "Data channel connected");
  }, t.onmessage = (e) => {
    if (e.data instanceof ArrayBuffer) {
      let n = m.fromDataBuffer(e.data);
      S !== void 0 && S(n.asWebGLCoordinates()), Y !== void 0 && Y(n);
    } else
      m.fromBlobAsWeb(e.data, S);
  };
}
function nt(i) {
  x = new WebSocket(i), x.onclose = function(t) {
    M("disconnected", "Disconnected");
  }, x.onmessage = function(t) {
    let e = JSON.parse(t.data);
    if (!e)
      return k("failed to parse msg");
    switch (e.event) {
      case "answer":
        let n = JSON.parse(e.data);
        if (!n)
          return k("failed to parse answer");
        try {
          console.log(n), y.setRemoteDescription(n);
        } catch (r) {
          alert(r);
        }
        return;
      case "candidate":
        let s = JSON.parse(e.data);
        if (!s)
          return k("failed to parse candidate");
        y.addIceCandidate(s);
        return;
      case "error":
        let c = JSON.parse(e.data);
        if (!c)
          return k("failed to parse error message");
        console.log("errorMsg", c), M("error", c.message);
        return;
    }
  }, x.onerror = function(t) {
    k("ERROR: " + t);
  }, x.onopen = function(t) {
    let e = JSON.stringify(y.localDescription);
    x.send(JSON.stringify({ event: "offer", data: e })), y.onicecandidate = (n) => {
      if (n.candidate && n.candidate.candidate !== "") {
        let s = JSON.stringify(n.candidate);
        x.send(JSON.stringify({ event: "candidate", data: s }));
      }
    };
  };
}
const k = (i) => {
  console.log(i);
};
function it(i) {
  I(i);
}
function at(i) {
  V(i);
}
function rt(i) {
  j(i);
}
function ot(i) {
  H(i);
}
function ct(i, t) {
  P(i, t);
}
function ht(i) {
  K(i);
}
function lt() {
  q();
}
function ut(i, t, e, n, s, c = {}, r = "https://panaudia.com/gateway") {
  tt(i, t, e, n, s, c, r);
}
function _t(i, t, e, n, s = {}, c = "https://panaudia.com/gateway") {
  G(i, t, e, n, s, c);
}
export {
  ut as connect,
  _t as connectAmbisonic,
  lt as disconnect,
  ct as move,
  ht as moveAmbisonic,
  rt as setAmbisonicStateCallback,
  it as setAttributesCallback,
  ot as setConnectionStatusCallback,
  at as setStateCallback
};
//# sourceMappingURL=panaudia-sdk.js.map
