import * as THREE from 'three';
import {connect} from 'panaudia';
import {setPlayerId} from "world";

let skins = {};

window.connectToSquareGateway = (playerId, url, ticket, inner_colour, outer_colour) => {
    setPlayerId(playerId, parseInt(inner_colour, 16), parseInt(outer_colour, 16));

    const attrs = {
        "outer_colour": outer_colour,
        "inner_colour": inner_colour
    };

    connect(ticket, true, "side", {x:0, y:0, z:0}, {x:0, y:0, z:0}, attrs, url);
}

function skinTexture(team){
    const existing = skins[team];
    if (existing !== undefined){
        return existing;
    } else {
        const texture = new THREE.TextureLoader().load( "/static/images/mask.png" );
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.colorSpace = THREE.SRGBColorSpace;// or THREE.LinearSRGBColorSpace.
        texture.repeat.set( 1, 1);
        skins[name] = texture;
        return texture;
    }
}

export function makeNode(attributes) {

    // console.log(attributes)
    const geometry = new THREE.SphereGeometry(50, 32, 16);
    //const material = new THREE.MeshBasicMaterial( { color: 0xbbbbbb } );

    var inner_colour;
    var outer_colour;

    const user_attrs = attributes["connection"];
    console.log(attributes)
    if (user_attrs !== undefined) {
        inner_colour = parseInt(user_attrs["inner_colour"], 16);
        outer_colour = parseInt(user_attrs["outer_colour"], 16);
    } else {
        inner_colour = 0x2f56ee;
        outer_colour = 0x00bbff;
    }

    const skin = skinTexture("mask");


    // const material = new THREE.MeshStandardMaterial({color: 0xaabbff, transparent: true, opacity:0.2});
    const material = new THREE.MeshStandardMaterial({color: outer_colour, transparent: true, opacity:0.4, map: skin, side:THREE.DoubleSide});
    const sphere = new THREE.Mesh(geometry, material);

    const geometry2 = new THREE.SphereGeometry(45, 32, 16);
    const material2 = new THREE.MeshStandardMaterial({color: inner_colour, transparent: true, opacity:0.2});
    const sphere2 = new THREE.Mesh(geometry2, material2);
    sphere2.renderOrder=-1

    sphere.castShadow = false;
    // sphere.receiveShadow = true;
    // sphere.position.x = 1000;
    sphere.position.y = 15;
    sphere.rotation.y = Math.PI/2;
    sphere2.position.y = 15;
    // sphere.position.z = 0;

    const group = new THREE.Group();
    group.add(sphere)
    group.add(sphere2)

	return [group, material2]
}

export function adjustPosition(position){
    position.x = getRandomInt(-100, 100);
    position.z = getRandomInt(-100, 100);
    return false;
}

function getRandomInt(min, max) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled); // The maximum is exclusive and the minimum is inclusive
}


export function addMapCamera(scene, cube_cm, camera){
    const mapCamera = new THREE.OrthographicCamera(
        -(cube_cm / 2),		// Left
        (cube_cm / 2) + 1,		// Right
        (cube_cm / 2) + 1,		// Top
        -(cube_cm / 2),	// Bottom
        -5000,            			// Near
        1000);           			// Far

    mapCamera.up = new THREE.Vector3(0, 0, -1);
    mapCamera.lookAt(new THREE.Vector3(0, -1, 0));
    scene.add(mapCamera);
    return mapCamera
}

export function animateMapCamera(camera, mapCamera){

}

// export function addMapCamera(scene, cube_cm, camera){
//     const mapCamera = new THREE.OrthographicCamera(
//         -(cube_cm / 8),		// Left
//         (cube_cm / 8) + 1,		// Right
//         (cube_cm / 8) + 1,		// Top
//         -(cube_cm / 8),	// Bottom
//         -5000,            			// Near
//         10000);           			// Far
//
//     // mapCamera.up = new THREE.Vector3(0, 0, -1);
//     mapCamera.lookAt(new THREE.Vector3(0, -1, 0));
//
//     scene.add(mapCamera);
//     return mapCamera
// }
//
// export function animateMapCamera(camera, mapCamera){
//     mapCamera.position.x = camera.position.x;
//     mapCamera.position.z = camera.position.z;
//     let a = camera.rotation.clone ();
//     a.reorder("YXZ");
//     a.x = - Math.PI / 2;
//     a.z = 0
//     a.reorder("YXZ");
//     mapCamera.setRotationFromEuler(a);
//
// }

export function clipMapCamera(renderer, mini_border, w, h, size){

        var border = 20.0;
        renderer.setScissor(w - size - border, h - size - border, size, size)
        renderer.setViewport( w - size - border, h - size - border, size, size );
}


export function addLandscape(scene){

}



export function addLights(scene, background) {
    scene.add(new THREE.AmbientLight(background, 3));
    // const light = new THREE.SpotLight(0xffffff, 4.5);
    // light.position.set(0, 2200, 0);
    // light.angle = Math.PI * 0.3;
    // light.decay = 0;
    // light.castShadow = true;
    // light.shadow.camera.near = 200;
    // light.shadow.camera.far = 2600;
    // light.shadow.bias = -0.000222;
    // light.shadow.mapSize.width = 2048;
    // light.shadow.mapSize.height = 2048;
    // scene.add(light);

    // const helper = new THREE.CameraHelper( light.shadow.camera );
    // scene.add( helper );
}



export function adjustCamera(camera){

}

export const defaultMapSize = 260;
export const backgroundColour = 0xf4f4f4;
export const cubeSize = 80;

export const doShadows = true;
export const doFog = true;

export const showMinorGrid = false;
export const floorShadow = false;
export const football = false;


export const cursorSize = 80;

export const distance = 4000;
export const fogDistance = 3500;
export const fatGridLines = 0.8;
export const thinGridLines = 0.5;


