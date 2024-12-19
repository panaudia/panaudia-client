class $ {
  constructor(t, e, i, s) {
    this.uuid = t, this.name = e, this.ticket = i, this.connection = s;
  }
  static fromJson(t) {
    let e = JSON.parse(t);
    return e ? new $(
      e.uuid,
      e.name,
      e.ticket,
      e.connection
    ) : null;
  }
}
class N {
  constructor(t = 0, e = 0, i = 0, s = 1) {
    this.isQuaternion = !0, this._x = t, this._y = e, this._z = i, this._w = s;
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
  set(t, e, i, s) {
    return this._x = t, this._y = e, this._z = i, this._w = s, this;
  }
  clone() {
    return new this.constructor(this._x, this._y, this._z, this._w);
  }
  copy(t) {
    return this._x = t.x, this._y = t.y, this._z = t.z, this._w = t.w, this;
  }
  setFromEuler(t, e = !0) {
    const i = t._x, s = t._y, c = t._z, r = t._order, h = Math.cos, f = Math.sin, a = h(i / 2), o = h(s / 2), l = h(c / 2), d = f(i / 2), u = f(s / 2), _ = f(c / 2);
    switch (r) {
      case "XYZ":
        this._x = d * o * l + a * u * _, this._y = a * u * l - d * o * _, this._z = a * o * _ + d * u * l, this._w = a * o * l - d * u * _;
        break;
      case "YXZ":
        this._x = d * o * l + a * u * _, this._y = a * u * l - d * o * _, this._z = a * o * _ - d * u * l, this._w = a * o * l + d * u * _;
        break;
      case "ZXY":
        this._x = d * o * l - a * u * _, this._y = a * u * l + d * o * _, this._z = a * o * _ + d * u * l, this._w = a * o * l - d * u * _;
        break;
      case "ZYX":
        this._x = d * o * l - a * u * _, this._y = a * u * l + d * o * _, this._z = a * o * _ - d * u * l, this._w = a * o * l + d * u * _;
        break;
      case "YZX":
        this._x = d * o * l + a * u * _, this._y = a * u * l + d * o * _, this._z = a * o * _ - d * u * l, this._w = a * o * l - d * u * _;
        break;
      case "XZY":
        this._x = d * o * l - a * u * _, this._y = a * u * l - d * o * _, this._z = a * o * _ + d * u * l, this._w = a * o * l + d * u * _;
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
  constructor(t = 0, e = 0, i = 0) {
    D.prototype.isVector3 = !0, this.x = t, this.y = e, this.z = i;
  }
}
class E {
  constructor(t, e, i, s, c, r, h, f, a, o, l, d, u, _, C, F) {
    E.prototype.isMatrix4 = !0, this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], t !== void 0 && this.set(
      t,
      e,
      i,
      s,
      c,
      r,
      h,
      f,
      a,
      o,
      l,
      d,
      u,
      _,
      C,
      F
    );
  }
  makeRotationFromQuaternion(t) {
    return this.compose(U, t, Q);
  }
  compose(t, e, i) {
    const s = this.elements, c = e._x, r = e._y, h = e._z, f = e._w, a = c + c, o = r + r, l = h + h, d = c * a, u = c * o, _ = c * l, C = r * o, F = r * l, B = h * l, O = f * a, L = f * o, J = f * l, R = i.x, v = i.y, X = i.z;
    return s[0] = (1 - (C + B)) * R, s[1] = (u + J) * R, s[2] = (_ - L) * R, s[3] = 0, s[4] = (u - J) * v, s[5] = (1 - (d + B)) * v, s[6] = (F + O) * v, s[7] = 0, s[8] = (_ + L) * X, s[9] = (F - O) * X, s[10] = (1 - (d + C)) * X, s[11] = 0, s[12] = t.x, s[13] = t.y, s[14] = t.z, s[15] = 1, this;
  }
}
const U = /* @__PURE__ */ new D(0, 0, 0), Q = /* @__PURE__ */ new D(1, 1, 1), T = /* @__PURE__ */ new E(), W = /* @__PURE__ */ new N();
function w(n, t, e) {
  return Math.max(t, Math.min(e, n));
}
class x {
  constructor(t = 0, e = 0, i = 0, s = x.DEFAULT_ORDER) {
    this.isEuler = !0, this._x = t, this._y = e, this._z = i, this._order = s;
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
  set(t, e, i, s = this._order) {
    return this._x = t, this._y = e, this._z = i, this._order = s, this;
  }
  clone() {
    return new this.constructor(this._x, this._y, this._z, this._order);
  }
  copy(t) {
    return this._x = t._x, this._y = t._y, this._z = t._z, this._order = t._order, this;
  }
  setFromRotationMatrix(t, e = this._order, i = !0) {
    const s = t.elements, c = s[0], r = s[4], h = s[8], f = s[1], a = s[5], o = s[9], l = s[2], d = s[6], u = s[10];
    switch (e) {
      case "XYZ":
        this._y = Math.asin(w(h, -1, 1)), Math.abs(h) < 0.9999999 ? (this._x = Math.atan2(-o, u), this._z = Math.atan2(-r, c)) : (this._x = Math.atan2(d, a), this._z = 0);
        break;
      case "YXZ":
        this._x = Math.asin(-w(o, -1, 1)), Math.abs(o) < 0.9999999 ? (this._y = Math.atan2(h, u), this._z = Math.atan2(f, a)) : (this._y = Math.atan2(-l, c), this._z = 0);
        break;
      case "ZXY":
        this._x = Math.asin(w(d, -1, 1)), Math.abs(d) < 0.9999999 ? (this._y = Math.atan2(-l, u), this._z = Math.atan2(-r, a)) : (this._y = 0, this._z = Math.atan2(f, c));
        break;
      case "ZYX":
        this._y = Math.asin(-w(l, -1, 1)), Math.abs(l) < 0.9999999 ? (this._x = Math.atan2(d, u), this._z = Math.atan2(f, c)) : (this._x = 0, this._z = Math.atan2(-r, a));
        break;
      case "YZX":
        this._z = Math.asin(w(f, -1, 1)), Math.abs(f) < 0.9999999 ? (this._x = Math.atan2(-o, a), this._y = Math.atan2(-l, c)) : (this._x = 0, this._y = Math.atan2(h, u));
        break;
      case "XZY":
        this._z = Math.asin(-w(r, -1, 1)), Math.abs(r) < 0.9999999 ? (this._x = Math.atan2(d, a), this._y = Math.atan2(h, c)) : (this._x = Math.atan2(-o, u), this._y = 0);
        break;
      default:
        console.warn(
          "THREE.Euler: .setFromRotationMatrix() encountered an unknown order: " + e
        );
    }
    return this._order = e, this;
  }
  setFromQuaternion(t, e, i) {
    return T.makeRotationFromQuaternion(t), this.setFromRotationMatrix(T, e, i);
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
x.DEFAULT_ORDER = "XYZ";
class m {
  constructor(t = 0, e = 0, i = 0, s = 0, c = 0, r = 0, h = 0, f = 0, a = "") {
    this.x = t, this.y = e, this.z = i, this.yaw = s, this.pitch = c, this.roll = r, this.volume = h, this.gone = f !== 0, this.uuid = a;
  }
  static fromWebGLCoordinates2(t, e, i, s, c, r) {
    let h = new x(s, c, r);
    h.reorder("YXZ");
    let f = t / 2 + 0.5, a = -(i / 2) + 0.5, o = e / 2 + 0.5;
    return new m(
      f,
      a,
      o,
      b(h.y),
      b(h.x),
      -b(h.z)
    );
  }
  static fromWebGLCoordinates(t, e, i, s, c, r) {
    let h = new x(s, c, r);
    h.reorder("YXZ");
    let f = -(i / 2) + 0.5, a = -(t / 2) + 0.5, o = e / 2 + 0.5;
    return new m(
      f,
      a,
      o,
      b(h.y),
      b(h.x),
      b(h.z)
    );
  }
  static fromDataBuffer(t) {
    const e = new DataView(t), i = ("0000000000000000" + e.getBigUint64(0, !1).toString(16)).slice(-16), s = ("0000000000000000" + e.getBigUint64(8, !1).toString(16)).slice(-16), c = `${i.slice(0, 8)}-${i.slice(8, 12)}-${i.slice(12, 16)}-${s.slice(0, 4)}-${s.slice(4, 16)}`;
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
    var i, s = new FileReader();
    s.onload = function(c) {
      i = c.target.result;
      const r = new DataView(i), h = ("0000000000000000" + r.getBigUint64(0, !1).toString(16)).slice(-16), f = ("0000000000000000" + r.getBigUint64(8, !1).toString(16)).slice(-16), a = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${f.slice(0, 4)}-${f.slice(4, 16)}`, o = new m(
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
    let t = new x(
      p(this.pitch),
      p(this.yaw),
      -p(this.roll),
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
    let t = new x(
      p(this.pitch),
      p(this.yaw),
      p(this.roll),
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
function b(n) {
  return n / Math.PI * 180;
}
function p(n) {
  return n / 180 * Math.PI;
}
let g, y, z, Y, S, Z, M, A;
function I(n) {
  Y = n;
}
function V(n) {
  S = n;
}
function j(n) {
  Z = n;
}
function H(n) {
  M = n;
}
function P(n, t) {
  if (z !== void 0 && z.readyState === "open") {
    let e = m.fromWebGLCoordinates(
      n.x,
      n.y,
      n.z,
      t.x,
      t.y,
      t.z
    );
    z.send(e.toDataBuffer());
  }
}
function K(n) {
  if (z !== void 0 && z.readyState === "open") {
    let t = new m(
      n.x,
      n.y,
      n.z,
      n.yaw,
      n.pitch,
      n.roll
    );
    z.send(t.toDataBuffer());
  }
}
function q() {
  console.log("disconnecting"), A !== void 0 && A.forEach((n) => {
    n.stop();
  }), y.close(), g.close();
}
function tt(n, t, e, i, s, c = {}, r = "https://panaudia.com/entrance") {
  let h = m.fromWebGLCoordinates(
    i.x,
    i.y,
    i.z,
    s.x,
    s.y,
    s.z
  );
  G(n, t, e, h, c, r);
}
function G(n, t, e, i, s = {}, c = "https://panaudia.com/entrance") {
  let r = {
    x: i.x,
    y: i.y,
    z: i.z,
    yaw: i.yaw,
    pitch: i.pitch,
    roll: i.roll
  };
  t === !0 && (r.data = "true"), fetch(c + "?ticket=" + n).then((h) => {
    if (h.ok)
      return h.json();
  }).then((h) => {
    if (h.status === "ok") {
      const f = new URLSearchParams({
        ticket: n,
        ...s,
        ...r
      }), a = h.url + "?" + f.toString();
      et(a, e);
    } else
      console.error("lookup failed");
  }).catch((h) => console.error("lookup error:", h));
}
async function et(n, t) {
  y = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun.l.google.com:5349" },
      { urls: "stun:stun1.l.google.com:3478" }
    ]
  }), y.onicecandidate = (i) => {
    if (i.candidate && i.candidate.candidate !== "") {
      let s = JSON.stringify(i.candidate);
      g.send(JSON.stringify({ event: "candidate", data: s }));
    }
  }, y.ontrack = function(i) {
    M("connected", "Connected");
    let s = document.createElement(i.track.kind);
    s.srcObject = i.streams[0], s.autoplay = !0, s.controls = !0, s.id = "panaudia-player", document.getElementById(t).prepend(s), i.track.onmute = function(c) {
      s.play();
    }, i.streams[0].onremovetrack = ({ track: c }) => {
      s.parentNode && s.parentNode.removeChild(s);
    };
  };
  const e = await navigator.mediaDevices.getUserMedia(
    {
      audio: {
        autoGainControl: !0,
        echoCancellation: !1,
        latency: 0,
        noiseSuppression: !1,
        sampleRate: 48e3,
        sampleSize: 16
      }
    }
  );
  A = e.getAudioTracks(), A.forEach((i) => {
    y.addTrack(i, e);
  }), st(y), it(n);
}
function st(n) {
  n.ondatachannel = (t) => {
    let e = t.channel;
    Y !== void 0 && e.label === "attributes" && (e.onmessage = (i) => {
      let s = $.fromJson(i.data);
      if (!s)
        return k("failed to parse attributes");
      Y(s);
    }), e.label === "state" && (z = e, e.onopen = () => {
      M("data_connected", "Data channel connected");
    }, e.onmessage = (i) => {
      if (i.data instanceof ArrayBuffer) {
        let s = m.fromDataBuffer(i.data);
        S !== void 0 && S(s.asWebGLCoordinates()), Z !== void 0 && Z(s);
      } else
        m.fromBlobAsWeb(i.data, S);
    });
  };
}
function it(n) {
  M("connecting", "Connecting"), g = new WebSocket(n), g.onclose = function(t) {
    M("disconnected", "Disconnected");
  }, g.onmessage = function(t) {
    let e = JSON.parse(t.data);
    if (!e)
      return k("failed to parse msg");
    switch (e.event) {
      case "offer":
        let i = JSON.parse(e.data);
        if (!i)
          return k("failed to parse offer");
        try {
          nt(i);
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
  }, g.onerror = function(t) {
    k("ERROR: " + t);
  };
}
async function nt(n) {
  await y.setRemoteDescription(n);
  let t = await y.createAnswer();
  t.sdp = t.sdp.replace("a=fmtp:111 ", "a=fmtp:111 stereo=1; sprop-stereo=1; "), await y.setLocalDescription(t);
  let e = JSON.stringify(t);
  g.send(JSON.stringify({ event: "answer", data: e }));
}
const k = (n) => {
  console.log(n);
};
function at(n) {
  I(n);
}
function rt(n) {
  V(n);
}
function ot(n) {
  j(n);
}
function ct(n) {
  H(n);
}
function ht(n, t) {
  P(n, t);
}
function lt(n) {
  K(n);
}
function ut() {
  q();
}
function dt(n, t, e, i, s, c = {}, r = "https://panaudia.com/gateway") {
  tt(n, t, e, i, s, c, r);
}
function _t(n, t, e, i, s = {}, c = "https://panaudia.com/gateway") {
  G(n, t, e, i, s, c);
}
export {
  dt as connect,
  _t as connectAmbisonic,
  ut as disconnect,
  ht as move,
  lt as moveAmbisonic,
  ot as setAmbisonicStateCallback,
  at as setAttributesCallback,
  ct as setConnectionStatusCallback,
  rt as setStateCallback
};
//# sourceMappingURL=panaudia-sdk.js.map
