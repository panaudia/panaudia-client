import { Euler } from './threejs-math/Euler';

export class PanaudiaNodeState {
    constructor(
        x = 0,
        y = 0,
        z = 0,
        yaw = 0,
        pitch = 0,
        roll = 0,
        volume = 0,
        gone = 0,
        uuid = '',
    ) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.yaw = yaw;
        this.pitch = pitch;
        this.roll = roll;
        this.volume = volume;
        this.gone = gone !== 0;
        this.uuid = uuid;
    }


    static fromWebGLCoordinates(px, py, pz, rx, ry, rz) {
        let rotation = new Euler(rx, ry, rz);
        rotation.reorder('YXZ');

        let x = -(pz / 2) + 0.5;
        let y = -(px / 2) + 0.5;
        let z = py / 2 + 0.5;

        // let x = -(pz / 2) + 0.5;
        // let y = -(px / 2) + 0.5;
        // let z = py / 2 + 0.5;

        return new PanaudiaNodeState(
            x,
            y,
            z,
            radiansToDegrees(rotation.y),
            radiansToDegrees(rotation.x),
            radiansToDegrees(rotation.z));
    }


    static fromDataBuffer(buffer) {
        const view = new DataView(buffer);
        const a = (
            '0000000000000000' + view.getBigUint64(0, false).toString(16)
        ).slice(-16);
        const b = (
            '0000000000000000' + view.getBigUint64(8, false).toString(16)
        ).slice(-16);
        const guid = `${a.slice(0, 8)}-${a.slice(8, 12)}-${a.slice(12, 16)}-${b.slice(0, 4)}-${b.slice(4, 16)}`;

        const state = new PanaudiaNodeState(
            view.getFloat32(16, true),
            view.getFloat32(20, true),
            view.getFloat32(24, true),
            view.getFloat32(28, true),
            view.getFloat32(32, true),
            view.getFloat32(36, true),
            view.getFloat32(40, true),
            view.getInt32(44, true),
            guid,
        );

        return state;
    }

    static fromBlobAsWeb(buffer, stateCallback) {
        var arrayBuffer;
        var fileReader = new FileReader();
        fileReader.onload = function (event) {
            arrayBuffer = event.target.result;

            const view = new DataView(arrayBuffer);
            const a = (
                '0000000000000000' + view.getBigUint64(0, false).toString(16)
            ).slice(-16);
            const b = (
                '0000000000000000' + view.getBigUint64(8, false).toString(16)
            ).slice(-16);
            const guid = `${a.slice(0, 8)}-${a.slice(8, 12)}-${a.slice(12, 16)}-${b.slice(0, 4)}-${b.slice(4, 16)}`;

            const state = new PanaudiaNodeState(
                view.getFloat32(16, true),
                view.getFloat32(20, true),
                view.getFloat32(24, true),
                view.getFloat32(28, true),
                view.getFloat32(32, true),
                view.getFloat32(36, true),
                view.getFloat32(40, true),
                view.getInt32(44, true),
                guid,
            );

            stateCallback(state.asWebGLCoordinates());
        };
        fileReader.readAsArrayBuffer(buffer);
    }

    toDataBuffer() {
        const buffer = new ArrayBuffer(48);
        const view = new DataView(buffer);
        view.setFloat32(16, this.x, true);
        view.setFloat32(20, this.y, true);
        view.setFloat32(24, this.z, true);
        view.setFloat32(28, this.yaw, true);
        view.setFloat32(32, this.pitch, true);
        view.setFloat32(36, this.roll, true);
        return buffer;
    }


    asWebGLCoordinates() {
        let rotation = new Euler(
            degreesToRadians(this.pitch),
            degreesToRadians(this.yaw),
            degreesToRadians(this.roll),
            'YXZ',
        );
        rotation.reorder('XYZ');
        return {
            uuid: this.uuid,
            position: {
                // x: (this.x - 0.5) * 2,
                // y: (this.z - 0.5) * 2,
                // z: -((this.y - 0.5) * 2),
                x: -(this.y - 0.5) * 2,
                y: (this.z - 0.5) * 2,
                z: -((this.x - 0.5) * 2),
            },
            rotation: { x: rotation.x, y: rotation.y, z: rotation.z },
            volume: this.volume,
            gone: this.gone,
        };
    }

}

function radiansToDegrees(a) {
    return (a / Math.PI) * 180;
}

function degreesToRadians(a) {
    return (a / 180.0) * Math.PI;
}
