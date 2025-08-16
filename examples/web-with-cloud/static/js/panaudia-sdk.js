class X {
  constructor(t, e, n, s) {
    this.uuid = t, this.name = e, this.ticket = n, this.connection = s;
  }
  static fromJson(t) {
    let e = JSON.parse(t);
    return e ? new X(
      e.uuid,
      e.name,
      e.ticket,
      e.connection
    ) : null;
  }
}
class G {
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
    const n = t._x, s = t._y, i = t._z, r = t._order, h = Math.cos, f = Math.sin, o = h(n / 2), c = h(s / 2), l = h(i / 2), _ = f(n / 2), u = f(s / 2), d = f(i / 2);
    switch (r) {
      case "XYZ":
        this._x = _ * c * l + o * u * d, this._y = o * u * l - _ * c * d, this._z = o * c * d + _ * u * l, this._w = o * c * l - _ * u * d;
        break;
      case "YXZ":
        this._x = _ * c * l + o * u * d, this._y = o * u * l - _ * c * d, this._z = o * c * d - _ * u * l, this._w = o * c * l + _ * u * d;
        break;
      case "ZXY":
        this._x = _ * c * l - o * u * d, this._y = o * u * l + _ * c * d, this._z = o * c * d + _ * u * l, this._w = o * c * l - _ * u * d;
        break;
      case "ZYX":
        this._x = _ * c * l - o * u * d, this._y = o * u * l + _ * c * d, this._z = o * c * d - _ * u * l, this._w = o * c * l + _ * u * d;
        break;
      case "YZX":
        this._x = _ * c * l + o * u * d, this._y = o * u * l + _ * c * d, this._z = o * c * d - _ * u * l, this._w = o * c * l - _ * u * d;
        break;
      case "XZY":
        this._x = _ * c * l - o * u * d, this._y = o * u * l - _ * c * d, this._z = o * c * d + _ * u * l, this._w = o * c * l + _ * u * d;
        break;
      default:
        console.warn(
          "THREE.Quaternion: .setFromEuler() encountered an unknown order: " + r
        );
    }
    return this;
  }
}
class C {
  constructor(t = 0, e = 0, n = 0) {
    C.prototype.isVector3 = !0, this.x = t, this.y = e, this.z = n;
  }
}
class Y {
  constructor(t, e, n, s, i, r, h, f, o, c, l, _, u, d, k, M) {
    Y.prototype.isMatrix4 = !0, this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], t !== void 0 && this.set(
      t,
      e,
      n,
      s,
      i,
      r,
      h,
      f,
      o,
      c,
      l,
      _,
      u,
      d,
      k,
      M
    );
  }
  makeRotationFromQuaternion(t) {
    return this.compose(Q, t, I);
  }
  compose(t, e, n) {
    const s = this.elements, i = e._x, r = e._y, h = e._z, f = e._w, o = i + i, c = r + r, l = h + h, _ = i * o, u = i * c, d = i * l, k = r * c, M = r * l, Z = h * l, O = f * o, L = f * c, J = f * l, D = n.x, A = n.y, R = n.z;
    return s[0] = (1 - (k + Z)) * D, s[1] = (u + J) * D, s[2] = (d - L) * D, s[3] = 0, s[4] = (u - J) * A, s[5] = (1 - (_ + Z)) * A, s[6] = (M + O) * A, s[7] = 0, s[8] = (d + L) * R, s[9] = (M - O) * R, s[10] = (1 - (_ + k)) * R, s[11] = 0, s[12] = t.x, s[13] = t.y, s[14] = t.z, s[15] = 1, this;
  }
}
const Q = /* @__PURE__ */ new C(0, 0, 0), I = /* @__PURE__ */ new C(1, 1, 1), T = /* @__PURE__ */ new Y(), U = /* @__PURE__ */ new G();
function z(a, t, e) {
  return Math.max(t, Math.min(e, a));
}
class b {
  constructor(t = 0, e = 0, n = 0, s = b.DEFAULT_ORDER) {
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
    const s = t.elements, i = s[0], r = s[4], h = s[8], f = s[1], o = s[5], c = s[9], l = s[2], _ = s[6], u = s[10];
    switch (e) {
      case "XYZ":
        this._y = Math.asin(z(h, -1, 1)), Math.abs(h) < 0.9999999 ? (this._x = Math.atan2(-c, u), this._z = Math.atan2(-r, i)) : (this._x = Math.atan2(_, o), this._z = 0);
        break;
      case "YXZ":
        this._x = Math.asin(-z(c, -1, 1)), Math.abs(c) < 0.9999999 ? (this._y = Math.atan2(h, u), this._z = Math.atan2(f, o)) : (this._y = Math.atan2(-l, i), this._z = 0);
        break;
      case "ZXY":
        this._x = Math.asin(z(_, -1, 1)), Math.abs(_) < 0.9999999 ? (this._y = Math.atan2(-l, u), this._z = Math.atan2(-r, o)) : (this._y = 0, this._z = Math.atan2(f, i));
        break;
      case "ZYX":
        this._y = Math.asin(-z(l, -1, 1)), Math.abs(l) < 0.9999999 ? (this._x = Math.atan2(_, u), this._z = Math.atan2(f, i)) : (this._x = 0, this._z = Math.atan2(-r, o));
        break;
      case "YZX":
        this._z = Math.asin(z(f, -1, 1)), Math.abs(f) < 0.9999999 ? (this._x = Math.atan2(-c, o), this._y = Math.atan2(-l, i)) : (this._x = 0, this._y = Math.atan2(h, u));
        break;
      case "XZY":
        this._z = Math.asin(-z(r, -1, 1)), Math.abs(r) < 0.9999999 ? (this._x = Math.atan2(_, o), this._y = Math.atan2(h, i)) : (this._x = Math.atan2(-c, u), this._y = 0);
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
b.DEFAULT_ORDER = "XYZ";
class m {
  constructor(t = 0, e = 0, n = 0, s = 0, i = 0, r = 0, h = 0, f = 0, o = "") {
    this.x = t, this.y = e, this.z = n, this.yaw = s, this.pitch = i, this.roll = r, this.volume = h, this.gone = f !== 0, this.uuid = o;
  }
  static fromWebGLCoordinates(t, e, n, s, i, r) {
    let h = new b(s, i, r);
    h.reorder("YXZ");
    let f = t / 2 + 0.5, o = -(n / 2) + 0.5, c = e / 2 + 0.5;
    return new m(
      f,
      o,
      c,
      $(h.y),
      $(h.x),
      $(h.z)
    );
  }
  static fromDataBuffer(t) {
    const e = new DataView(t), n = ("0000000000000000" + e.getBigUint64(0, !1).toString(16)).slice(-16), s = ("0000000000000000" + e.getBigUint64(8, !1).toString(16)).slice(-16), i = `${n.slice(0, 8)}-${n.slice(8, 12)}-${n.slice(12, 16)}-${s.slice(0, 4)}-${s.slice(4, 16)}`;
    return new m(
      e.getFloat32(16, !0),
      e.getFloat32(20, !0),
      e.getFloat32(24, !0),
      e.getFloat32(28, !0),
      e.getFloat32(32, !0),
      e.getFloat32(36, !0),
      e.getFloat32(40, !0),
      e.getInt32(44, !0),
      i
    );
  }
  static fromBlobAsWeb(t, e) {
    var n, s = new FileReader();
    s.onload = function(i) {
      n = i.target.result;
      const r = new DataView(n), h = ("0000000000000000" + r.getBigUint64(0, !1).toString(16)).slice(-16), f = ("0000000000000000" + r.getBigUint64(8, !1).toString(16)).slice(-16), o = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${f.slice(0, 4)}-${f.slice(4, 16)}`, c = new m(
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
    let t = new b(
      v(this.pitch),
      v(this.yaw),
      v(this.roll),
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
}
function $(a) {
  return a / Math.PI * 180;
}
function v(a) {
  return a / 180 * Math.PI;
}
let x, y, g, E, S, B, p, F;
function j(a) {
  E = a;
}
function V(a) {
  S = a;
}
function P(a) {
  B = a;
}
function H(a) {
  p = a;
}
function K(a, t) {
  if (g !== void 0 && g.readyState === "open") {
    let e = m.fromWebGLCoordinates(
      a.x,
      a.y,
      a.z,
      t.x,
      t.y,
      t.z
    );
    g.send(e.toDataBuffer());
  }
}
function q(a) {
  if (g !== void 0 && g.readyState === "open") {
    let t = new m(
      a.x,
      a.y,
      a.z,
      a.yaw,
      a.pitch,
      a.roll
    );
    g.send(t.toDataBuffer());
  }
}
function tt() {
  console.log("disconnecting"), F !== void 0 && F.forEach((a) => {
    a.stop();
  }), y.close(), x.close();
}
function et(a, t, e, n, s, i = {}, r = "https://panaudia.com/entrance") {
  let h = m.fromWebGLCoordinates(
    n.x,
    n.y,
    n.z,
    s.x,
    s.y,
    s.z
  );
  W(a, t, e, h, i, r);
}
function st(a, t, e, n, s = {}, i = "http://localhost:8080/join") {
  let r = m.fromWebGLCoordinates(
    e.x,
    e.y,
    e.z,
    n.x,
    n.y,
    n.z
  );
  nt(ticket, a, t, r, s);
}
function nt(a, t, e, n = {}, s = "http://localhost:8080/join") {
  let i = {
    x: e.x,
    y: e.y,
    z: e.z,
    yaw: e.yaw,
    pitch: e.pitch,
    roll: e.roll
  };
  a === !0 && (i.data = "true");
  const r = new URLSearchParams({ ...n, ...i }), h = s + "?" + r.toString();
  N(h, t);
}
function W(a, t, e, n, s = {}, i = "https://panaudia.com/entrance") {
  let r = {
    x: n.x,
    y: n.y,
    z: n.z,
    yaw: n.yaw,
    pitch: n.pitch,
    roll: n.roll
  };
  t === !0 && (r.data = "true"), fetch(i + "?ticket=" + a).then((h) => {
    if (h.ok)
      return h.json();
  }).then((h) => {
    if (h.status === "ok") {
      const f = new URLSearchParams({
        ticket: a,
        ...s,
        ...r
      }), o = h.url + "?" + f.toString();
      N(o, e);
    } else
      console.error("lookup failed");
  }).catch((h) => console.error("lookup error:", h));
}
async function N(a, t) {
  y = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun.l.google.com:5349" },
      { urls: "stun:stun1.l.google.com:3478" }
    ]
  }), y.onicecandidate = (n) => {
    if (n.candidate && n.candidate.candidate !== "") {
      let s = JSON.stringify(n.candidate);
      x.send(JSON.stringify({ event: "candidate", data: s }));
    }
  }, y.ontrack = function(n) {
    p("connected", "Connected");
    let s = document.createElement(n.track.kind);
    s.srcObject = n.streams[0], s.autoplay = !0, s.controls = !0, s.id = "panaudia-player", document.getElementById(t).prepend(s), n.track.onmute = function(i) {
      s.play();
    }, n.streams[0].onremovetrack = ({ track: i }) => {
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
  F = e.getAudioTracks(), F.forEach((n) => {
    y.addTrack(n, e);
  }), at(y), it(a);
}
function at(a) {
  a.ondatachannel = (t) => {
    let e = t.channel;
    E !== void 0 && e.label === "attributes" && (e.onmessage = (n) => {
      let s = X.fromJson(n.data);
      if (!s)
        return w("failed to parse attributes");
      E(s);
    }), e.label === "state" && (g = e, e.onopen = () => {
      p("data_connected", "Data channel connected");
    }, e.onmessage = (n) => {
      if (n.data instanceof ArrayBuffer) {
        let s = m.fromDataBuffer(n.data);
        S !== void 0 && S(s.asWebGLCoordinates()), B !== void 0 && B(s);
      } else
        m.fromBlobAsWeb(n.data, S);
    });
  };
}
function it(a) {
  p("connecting", "Connecting"), x = new WebSocket(a), x.onclose = function(t) {
    p("disconnected", "Disconnected");
  }, x.onmessage = function(t) {
    let e = JSON.parse(t.data);
    if (!e)
      return w("failed to parse msg");
    switch (e.event) {
      case "offer":
        let n = JSON.parse(e.data);
        if (!n)
          return w("failed to parse offer");
        try {
          rt(n);
        } catch (r) {
          alert(r);
        }
        return;
      case "candidate":
        let s = JSON.parse(e.data);
        if (!s)
          return w("failed to parse candidate");
        y.addIceCandidate(s);
        return;
      case "error":
        let i = JSON.parse(e.data);
        if (!i)
          return w("failed to parse error message");
        console.log("errorMsg", i), p("error", i.message);
        return;
    }
  }, x.onerror = function(t) {
    w("ERROR: " + t);
  };
}
async function rt(a) {
  await y.setRemoteDescription(a);
  let t = await y.createAnswer();
  t.sdp = t.sdp.replace("a=fmtp:111 ", "a=fmtp:111 stereo=1; sprop-stereo=1; "), await y.setLocalDescription(t);
  let e = JSON.stringify(t);
  x.send(JSON.stringify({ event: "answer", data: e }));
}
const w = (a) => {
  console.log(a);
};
function ot(a) {
  j(a);
}
function ct(a) {
  V(a);
}
function ht(a) {
  P(a);
}
function lt(a) {
  H(a);
}
function ut(a, t) {
  K(a, t);
}
function _t(a) {
  q(a);
}
function dt() {
  tt();
}
function ft(a, t, e, n, s, i = {}, r = "https://panaudia.com/gateway") {
  et(a, t, e, n, s, i, r);
}
function yt(a, t, e, n, s = {}, i = "http://localhost:8080/join") {
  st(a, t, e, n, s, i);
}
function mt(a, t, e, n, s = {}, i = "https://panaudia.com/gateway") {
  W(a, t, e, n, s, i);
}
export {
  ft as connect,
  mt as connectAmbisonic,
  yt as connectDirect,
  dt as disconnect,
  ut as move,
  _t as moveAmbisonic,
  ht as setAmbisonicStateCallback,
  ot as setAttributesCallback,
  lt as setConnectionStatusCallback,
  ct as setStateCallback
};
//# sourceMappingURL=panaudia-sdk.js.map
