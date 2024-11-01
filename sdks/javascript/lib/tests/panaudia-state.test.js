import { assert, test } from 'vitest';
import { PanaudiaNodeState } from '../state.js';

test('WebGL to PanaudiaNodeState coordinates', () => {
    let xp = 1.0;
    let yp = 1.0;
    let zp = 1.0;
    let xr = Math.PI / 4;
    let yr = 0;
    let zr = 0;

    let panaudiaNodeState = PanaudiaNodeState.fromWebGLCoordinates(
        xp,
        yp,
        zp,
        xr,
        yr,
        zr,
    );

    let delta = 0.000001;
    assert.closeTo(panaudiaNodeState.x, 0, delta);
    assert.closeTo(panaudiaNodeState.y, 0, delta);
    assert.closeTo(panaudiaNodeState.z, 1, delta);
    assert.closeTo(panaudiaNodeState.yaw, 0, delta);
    assert.closeTo(panaudiaNodeState.pitch, 45, delta);
    assert.closeTo(panaudiaNodeState.roll, 0, delta);
});

test('WebGL to PanaudiaNodeState coordinates 2', () => {
    let xp = 1.0;
    let yp = 1.0;
    let zp = 1.0;
    let xr = 0;
    let yr = Math.PI / 4;
    let zr = 0;

    let panaudiaNodeState = PanaudiaNodeState.fromWebGLCoordinates(
        xp,
        yp,
        zp,
        xr,
        yr,
        zr,
    );

    let delta = 0.000001;
    assert.closeTo(panaudiaNodeState.x, 0, delta);
    assert.closeTo(panaudiaNodeState.y, 0, delta);
    assert.closeTo(panaudiaNodeState.z, 1, delta);
    assert.closeTo(panaudiaNodeState.yaw, 45, delta);
    assert.closeTo(panaudiaNodeState.pitch, 0, delta);
    assert.closeTo(panaudiaNodeState.roll, 0, delta);
});

test('WebGL to PanaudiaNodeState coordinates 3', () => {
    let xp = 1.0;
    let yp = 1.0;
    let zp = 1.0;
    let xr = 0;
    let yr = 0;
    let zr = Math.PI / 4;

    let panaudiaNodeState = PanaudiaNodeState.fromWebGLCoordinates(
        xp,
        yp,
        zp,
        xr,
        yr,
        zr,
    );

    let delta = 0.000001;
    assert.closeTo(panaudiaNodeState.x, 0, delta);
    assert.closeTo(panaudiaNodeState.y, 0, delta);
    assert.closeTo(panaudiaNodeState.z, 1, delta);
    assert.closeTo(panaudiaNodeState.yaw, 0, delta);
    assert.closeTo(panaudiaNodeState.pitch, 0, delta);
    assert.closeTo(panaudiaNodeState.roll, 45, delta);
});

test('PanaudiaNodeState to WebGL coordinates', () => {
    let x = 1.0;
    let y = 0;
    let z = 1.0;
    let yaw = 0;
    let pitch = 45;
    let roll = 0;
    let panaudiaNodeState = new PanaudiaNodeState(x, y, z, yaw, pitch, roll);

    let webGL = panaudiaNodeState.asWebGLCoordinates();

    let delta = 0.000001;
    assert.closeTo(webGL.position.x, 1, delta);
    assert.closeTo(webGL.position.y, 1, delta);
    assert.closeTo(webGL.position.z, -1, delta);
    assert.closeTo(webGL.rotation.x, Math.PI / 4, delta);
    assert.closeTo(webGL.rotation.y, 0, delta);
    assert.closeTo(webGL.rotation.z, 0, delta);
});

test('PanaudiaNodeState to WebGL coordinates 2', () => {
    let x = 1.0;
    let y = 0;
    let z = 1.0;
    let yaw = 45;
    let pitch = 0;
    let roll = 0;

    let panaudiaNodeState = new PanaudiaNodeState(x, y, z, yaw, pitch, roll);

    let webGL = panaudiaNodeState.asWebGLCoordinates();

    let delta = 0.000001;
    assert.closeTo(webGL.position.x, 1, delta);
    assert.closeTo(webGL.position.y, 1, delta);
    assert.closeTo(webGL.position.z, -1, delta);
    assert.closeTo(webGL.rotation.x, 0, delta);
    assert.closeTo(webGL.rotation.y, Math.PI / 4, delta);
    assert.closeTo(webGL.rotation.z, 0, delta);
});

test('PanaudiaNodeState to WebGL coordinates 3', () => {
    let x = 1.0;
    let y = 0;
    let z = 1.0;
    let yaw = 0;
    let pitch = 0;
    let roll = -45;
    let panaudiaNodeState = new PanaudiaNodeState(x, y, z, yaw, pitch, roll);

    let webGL = panaudiaNodeState.asWebGLCoordinates();

    let delta = 0.000001;
    assert.closeTo(webGL.position.x, 1, delta);
    assert.closeTo(webGL.position.y, 1, delta);
    assert.closeTo(webGL.position.z, -1, delta);
    assert.closeTo(webGL.rotation.x, 0, delta);
    assert.closeTo(webGL.rotation.y, 0, delta);
    assert.closeTo(webGL.rotation.z, -Math.PI / 4, delta);
});

test('PanaudiaNodeState angle round trip', () => {
    let x = 1.0;
    let y = 0;
    let z = 1.0;
    let yaw = 30;
    let pitch = 20;
    let roll = 15;
    let ns1 = new PanaudiaNodeState(x, y, z, yaw, pitch, roll);

    let webGL = ns1.asWebGLCoordinates();

    let ns2 = PanaudiaNodeState.fromWebGLCoordinates(
        webGL.position.x,
        webGL.position.y,
        webGL.position.z,
        webGL.rotation.x,
        webGL.rotation.y,
        webGL.rotation.z,
    );

    let delta = 0.000001;
    assert.closeTo(ns1.yaw, ns2.yaw, delta);
    assert.closeTo(ns1.pitch, ns2.pitch, delta);
    assert.closeTo(ns1.roll, ns2.roll, delta);
});

test('PanaudiaNodeState angle round trip 2', () => {
    let x = 1.0;
    let y = 0;
    let z = 1.0;
    let yaw = -45;
    let pitch = 10;
    let roll = -5;
    let ns1 = new PanaudiaNodeState(x, y, z, yaw, pitch, roll);

    let webGL = ns1.asWebGLCoordinates();

    let ns2 = PanaudiaNodeState.fromWebGLCoordinates(
        webGL.position.x,
        webGL.position.y,
        webGL.position.z,
        webGL.rotation.x,
        webGL.rotation.y,
        webGL.rotation.z,
    );

    let delta = 0.000001;
    assert.closeTo(ns1.yaw, ns2.yaw, delta);
    assert.closeTo(ns1.pitch, ns2.pitch, delta);
    assert.closeTo(ns1.roll, ns2.roll, delta);
});

test('PanaudiaNodeState angle round trip 3', () => {
    let xp = 1.0;
    let yp = 1.0;
    let zp = 1.0;
    let xr = Math.PI / 6;
    let yr = Math.PI / 5;
    let zr = Math.PI / 4;

    let ns = PanaudiaNodeState.fromWebGLCoordinates(xp, yp, zp, xr, yr, zr);

    let webGL = ns.asWebGLCoordinates();

    let delta = 0.000001;
    assert.closeTo(webGL.rotation.x, xr, delta);
    assert.closeTo(webGL.rotation.y, yr, delta);
    assert.closeTo(webGL.rotation.y, yr, delta);
});

test('PanaudiaNodeState from data buffer', () => {
    let data = [
        52, 67, 65, 126, 13, 232, 17, 239, 170, 70, 172, 222, 72, 0, 17, 34,
        116, 152, 19, 63, 232, 253, 243, 62, 150, 74, 98, 62, 179, 218, 138, 65,
        15, 29, 204, 64, 208, 81, 254, 65, 72, 80, 188, 62, 1, 0, 0, 0,
    ];

    let count = data.length;

    const buffer = new ArrayBuffer(count);
    const view = new DataView(buffer);

    let i = 0;

    for (i = 0; i < count; i++) {
        view.setUint8(i, data[i]);
    }

    let panaudiaNodeState = PanaudiaNodeState.fromDataBuffer(buffer);

    let delta = 0.000001;
    assert.closeTo(panaudiaNodeState.x, 0.576545, delta);
    assert.closeTo(panaudiaNodeState.y, 0.47654653, delta);
    assert.closeTo(panaudiaNodeState.z, 0.22098765, delta);
    assert.closeTo(panaudiaNodeState.yaw, 17.356787, delta);
    assert.closeTo(panaudiaNodeState.pitch, 6.378547, delta);
    assert.closeTo(panaudiaNodeState.roll, 31.789948, delta);
    assert.closeTo(panaudiaNodeState.volume, 0.3678, delta);
    assert.equal(panaudiaNodeState.gone, true);
    assert.equal(
        panaudiaNodeState.uuid,
        '3443417e-0de8-11ef-aa46-acde48001122',
    );
});

function arraysAreEqual(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    let i = 0;

    for (i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

test('PanaudiaNodeState to data buffer', () => {
    let data = [
        52, 67, 65, 126, 13, 232, 17, 239, 170, 70, 172, 222, 72, 0, 17, 34,
        116, 152, 19, 63, 232, 253, 243, 62, 150, 74, 98, 62, 179, 218, 138, 65,
        15, 29, 204, 64, 208, 81, 254, 65, 72, 80, 188, 62, 1, 0, 0, 0,
    ];

    let count = data.length;
    const buffer = new ArrayBuffer(count);
    const view = new DataView(buffer);

    let i = 0;

    for (i = 0; i < count; i++) {
        view.setUint8(i, data[i]);
    }

    let panaudiaNodeState = PanaudiaNodeState.fromDataBuffer(buffer);
    let returnBuffer = panaudiaNodeState.toDataBuffer();

    let data2 = [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 116, 152, 19, 63, 232,
        253, 243, 62, 150, 74, 98, 62, 179, 218, 138, 65, 15, 29, 204, 64, 208,
        81, 254, 65, 0, 0, 0, 0, 0, 0, 0, 0,
    ];

    let count2 = data.length;
    const buffer2 = new ArrayBuffer(count2);
    const view2 = new DataView(buffer2);

    let j = 0;

    for (j = 0; j < count; j++) {
        view2.setUint8(j, data2[j]);
    }

    assert.isTrue(arraysAreEqual(returnBuffer, buffer2));
});
