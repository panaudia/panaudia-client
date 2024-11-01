import { Quaternion } from './Quaternion.js';

class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
        Vector3.prototype.isVector3 = true;

        this.x = x;
        this.y = y;
        this.z = z;
    }
}

const _vector = /*@__PURE__*/ new Vector3();
const _quaternion = /*@__PURE__*/ new Quaternion();

export { Vector3 };
