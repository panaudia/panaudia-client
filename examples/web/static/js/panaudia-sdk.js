class Y {
  constructor(t, e, n, s) {
    this.uuid = t, this.name = e, this.ticket = n, this.connection = s;
  }
  static fromJson(t) {
    let e = JSON.parse(t);
    return e ? new Y(
      e.uuid,
      e.name,
      e.ticket,
      e.connection
    ) : null;
  }
}
class T {
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
    const n = t._x, s = t._y, o = t._z, a = t._order, _ = Math.cos, d = Math.sin, i = _(n / 2), r = _(s / 2), h = _(o / 2), u = d(n / 2), l = d(s / 2), f = d(o / 2);
    switch (a) {
      case "XYZ":
        this._x = u * r * h + i * l * f, this._y = i * l * h - u * r * f, this._z = i * r * f + u * l * h, this._w = i * r * h - u * l * f;
        break;
      case "YXZ":
        this._x = u * r * h + i * l * f, this._y = i * l * h - u * r * f, this._z = i * r * f - u * l * h, this._w = i * r * h + u * l * f;
        break;
      case "ZXY":
        this._x = u * r * h - i * l * f, this._y = i * l * h + u * r * f, this._z = i * r * f + u * l * h, this._w = i * r * h - u * l * f;
        break;
      case "ZYX":
        this._x = u * r * h - i * l * f, this._y = i * l * h + u * r * f, this._z = i * r * f - u * l * h, this._w = i * r * h + u * l * f;
        break;
      case "YZX":
        this._x = u * r * h + i * l * f, this._y = i * l * h + u * r * f, this._z = i * r * f - u * l * h, this._w = i * r * h - u * l * f;
        break;
      case "XZY":
        this._x = u * r * h - i * l * f, this._y = i * l * h - u * r * f, this._z = i * r * f + u * l * h, this._w = i * r * h + u * l * f;
        break;
      default:
        console.warn(
          "THREE.Quaternion: .setFromEuler() encountered an unknown order: " + a
        );
    }
    return this;
  }
}
class S {
  constructor(t = 0, e = 0, n = 0) {
    S.prototype.isVector3 = !0, this.x = t, this.y = e, this.z = n;
  }
}
class Z {
  constructor(t, e, n, s, o, a, _, d, i, r, h, u, l, f, k, F) {
    Z.prototype.isMatrix4 = !0, this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], t !== void 0 && this.set(
      t,
      e,
      n,
      s,
      o,
      a,
      _,
      d,
      i,
      r,
      h,
      u,
      l,
      f,
      k,
      F
    );
  }
  makeRotationFromQuaternion(t) {
    return this.compose(G, t, U);
  }
  compose(t, e, n) {
    const s = this.elements, o = e._x, a = e._y, _ = e._z, d = e._w, i = o + o, r = a + a, h = _ + _, u = o * i, l = o * r, f = o * h, k = a * r, F = a * h, E = _ * h, $ = d * i, B = d * r, O = d * h, D = n.x, R = n.y, v = n.z;
    return s[0] = (1 - (k + E)) * D, s[1] = (l + O) * D, s[2] = (f - B) * D, s[3] = 0, s[4] = (l - O) * R, s[5] = (1 - (u + E)) * R, s[6] = (F + $) * R, s[7] = 0, s[8] = (f + B) * v, s[9] = (F - $) * v, s[10] = (1 - (u + k)) * v, s[11] = 0, s[12] = t.x, s[13] = t.y, s[14] = t.z, s[15] = 1, this;
  }
}
const G = /* @__PURE__ */ new S(0, 0, 0), U = /* @__PURE__ */ new S(1, 1, 1), A = /* @__PURE__ */ new Z(), J = /* @__PURE__ */ new T();
function z(c, t, e) {
  return Math.max(t, Math.min(e, c));
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
    const s = t.elements, o = s[0], a = s[4], _ = s[8], d = s[1], i = s[5], r = s[9], h = s[2], u = s[6], l = s[10];
    switch (e) {
      case "XYZ":
        this._y = Math.asin(z(_, -1, 1)), Math.abs(_) < 0.9999999 ? (this._x = Math.atan2(-r, l), this._z = Math.atan2(-a, o)) : (this._x = Math.atan2(u, i), this._z = 0);
        break;
      case "YXZ":
        this._x = Math.asin(-z(r, -1, 1)), Math.abs(r) < 0.9999999 ? (this._y = Math.atan2(_, l), this._z = Math.atan2(d, i)) : (this._y = Math.atan2(-h, o), this._z = 0);
        break;
      case "ZXY":
        this._x = Math.asin(z(u, -1, 1)), Math.abs(u) < 0.9999999 ? (this._y = Math.atan2(-h, l), this._z = Math.atan2(-a, i)) : (this._y = 0, this._z = Math.atan2(d, o));
        break;
      case "ZYX":
        this._y = Math.asin(-z(h, -1, 1)), Math.abs(h) < 0.9999999 ? (this._x = Math.atan2(u, l), this._z = Math.atan2(d, o)) : (this._x = 0, this._z = Math.atan2(-a, i));
        break;
      case "YZX":
        this._z = Math.asin(z(d, -1, 1)), Math.abs(d) < 0.9999999 ? (this._x = Math.atan2(-r, i), this._y = Math.atan2(-h, o)) : (this._x = 0, this._y = Math.atan2(_, l));
        break;
      case "XZY":
        this._z = Math.asin(-z(a, -1, 1)), Math.abs(a) < 0.9999999 ? (this._x = Math.atan2(u, i), this._y = Math.atan2(_, o)) : (this._x = Math.atan2(-r, l), this._y = 0);
        break;
      default:
        console.warn(
          "THREE.Euler: .setFromRotationMatrix() encountered an unknown order: " + e
        );
    }
    return this._order = e, this;
  }
  setFromQuaternion(t, e, n) {
    return A.makeRotationFromQuaternion(t), this.setFromRotationMatrix(A, e, n);
  }
  setFromVector3(t, e = this._order) {
    return this.set(t.x, t.y, t.z, e);
  }
  reorder(t) {
    return J.setFromEuler(this), this.setFromQuaternion(J, t);
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
class x {
  constructor(t = 0, e = 0, n = 0, s = 0, o = 0, a = 0, _ = 0, d = 0, i = "") {
    this.x = t, this.y = e, this.z = n, this.yaw = s, this.pitch = o, this.roll = a, this.volume = _, this.gone = d !== 0, this.uuid = i;
  }
  static fromWebGLCoordinates2(t, e, n, s, o, a) {
    let _ = new g(s, o, a);
    _.reorder("YXZ");
    let d = t / 2 + 0.5, i = -(n / 2) + 0.5, r = e / 2 + 0.5;
    return new x(
      d,
      i,
      r,
      w(_.y),
      w(_.x),
      -w(_.z)
    );
  }
  static fromWebGLCoordinates(t, e, n, s, o, a) {
    let _ = new g(s, o, a);
    _.reorder("YXZ");
    let d = -(n / 2) + 0.5, i = -(t / 2) + 0.5, r = e / 2 + 0.5;
    return new x(
      d,
      i,
      r,
      w(_.y),
      w(_.x),
      w(_.z)
    );
  }
  static fromDataBuffer(t) {
    const e = new DataView(t), n = ("0000000000000000" + e.getBigUint64(0, !1).toString(16)).slice(-16), s = ("0000000000000000" + e.getBigUint64(8, !1).toString(16)).slice(-16), o = `${n.slice(0, 8)}-${n.slice(8, 12)}-${n.slice(12, 16)}-${s.slice(0, 4)}-${s.slice(4, 16)}`;
    return new x(
      e.getFloat32(16, !0),
      e.getFloat32(20, !0),
      e.getFloat32(24, !0),
      e.getFloat32(28, !0),
      e.getFloat32(32, !0),
      e.getFloat32(36, !0),
      e.getFloat32(40, !0),
      e.getInt32(44, !0),
      o
    );
  }
  static fromBlobAsWeb(t, e) {
    var n, s = new FileReader();
    s.onload = function(o) {
      n = o.target.result;
      const a = new DataView(n), _ = ("0000000000000000" + a.getBigUint64(0, !1).toString(16)).slice(-16), d = ("0000000000000000" + a.getBigUint64(8, !1).toString(16)).slice(-16), i = `${_.slice(0, 8)}-${_.slice(8, 12)}-${_.slice(12, 16)}-${d.slice(0, 4)}-${d.slice(4, 16)}`, r = new x(
        a.getFloat32(16, !0),
        a.getFloat32(20, !0),
        a.getFloat32(24, !0),
        a.getFloat32(28, !0),
        a.getFloat32(32, !0),
        a.getFloat32(36, !0),
        a.getFloat32(40, !0),
        a.getInt32(44, !0),
        i
      );
      e(r.asWebGLCoordinates());
    }, s.readAsArrayBuffer(t);
  }
  toDataBuffer() {
    const t = new ArrayBuffer(48), e = new DataView(t);
    return e.setFloat32(16, this.x, !0), e.setFloat32(20, this.y, !0), e.setFloat32(24, this.z, !0), e.setFloat32(28, this.yaw, !0), e.setFloat32(32, this.pitch, !0), e.setFloat32(36, this.roll, !0), t;
  }
  asWebGLCoordinates2() {
    let t = new g(
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
      vol: this.volume,
      gone: this.gone
    };
  }
  asWebGLCoordinates() {
    let t = new g(
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
      vol: this.volume,
      gone: this.gone
    };
  }
}
function w(c) {
  return c / Math.PI * 180;
}
function p(c) {
  return c / 180 * Math.PI;
}
let m, y, L, C, W, X, M;
function N(c) {
  W = c;
}
function Q(c) {
  X = c;
}
function I(c) {
  M = c;
}
function V(c, t, e, n, s, o) {
  if (C !== void 0 && C.readyState === "open") {
    let a = x.fromWebGLCoordinates(
      c,
      t,
      e,
      n,
      s,
      o
    );
    C.send(a.toDataBuffer());
  }
}
function j() {
  m.close();
}
function H(c, t, e, n, s = {}, o = "https://panaudia.com/entrance") {
  let a = x.fromWebGLCoordinates(
    e.x,
    e.y,
    e.z,
    n.x,
    n.y,
    n.z
  ), _ = {
    "loc[x]": a.x,
    "loc[y]": a.y,
    "loc[z]": a.z,
    "loc[yaw]": a.yaw,
    "loc[pitch]": a.pitch,
    "loc[roll]": a.roll
  };
  fetch(o + "?ticket=" + c).then((d) => {
    if (d.ok)
      return d.json();
  }).then((d) => {
    if (d.status === "ok") {
      const i = new URLSearchParams({
        ticket: c,
        ...s,
        ..._
      }), r = d.url + "?" + i.toString();
      P(r, t);
    } else
      console.error("lookup failed");
  }).catch((d) => console.error("lookup error:", d));
}
function P(c, t) {
  M("connecting", "Connecting"), navigator.mediaDevices.getUserMedia({
    audio: {
      autoGainControl: !1,
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
    }), e.getTracks().forEach((n) => y.addTrack(n, e)), K(y), y.createOffer().then((n) => {
      n.sdp = n.sdp.replace("a=fmtp:111 ", "a=fmtp:111 stereo=1; "), n.sdp = n.sdp.replace("stereo=1;", "stereo=1; sprop-stereo=1;"), y.setLocalDescription(n).then((s) => {
        q(c);
      });
    }), y.ontrack = function(n) {
      M("connected", "Connected");
      let s = document.createElement(n.track.kind);
      s.srcObject = n.streams[0], s.autoplay = !0, s.controls = !0, s.id = "panaudia-player", document.getElementById(t).prepend(s), n.track.onmute = function(o) {
        s.play();
      }, n.streams[0].onremovetrack = ({ track: o }) => {
        s.parentNode && s.parentNode.removeChild(s);
      };
    };
  }).catch(window.alert);
}
function K(c) {
  L = c.createDataChannel("attributes"), L.onmessage = (e) => {
    let n = Y.fromJson(e.data);
    if (!n)
      return b("failed to parse attributes");
    W(n);
  };
  let t = c.createDataChannel("state");
  t.onopen = () => {
    C = t, M("data_connected", "Data channel connected");
  }, t.onmessage = (e) => {
    if (e.data instanceof ArrayBuffer) {
      let n = x.fromDataBuffer(e.data);
      X(n.asWebGLCoordinates());
    } else
      x.fromBlobAsWeb(e.data, X);
  };
}
function q(c) {
  m = new WebSocket(c), m.onclose = function(t) {
    M("disconnected", "Disconnected");
  }, m.onmessage = function(t) {
    let e = JSON.parse(t.data);
    if (!e)
      return b("failed to parse msg");
    switch (e.event) {
      case "answer":
        let n = JSON.parse(e.data);
        if (!n)
          return b("failed to parse answer");
        try {
          console.log(n), y.setRemoteDescription(n);
        } catch (a) {
          alert(a);
        }
        return;
      case "candidate":
        let s = JSON.parse(e.data);
        if (!s)
          return b("failed to parse candidate");
        y.addIceCandidate(s);
        return;
      case "error":
        let o = JSON.parse(e.data);
        if (!o)
          return b("failed to parse error message");
        console.log("errorMsg", o), M("error", o.message);
        return;
    }
  }, m.onerror = function(t) {
    b("ERROR: " + t);
  }, m.onopen = function(t) {
    let e = JSON.stringify(y.localDescription);
    m.send(JSON.stringify({ event: "offer", data: e })), y.onicecandidate = (n) => {
      if (n.candidate && n.candidate.candidate !== "") {
        let s = JSON.stringify(n.candidate);
        m.send(JSON.stringify({ event: "candidate", data: s }));
      }
    };
  };
}
const b = (c) => {
  console.log(c);
};
function tt(c) {
  N(c);
}
function et(c) {
  Q(c);
}
function st(c) {
  I(c);
}
function nt(c, t) {
  V(
    c.x,
    c.y,
    c.z,
    t.x,
    t.y,
    t.z
  );
}
function it() {
  j();
}
function at(c, t, e, n, s = {}, o = "https://panaudia.com/entrance") {
  H(c, t, e, n, s, o);
}
export {
  at as connect,
  it as disconnect,
  nt as move,
  tt as setAttributesCallback,
  st as setConnectionStatusCallback,
  et as setStateCallback
};
//# sourceMappingURL=panaudia-sdk.js.map
