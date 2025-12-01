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
class Q {
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
    const n = t._x, s = t._y, a = t._z, r = t._order, h = Math.cos, _ = Math.sin, o = h(n / 2), c = h(s / 2), l = h(a / 2), d = _(n / 2), u = _(s / 2), f = _(a / 2);
    switch (r) {
      case "XYZ":
        this._x = d * c * l + o * u * f, this._y = o * u * l - d * c * f, this._z = o * c * f + d * u * l, this._w = o * c * l - d * u * f;
        break;
      case "YXZ":
        this._x = d * c * l + o * u * f, this._y = o * u * l - d * c * f, this._z = o * c * f - d * u * l, this._w = o * c * l + d * u * f;
        break;
      case "ZXY":
        this._x = d * c * l - o * u * f, this._y = o * u * l + d * c * f, this._z = o * c * f + d * u * l, this._w = o * c * l - d * u * f;
        break;
      case "ZYX":
        this._x = d * c * l - o * u * f, this._y = o * u * l + d * c * f, this._z = o * c * f - d * u * l, this._w = o * c * l + d * u * f;
        break;
      case "YZX":
        this._x = d * c * l + o * u * f, this._y = o * u * l + d * c * f, this._z = o * c * f - d * u * l, this._w = o * c * l - d * u * f;
        break;
      case "XZY":
        this._x = d * c * l - o * u * f, this._y = o * u * l - d * c * f, this._z = o * c * f + d * u * l, this._w = o * c * l + d * u * f;
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
class Z {
  constructor(t, e, n, s, a, r, h, _, o, c, l, d, u, f, M, S) {
    Z.prototype.isMatrix4 = !0, this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], t !== void 0 && this.set(
      t,
      e,
      n,
      s,
      a,
      r,
      h,
      _,
      o,
      c,
      l,
      d,
      u,
      f,
      M,
      S
    );
  }
  makeRotationFromQuaternion(t) {
    return this.compose(I, t, j);
  }
  compose(t, e, n) {
    const s = this.elements, a = e._x, r = e._y, h = e._z, _ = e._w, o = a + a, c = r + r, l = h + h, d = a * o, u = a * c, f = a * l, M = r * c, S = r * l, O = h * l, J = _ * o, L = _ * c, N = _ * l, A = n.x, R = n.y, $ = n.z;
    return s[0] = (1 - (M + O)) * A, s[1] = (u + N) * A, s[2] = (f - L) * A, s[3] = 0, s[4] = (u - N) * R, s[5] = (1 - (d + O)) * R, s[6] = (S + J) * R, s[7] = 0, s[8] = (f + L) * $, s[9] = (S - J) * $, s[10] = (1 - (d + M)) * $, s[11] = 0, s[12] = t.x, s[13] = t.y, s[14] = t.z, s[15] = 1, this;
  }
}
const I = /* @__PURE__ */ new D(0, 0, 0), j = /* @__PURE__ */ new D(1, 1, 1), T = /* @__PURE__ */ new Z(), U = /* @__PURE__ */ new Q();
function w(i, t, e) {
  return Math.max(t, Math.min(e, i));
}
class k {
  constructor(t = 0, e = 0, n = 0, s = k.DEFAULT_ORDER) {
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
    const s = t.elements, a = s[0], r = s[4], h = s[8], _ = s[1], o = s[5], c = s[9], l = s[2], d = s[6], u = s[10];
    switch (e) {
      case "XYZ":
        this._y = Math.asin(w(h, -1, 1)), Math.abs(h) < 0.9999999 ? (this._x = Math.atan2(-c, u), this._z = Math.atan2(-r, a)) : (this._x = Math.atan2(d, o), this._z = 0);
        break;
      case "YXZ":
        this._x = Math.asin(-w(c, -1, 1)), Math.abs(c) < 0.9999999 ? (this._y = Math.atan2(h, u), this._z = Math.atan2(_, o)) : (this._y = Math.atan2(-l, a), this._z = 0);
        break;
      case "ZXY":
        this._x = Math.asin(w(d, -1, 1)), Math.abs(d) < 0.9999999 ? (this._y = Math.atan2(-l, u), this._z = Math.atan2(-r, o)) : (this._y = 0, this._z = Math.atan2(_, a));
        break;
      case "ZYX":
        this._y = Math.asin(-w(l, -1, 1)), Math.abs(l) < 0.9999999 ? (this._x = Math.atan2(d, u), this._z = Math.atan2(_, a)) : (this._x = 0, this._z = Math.atan2(-r, o));
        break;
      case "YZX":
        this._z = Math.asin(w(_, -1, 1)), Math.abs(_) < 0.9999999 ? (this._x = Math.atan2(-c, o), this._y = Math.atan2(-l, a)) : (this._x = 0, this._y = Math.atan2(h, u));
        break;
      case "XZY":
        this._z = Math.asin(-w(r, -1, 1)), Math.abs(r) < 0.9999999 ? (this._x = Math.atan2(d, o), this._y = Math.atan2(h, a)) : (this._x = Math.atan2(-c, u), this._y = 0);
        break;
      default:
        console.warn(
          "THREE.Euler: .setFromRotationMatrix() encountered an unknown order: " + e
        );
    }
    return this._order = e, this;
  }
  setFromQuaternion(t, e, n) {
    return T.makeRotationFromQuaternion(t), this.setFromRotationMatrix(T, e, n);
  }
  setFromVector3(t, e = this._order) {
    return this.set(t.x, t.y, t.z, e);
  }
  reorder(t) {
    return U.setFromEuler(this), this.setFromQuaternion(U, t);
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
k.DEFAULT_ORDER = "XYZ";
class m {
  constructor(t = 0, e = 0, n = 0, s = 0, a = 0, r = 0, h = 0, _ = 0, o = "") {
    this.x = t, this.y = e, this.z = n, this.yaw = s, this.pitch = a, this.roll = r, this.volume = h, this.gone = _ !== 0, this.uuid = o;
  }
  static fromWebGLCoordinates(t, e, n, s, a, r) {
    let h = new k(s, a, r);
    h.reorder("YXZ");
    let _ = -(n / 2) + 0.5, o = -(t / 2) + 0.5, c = e / 2 + 0.5;
    return new m(
      _,
      o,
      c,
      v(h.y),
      v(h.x),
      v(h.z)
    );
  }
  static fromDataBuffer(t) {
    const e = new DataView(t), n = ("0000000000000000" + e.getBigUint64(0, !1).toString(16)).slice(-16), s = ("0000000000000000" + e.getBigUint64(8, !1).toString(16)).slice(-16), a = `${n.slice(0, 8)}-${n.slice(8, 12)}-${n.slice(12, 16)}-${s.slice(0, 4)}-${s.slice(4, 16)}`;
    return new m(
      e.getFloat32(16, !0),
      e.getFloat32(20, !0),
      e.getFloat32(24, !0),
      e.getFloat32(28, !0),
      e.getFloat32(32, !0),
      e.getFloat32(36, !0),
      e.getFloat32(40, !0),
      e.getInt32(44, !0),
      a
    );
  }
  static fromBlobAsWeb(t, e) {
    var n, s = new FileReader();
    s.onload = function(a) {
      n = a.target.result;
      const r = new DataView(n), h = ("0000000000000000" + r.getBigUint64(0, !1).toString(16)).slice(-16), _ = ("0000000000000000" + r.getBigUint64(8, !1).toString(16)).slice(-16), o = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${_.slice(0, 4)}-${_.slice(4, 16)}`, c = new m(
        r.getFloat32(16, !0),
        r.getFloat32(20, !0),
        r.getFloat32(24, !0),
        r.getFloat32(28, !0),
        r.getFloat32(32, !0),
        r.getFloat32(36, !0),
        r.getFloat32(40, !0),
        r.getInt32(44, !0),
        o
      );
      e(c.asWebGLCoordinates());
    }, s.readAsArrayBuffer(t);
  }
  toDataBuffer() {
    const t = new ArrayBuffer(48), e = new DataView(t);
    return e.setFloat32(16, this.x, !0), e.setFloat32(20, this.y, !0), e.setFloat32(24, this.z, !0), e.setFloat32(28, this.yaw, !0), e.setFloat32(32, this.pitch, !0), e.setFloat32(36, this.roll, !0), t;
  }
  asWebGLCoordinates() {
    let t = new k(
      E(this.pitch),
      E(this.yaw),
      E(this.roll),
      "YXZ"
    );
    return t.reorder("XYZ"), {
      uuid: this.uuid,
      position: {
        // x: (this.x - 0.5) * 2,
        // y: (this.z - 0.5) * 2,
        // z: -((this.y - 0.5) * 2),
        x: -(this.y - 0.5) * 2,
        y: (this.z - 0.5) * 2,
        z: -((this.x - 0.5) * 2)
      },
      rotation: { x: t.x, y: t.y, z: t.z },
      volume: this.volume,
      gone: this.gone
    };
  }
}
function v(i) {
  return i / Math.PI * 180;
}
function E(i) {
  return i / 180 * Math.PI;
}
let g, y, x, z, B, C, X, b, F;
function V(i) {
  B = i;
}
function P(i) {
  C = i;
}
function H(i) {
  X = i;
}
function K(i) {
  b = i;
}
function q(i, t) {
  if (x !== void 0 && x.readyState === "open") {
    let e = m.fromWebGLCoordinates(
      i.x,
      i.y,
      i.z,
      t.x,
      t.y,
      t.z
    );
    x.send(e.toDataBuffer());
  }
}
function tt(i) {
  if (x !== void 0 && x.readyState === "open") {
    let t = new m(
      i.x,
      i.y,
      i.z,
      i.yaw,
      i.pitch,
      i.roll
    );
    x.send(t.toDataBuffer());
  }
}
function et(i) {
  if (z !== void 0 && z.readyState === "open") {
    const t = { type: "mute", message: { node: i } };
    z.send(JSON.stringify(t));
  }
}
function st(i) {
  if (z !== void 0 && z.readyState === "open") {
    const t = { type: "unmute", message: { node: i } };
    z.send(JSON.stringify(t));
  }
}
function nt() {
  console.log("disconnecting"), F !== void 0 && F.forEach((i) => {
    i.stop();
  }), y.close(), g.close();
}
function it(i, t, e, n, s, a = {}, r = "https://panaudia.com/entrance") {
  let h = m.fromWebGLCoordinates(
    n.x,
    n.y,
    n.z,
    s.x,
    s.y,
    s.z
  );
  W(i, t, e, h, a, r);
}
function at(i, t, e, n, s = {}, a = "http://localhost:8080/join") {
  let r = m.fromWebGLCoordinates(
    e.x,
    e.y,
    e.z,
    n.x,
    n.y,
    n.z
  );
  rt(i, t, r, s, a);
}
function rt(i, t, e, n = {}, s = "http://localhost:8080/join") {
  let a = {
    x: e.x,
    y: e.y,
    z: e.z,
    yaw: e.yaw,
    pitch: e.pitch,
    roll: e.roll
  };
  i === !0 && (a.data = "true");
  const r = new URLSearchParams({ ...n, ...a }), h = s + "?" + r.toString();
  G(h, t);
}
function W(i, t, e, n, s = {}, a = "https://panaudia.com/entrance") {
  let r = {
    x: n.x,
    y: n.y,
    z: n.z,
    yaw: n.yaw,
    pitch: n.pitch,
    roll: n.roll
  };
  t === !0 && (r.data = "true"), fetch(a + "?ticket=" + i).then((h) => {
    if (h.ok)
      return h.json();
  }).then((h) => {
    if (h.status === "ok") {
      const _ = new URLSearchParams({
        ticket: i,
        ...s,
        ...r
      }), o = h.url + "?" + _.toString();
      G(o, e);
    } else
      console.error("lookup failed");
  }).catch((h) => console.error("lookup error:", h));
}
async function G(i, t) {
  y = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun.l.google.com:5349" },
      { urls: "stun:stun1.l.google.com:3478" }
    ]
  }), y.onicecandidate = (n) => {
    if (n.candidate && n.candidate.candidate !== "") {
      let s = JSON.stringify(n.candidate);
      g.send(JSON.stringify({ event: "candidate", data: s }));
    }
  }, y.ontrack = function(n) {
    b("connected", "Connected");
    let s = document.createElement(n.track.kind);
    s.srcObject = n.streams[0], s.autoplay = !0, s.controls = !0, s.id = "panaudia-player", document.getElementById(t).prepend(s), n.track.onmute = function(a) {
      s.play();
    }, n.streams[0].onremovetrack = ({ track: a }) => {
      s.parentNode && s.parentNode.removeChild(s);
    };
  };
  const e = await navigator.mediaDevices.getUserMedia(
    {
      audio: {
        autoGainControl: !1,
        echoCancellation: !1,
        latency: 0,
        noiseSuppression: !1,
        sampleRate: 48e3,
        sampleSize: 16
      }
    }
  );
  F = e.getAudioTracks(), F.forEach((n) => {
    y.addTrack(n, e);
  }), ot(y), ct(i);
}
function ot(i) {
  i.ondatachannel = (t) => {
    let e = t.channel;
    B !== void 0 && e.label === "attributes" && (e.onmessage = (n) => {
      let s = Y.fromJson(n.data);
      if (!s)
        return p("failed to parse attributes");
      B(s);
    }), e.label === "control" && (z = e), e.label === "state" && (x = e, e.onopen = () => {
      b("data_connected", "Data channel connected");
    }, e.onmessage = (n) => {
      if (n.data instanceof ArrayBuffer) {
        let s = m.fromDataBuffer(n.data);
        C !== void 0 && C(s.asWebGLCoordinates()), X !== void 0 && X(s);
      } else
        m.fromBlobAsWeb(n.data, C);
    });
  };
}
function ct(i) {
  b("connecting", "Connecting"), g = new WebSocket(i), g.onclose = function(t) {
    b("disconnected", "Disconnected");
  }, g.onmessage = function(t) {
    let e = JSON.parse(t.data);
    if (!e)
      return p("failed to parse msg");
    switch (e.event) {
      case "offer":
        let n = JSON.parse(e.data);
        if (!n)
          return p("failed to parse offer");
        try {
          ht(n);
        } catch (r) {
          alert(r);
        }
        return;
      case "candidate":
        let s = JSON.parse(e.data);
        if (!s)
          return p("failed to parse candidate");
        y.addIceCandidate(s);
        return;
      case "error":
        let a = JSON.parse(e.data);
        if (!a)
          return p("failed to parse error message");
        console.log("errorMsg", a), b("error", a.message);
        return;
    }
  }, g.onerror = function(t) {
    p("ERROR: " + t);
  };
}
async function ht(i) {
  await y.setRemoteDescription(i);
  let t = await y.createAnswer();
  t.sdp = t.sdp.replace("a=fmtp:111 ", "a=fmtp:111 stereo=1; sprop-stereo=1; "), await y.setLocalDescription(t);
  let e = JSON.stringify(t);
  g.send(JSON.stringify({ event: "answer", data: e }));
}
const p = (i) => {
  console.log(i);
};
function lt(i) {
  V(i);
}
function ut(i) {
  P(i);
}
function dt(i) {
  H(i);
}
function ft(i) {
  K(i);
}
function _t(i, t) {
  q(i, t);
}
function yt(i) {
  et(i);
}
function mt(i) {
  st(i);
}
function gt(i) {
  tt(i);
}
function xt() {
  nt();
}
function zt(i, t, e, n, s, a = {}, r = "https://panaudia.com/gateway") {
  it(i, t, e, n, s, a, r);
}
function wt(i, t, e, n, s = {}, a = "http://localhost:8080/join") {
  at(i, t, e, n, s, a);
}
function pt(i, t, e, n, s = {}, a = "https://panaudia.com/gateway") {
  W(i, t, e, n, s, a);
}
export {
  zt as connect,
  pt as connectAmbisonic,
  wt as connectDirect,
  xt as disconnect,
  _t as move,
  gt as moveAmbisonic,
  yt as mute,
  dt as setAmbisonicStateCallback,
  lt as setAttributesCallback,
  ft as setConnectionStatusCallback,
  ut as setStateCallback,
  mt as unmute
};
//# sourceMappingURL=panaudia-sdk.js.map
