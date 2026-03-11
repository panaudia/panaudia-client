var ConnectionState = /* @__PURE__ */ ((ConnectionState2) => {
  ConnectionState2["DISCONNECTED"] = "disconnected";
  ConnectionState2["CONNECTING"] = "connecting";
  ConnectionState2["CONNECTED"] = "connected";
  ConnectionState2["AUTHENTICATED"] = "authenticated";
  ConnectionState2["ERROR"] = "error";
  return ConnectionState2;
})(ConnectionState || {});
const ENTITY_INFO3_SIZE = 48;
function uuidToBytes(uuid) {
  const hex = uuid.replace(/-/g, "");
  if (hex.length !== 32) {
    throw new Error(`Invalid UUID: expected 32 hex chars, got ${hex.length}`);
  }
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    const hexByte = hex.substring(i * 2, i * 2 + 2);
    const value = parseInt(hexByte, 16);
    if (isNaN(value)) {
      throw new Error(`Invalid UUID: invalid hex at position ${i * 2}`);
    }
    bytes[i] = value;
  }
  return bytes;
}
function bytesToUuid(bytes) {
  if (bytes.length !== 16) {
    throw new Error(`Invalid UUID bytes: expected 16 bytes, got ${bytes.length}`);
  }
  const hex = [];
  for (let i = 0; i < 16; i++) {
    hex.push(bytes[i].toString(16).padStart(2, "0"));
  }
  return hex.slice(0, 4).join("") + "-" + hex.slice(4, 6).join("") + "-" + hex.slice(6, 8).join("") + "-" + hex.slice(8, 10).join("") + "-" + hex.slice(10, 16).join("");
}
function entityInfo3ToBytes(info) {
  const buffer = new ArrayBuffer(ENTITY_INFO3_SIZE);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const uuidBytes = uuidToBytes(info.uuid);
  bytes.set(uuidBytes, 0);
  view.setFloat32(16, info.position.x, true);
  view.setFloat32(20, info.position.y, true);
  view.setFloat32(24, info.position.z, true);
  view.setFloat32(28, info.rotation.yaw, true);
  view.setFloat32(32, info.rotation.pitch, true);
  view.setFloat32(36, info.rotation.roll, true);
  view.setFloat32(40, info.volume, true);
  view.setInt32(44, info.gone ? 1 : 0, true);
  return bytes;
}
function entityInfo3FromBytes(bytes) {
  if (bytes.length !== ENTITY_INFO3_SIZE) {
    throw new Error(`Invalid EntityInfo3 bytes: expected ${ENTITY_INFO3_SIZE} bytes, got ${bytes.length}`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const uuidBytes = bytes.slice(0, 16);
  const uuid = bytesToUuid(uuidBytes);
  const position = {
    x: view.getFloat32(16, true),
    y: view.getFloat32(20, true),
    z: view.getFloat32(24, true)
  };
  const rotation = {
    yaw: view.getFloat32(28, true),
    pitch: view.getFloat32(32, true),
    roll: view.getFloat32(36, true)
  };
  const volume = view.getFloat32(40, true);
  const gone = view.getInt32(44, true) !== 0;
  return {
    uuid,
    position,
    rotation,
    volume,
    gone
  };
}
function createEntityInfo3(entityId, position, rotation, volume) {
  return {
    uuid: entityId,
    position: {
      x: (position == null ? void 0 : position.x) ?? 0.5,
      y: (position == null ? void 0 : position.y) ?? 0.5,
      z: (position == null ? void 0 : position.z) ?? 0.5
    },
    rotation: {
      yaw: (rotation == null ? void 0 : rotation.yaw) ?? 0,
      pitch: (rotation == null ? void 0 : rotation.pitch) ?? 0,
      roll: (rotation == null ? void 0 : rotation.roll) ?? 0
    },
    volume: volume ?? 1,
    gone: false
  };
}
function isValidUuid(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
export {
  ConnectionState as C,
  ENTITY_INFO3_SIZE as E,
  entityInfo3ToBytes as a,
  bytesToUuid as b,
  createEntityInfo3 as c,
  entityInfo3FromBytes as e,
  isValidUuid as i,
  uuidToBytes as u
};
//# sourceMappingURL=encoding.js.map
