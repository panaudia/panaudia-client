import { Vector3 } from './Vector3.js';

class Matrix4 {
    constructor(
        n11,
        n12,
        n13,
        n14,
        n21,
        n22,
        n23,
        n24,
        n31,
        n32,
        n33,
        n34,
        n41,
        n42,
        n43,
        n44,
    ) {
        Matrix4.prototype.isMatrix4 = true;

        this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

        if (n11 !== undefined) {
            this.set(
                n11,
                n12,
                n13,
                n14,
                n21,
                n22,
                n23,
                n24,
                n31,
                n32,
                n33,
                n34,
                n41,
                n42,
                n43,
                n44,
            );
        }
    }

    makeRotationFromQuaternion(q) {
        return this.compose(_zero, q, _one);
    }

    compose(position, quaternion, scale) {
        const te = this.elements;

        const x = quaternion._x,
            y = quaternion._y,
            z = quaternion._z,
            w = quaternion._w;
        const x2 = x + x,
            y2 = y + y,
            z2 = z + z;
        const xx = x * x2,
            xy = x * y2,
            xz = x * z2;
        const yy = y * y2,
            yz = y * z2,
            zz = z * z2;
        const wx = w * x2,
            wy = w * y2,
            wz = w * z2;

        const sx = scale.x,
            sy = scale.y,
            sz = scale.z;

        te[0] = (1 - (yy + zz)) * sx;
        te[1] = (xy + wz) * sx;
        te[2] = (xz - wy) * sx;
        te[3] = 0;

        te[4] = (xy - wz) * sy;
        te[5] = (1 - (xx + zz)) * sy;
        te[6] = (yz + wx) * sy;
        te[7] = 0;

        te[8] = (xz + wy) * sz;
        te[9] = (yz - wx) * sz;
        te[10] = (1 - (xx + yy)) * sz;
        te[11] = 0;

        te[12] = position.x;
        te[13] = position.y;
        te[14] = position.z;
        te[15] = 1;

        return this;
    }
}

const _v1 = /*@__PURE__*/ new Vector3();
const _m1 = /*@__PURE__*/ new Matrix4();
const _zero = /*@__PURE__*/ new Vector3(0, 0, 0);
const _one = /*@__PURE__*/ new Vector3(1, 1, 1);
const _x = /*@__PURE__*/ new Vector3();
const _y = /*@__PURE__*/ new Vector3();
const _z = /*@__PURE__*/ new Vector3();

export { Matrix4 };
