import * as THREE from 'three';

import {PointerLockControls} from 'three/addons/controls/PointerLockControls.js';
import {SwipeControls} from 'three/addons/controls/SwipeControls.js';


import {move as panaudiaMove, setAttributesCallback, setStateCallback, setConnectionStatusCallback, disconnect} from 'panaudia';

setAttributesCallback(updateAttributes);
setConnectionStatusCallback(updateConnectionStatus);
setStateCallback(updateState);

let camera, mapCamera, scene, renderer, controls, helper;
const objects = [];
let nodes = undefined;
let nodesAttributes = {};
let localPlayerId;
let raycaster;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;
let previousRotation = new THREE.Euler();
let previousPosition = new THREE.Vector3();
let cube_size;
let mini_border = 20.0;
let height = 100;
let speed = 2.5;
let background;
let masterVolume = -1;
let cube_cm;
let audioPlayer;
let errorMessage;
let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
var isTouchDevice;
var isConnected;
var miniMapSize;
var clickAdded;
var touchCursorX;
var touchCursorY;

let world_elements;
var suppressResizeCallback;
var cursorColour;



function init(elements) {


    world_elements = elements;
    cube_size = world_elements.cubeSize;
    cube_cm = cube_size * 100;
    background = world_elements.backgroundColour;
    isConnected = false;
    clickAdded = false;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(background);
    //scene.fog = new THREE.Fog( 0xffffff, 0, 750 );

    if (world_elements.doFog){
         scene.fog = new THREE.Fog(background, 0, world_elements.fogDistance);
    }

    if (isTouchDevice){
        camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, elements.distance);
    } else {
        camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, elements.distance);
    }


    camera.position.y = 100;

    scene.add(camera);

    world_elements.adjustCamera(camera);

    mapCamera = elements.addMapCamera(scene, cube_cm, camera)

    world_elements.addLights(scene, background);


    addFloor(world_elements.floorShadow, world_elements.football, world_elements.fatGridLines, world_elements.thinGridLines);

    world_elements.addLandscape(scene, cube_cm, objects);
    

    raycaster = new THREE.Raycaster();
    var rayPos = new THREE.Vector3();

    // Use y = 100 to ensure ray starts above terran
    rayPos.set(0, 100, 0);
    var rayDir = new THREE.Vector3(0, -1, 0); // Ray points down

    // Set ray from pos, pointing down
    raycaster.set(rayPos, rayDir);



    // addSphere("cat", new THREE.Vector3(0, height, -150))

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.prepend(renderer.domElement);
    renderer.shadowMap.enabled = elements.doShadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap



    if (isTouchDevice){
        addTouchControls();
miniMapSize = 150;
    } else {
        addControls();
        miniMapSize = world_elements.defaultMapSize;
    }

    window.addEventListener('resize', onWindowResize);
    // window.addEventListener("deviceorientation", handleOrientation, true);
}

function handleOrientation(){
    checkRotation();
    // console.log("handleOrientation");
}


function moveTouchPad(){

    if(controls.moveUsed){
        const pad = document.getElementById('touch-move');
        pad.style.setProperty("--move-decoration-display", "none");
        if (controls.moveTouchId === undefined){
            pad.style.display = "none";
        } else {
            pad.style.left = (controls.moveX - 40)+'px';
            pad.style.top = (controls.moveY - 40)+'px';
            pad.style.display = "block";
            document.getElementById('touch-arrow-move-up').style.display = moveForward ? "block" : "none";
            document.getElementById('touch-arrow-move-down').style.display = moveBackward ? "block" : "none";
            document.getElementById('touch-arrow-move-left').style.display = moveLeft ? "block" : "none";
            document.getElementById('touch-arrow-move-right').style.display = moveRight ? "block" : "none";
        }
    }
}

function lookTouchPad(){

    if (controls.turnUsed) {
        const pad = document.getElementById('touch-look');
        pad.style.setProperty("--look-decoration-display", "none");
        if (controls.turnTouchId === undefined) {
            pad.style.display = "none";
        } else {
            pad.style.left = (controls.turnX - 40) + 'px';
            pad.style.top = (controls.turnY - 40) + 'px';
            pad.style.display = "block";
            document.getElementById('touch-arrow-look-up').style.display = controls.lookingUp ? "block" : "none";
            document.getElementById('touch-arrow-look-down').style.display = controls.lookingDown ? "block" : "none";
            document.getElementById('touch-arrow-look-left').style.display = controls.lookingLeft ? "block" : "none";
            document.getElementById('touch-arrow-look-right').style.display = controls.lookingRight ? "block" : "none";
        }
    }
}


function addFloor(floorShadow, football, fatGridLines, thinGridLines) {


    if (football){

        const planeGeometry = new THREE.PlaneGeometry(cube_cm * 0.6, cube_cm * 0.4);
        planeGeometry.rotateX(-Math.PI / 2);
        const planeMaterial = new THREE.MeshStandardMaterial({color: 0x0446644});
        //const planeMaterial = new THREE.ShadowMaterial({color: 0xff0000, opacity: 1.0});
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.position.y = -20;
        plane.receiveShadow = floorShadow;
        scene.add(plane);

    } else {
        const planeGeometry = new THREE.PlaneGeometry(cube_cm, cube_cm);
        planeGeometry.rotateX(-Math.PI / 2);
        const planeMaterial = new THREE.ShadowMaterial({color: 0x000000, opacity: 0.4});
        //const planeMaterial = new THREE.ShadowMaterial({color: 0xff0000, opacity: 1.0});
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.position.y = -30;
        plane.receiveShadow = floorShadow;
        objects.push(plane)
        scene.add(plane);

        helper = new THREE.GridHelper(cube_cm, cube_cm/cube_size);
        helper.position.y = -29;
        helper.material.opacity = 0.5;
        helper.material.transparent = true;
        scene.add(helper);

        let helper2 = new THREE.GridHelper(cube_cm, 10);
        helper2.position.y = -29;
        helper2.material.opacity = 0.8;
        helper2.material.transparent = true;
        scene.add(helper2);
    }
}

function addControls() {
    controls = new PointerLockControls(camera, document.body);
    const side = document.getElementById('side');
    //const instructions = document.getElementById('instructions');

    controls.addEventListener('change', function () {
        move();
    });

    controls.addEventListener('lock', function () {

        // side.classList = 'side side-side';
        side.style.display = 'none';

    });

    controls.addEventListener('unlock', function () {
        // disconnect();
        side.style.display = 'block';
        if (!clickAdded){
            clickAdded = true;
            renderer.domElement.addEventListener('click', function () {
                 controls.lock();
            });
        }


    });

    // scene.add(controls.getObject());

    const onKeyDown = function (event) {

        switch (event.code) {

            case 'ArrowUp':
            case 'KeyW':
                moveForward = true;
                break;

            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = true;
                break;

            case 'ArrowDown':
            case 'KeyS':
                moveBackward = true;
                break;

            case 'ArrowRight':
            case 'KeyD':
                moveRight = true;
                break;


            case 'KeyX':
                document.getElementById('instructions').style.display = 'none';
                break;

            case 'Space':
                if (canJump === true) velocity.y += 150;
                canJump = false;
                break;
        }
    };

    const onKeyUp = function (event) {
        switch (event.code) {

            case 'ArrowUp':
            case 'KeyW':
                moveForward = false;
                break;

            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = false;
                break;

            case 'ArrowDown':
            case 'KeyS':
                moveBackward = false;
                break;

            case 'ArrowRight':
            case 'KeyD':
                moveRight = false;
                break;
        }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
}



function addTouchControls() {
    controls = new SwipeControls(camera, renderer.domElement);

    controls.addEventListener('change', function () {
        moveForward = controls.Forward;
        moveBackward = controls.Backward;
        moveLeft = controls.Left;
        moveRight = controls.Right;
    });


}

function addMe(inner_colour, outer_colour) {
    const geometry = new THREE.SphereGeometry(world_elements.cursorSize, 32, 16);
    const material = new THREE.MeshStandardMaterial({color: inner_colour});
    const sphere = new THREE.Mesh(geometry, material);
    sphere.castShadow = false;
    sphere.receiveShadow = false;
    const geometry2 = new THREE.SphereGeometry(world_elements.cursorSize * 2, 32, 16);
    const material2 = new THREE.MeshStandardMaterial({color: outer_colour, transparent: true, opacity:0.4});
    const sphere2 = new THREE.Mesh(geometry2, material2);
    sphere.castShadow = false;
    sphere.receiveShadow = false;

    sphere.position.x = 0;
    sphere.position.y = 0;
    sphere.position.z = 0;
    sphere2.position.x = 0;
    sphere2.position.y = 0;
    sphere2.position.z = 0;
    camera.add(sphere);
    camera.add(sphere2);
}

function updateAttributes(source){
    // console.log("source: ", source);
    nodesAttributes[source.uuid] = source;
}


function updateState(s){

    if (nodes !== undefined) {
        if (s.gone){
            removeSphere(s.uuid);
            // console.log("removing sphere")
        } else {
            if (s.uuid !== localPlayerId){
                ensureSphere(s.uuid,
                    new THREE.Vector3((s.position.x * cube_cm)/2.0, (s.position.y * cube_cm)/2.0, (s.position.z * cube_cm)/2.0),
                    s.volume,
                    new THREE.Euler(s.rotation.x, s.rotation.y, s.rotation.z));
            }
        }
    }
}

function adjustSpawn(){
    while (true) {
        const lookat = world_elements.adjustPosition(controls.getObject().position)
        const intersections = getTerrainIntersections()
        if (intersections.length > 0){
             if (lookat){
                 controls.getObject().lookAt(new THREE.Vector3(0, 0, 0));
             }
            return;
        }
    }
}

function updateConnectionStatus(status, message){

    const connectButton = document.getElementById('connect');
    const disconnectButton = document.getElementById('disconnect');
    const spinner = document.getElementById('spinner');
    const side = document.getElementById('side');
    const info = document.getElementById('info-box');
    const errorDiv = document.getElementById('error-block');
    const errorPara = document.getElementById('error-msg');

    // console.log("status: ", status)
    // console.log("message: ", message)


    switch (status) {

        case 'connected':
            spinner.classList = 'spinner hidden';
            connectButton.classList = 'hidden';
            disconnectButton.classList = '';
            document.body.firstChild.click();
            side.style.display = 'none';
            side.classList = 'side side-side';
            info.style.display = 'none';
            isConnected = true;
            adjustSpawn();
            //

            if (isTouchDevice) {
                controls.activate();
                document.getElementById('touch-move').style.display = 'block';
                document.getElementById('touch-look').style.display = 'block';
                // iOScrollFix();
            } else {
                document.getElementById('instructions').style.display = 'block';
                controls.lock();
            }

            break;

        case 'data_connected':
            audioPlayer = document.getElementById('panaudia-player');
            audioPlayer.volume = 0.0;
            masterVolume = 0;
            nodes = {}
            move(true);
            break;

        case 'connecting':
            errorMessage = undefined;
            spinner.classList = 'spinner';
            connectButton.classList = 'hidden';
            disconnectButton.classList = 'hidden';
            errorDiv.style.display = 'none';

            if (isTouchDevice){

            } else {
                document.getElementById('instructions').style.display = 'block';
            }


            break;

        case 'error':
            // moveForward = true;
            errorMessage = message;

            break;

        case 'disconnected':
            spinner.classList = 'spinner hidden';
            connectButton.classList = '';
            disconnectButton.classList = 'hidden';
            side.style.display = 'block';
            side.classList = 'side';
            isConnected = false;

            if (errorMessage !== undefined){
                errorPara.innerText = errorMessage;
                errorDiv.style.display = 'block';
                info.style.display = 'none';
            } else {
                errorDiv.style.display = 'none';
                info.style.display = 'block';
            }

            removeAllSpheres();
            masterVolume = -1;
            const player = document.getElementById("panaudia-player")
            if (player){
                player.parentNode.removeChild(player);
            }
            break;
    }
}

function ensureSphere(name, position, vol, rotation) {


    if(localPlayerId !== name){
        if (name in nodes){
            moveSphere(name, position, rotation)
            updateVolume(name, vol)
        } else {
            addSphere(name, position)
        }
    } else {
        // console.log(nodesAttributes[name]);
    }
}


function removeSphere(name) {
    if (name in nodes){
        scene.remove(nodes[name].obj);
    }
}

function removeAllSpheres() {

    for (const name in nodes) {
        scene.remove(nodes[name].obj);
    }
    nodes = {}
}

function updateVolume(name, vol){
   // const op = 0.3 + ((vol - 0.0005) * 20);
    var op = ((vol - 0.0005) * 10);
    if (op < 0){op = 0;}
    op = op + 0.2;
    if(nodes[name].fade < 1.0){
        nodes[name].mat.opacity = nodes[name].fade;
    } else {
        nodes[name].mat.opacity = op;
    }
}

function addSphere(name, position) {

    const attributes = nodesAttributes[name];
    if (attributes === undefined){
        return;
    }

    const [node, material] = world_elements.makeNode(attributes);
    material.opacity = 0;

	node.position.x = position.x;
    node.position.y = position.y;
    node.position.z = position.z;

    scene.add(node);
    let target = new THREE.Vector3(position.x, position.y, position.z)

    nodes[name] = { "obj": node,
        "mat": material,
        "fade": 0,
        "steps": 0,
        "step":  new THREE.Vector3(0.0, 0.0, 0.0),
        "target": target,
        "target_rotation": new THREE.Vector3(0.0, 0.0, 0.0)};
}


function limitPosition(position){
    if (position.x < -cube_cm ){position.x = -cube_cm;}
    if (position.x > cube_cm ){position.x =-cube_cm;}
    if (position.z < -cube_cm ){position.z = -cube_cm;}
    if (position.z > cube_cm ){position.z = cube_cm;}
}

function moveSphere(name, position, rotation) {
    nodes[name].target = position;
    nodes[name].target_rotation = rotation;
}

function onWindowResize() {
    suppressResizeCallback = true;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // const body = document.getElementById('body');
}


function animate() {
    requestAnimationFrame(animate);


    const time = performance.now();

    if(isTouchDevice){
        if (controls.isActive() === true) {
            animateControls(time);
            moveTouchPad();
            lookTouchPad();
        }
    } else {
        if (controls.isLocked === true) {
            animateControls(time);
        }
    }


    animateNodes(time);

    if (masterVolume >= 0 && masterVolume < 1){
        masterVolume += 0.02;
        if (masterVolume > 1){
            masterVolume = 1;
        }
        audioPlayer.volume = masterVolume;

    }

    prevTime = time;
    render();
}

function render()
{
	let w = window.innerWidth, h = window.innerHeight;

    renderer.clear();
	renderer.setViewport( 0, 0, w, h );
	renderer.render( scene, camera );


    if(isConnected){
        if (helper !== undefined){
            helper.visible = world_elements.showMinorGrid;
        }

        renderer.clearDepth();
        renderer.setScissorTest(true);

        world_elements.clipMapCamera(renderer, mini_border, w, h, miniMapSize);
        renderer.render( scene, mapCamera );
        renderer.setScissorTest(false);
        if (helper !== undefined){
            helper.visible = true;
        }
        // scene.background = new THREE.Color(background);

    }


}

function animateNodes(time) {

    const delta = time - prevTime;

    for (let name in nodes) {

        let node = nodes[name];

        let dx = node.target.x - node.obj.position.x;
        let absx = Math.abs(dx);
        let dy = node.target.y - node.obj.position.y;
        let absy = Math.abs(dy);
        let dz = node.target.z - node.obj.position.z;
        let absz = Math.abs(dz);

        if (node.fade < 1){
            node.fade += 0.02;
        }

        if ( absx > 0.001 ){
            node.obj.position.x +=  dx/20;
        }

        if ( absy > 0.001 ){
            node.obj.position.y +=  dy/20;
         }

        if ( absz > 0.001 ){
            node.obj.position.z +=  dz/20;
        }

        node.obj.rotation.x = node.target_rotation.x;
        node.obj.rotation.y = node.target_rotation.y;
        node.obj.rotation.z = node.target_rotation.z;

        // console.log(node.obj.rotation);
        // console.log(node.target_rotation);
        
    }
}

function toDegrees(a){
    return (a/Math.PI) * 180;
}

function move(force=false) {

    let dp = 0.01;
    let dr = 0.0001;

    let dpx = Math.abs(camera.position.x - previousPosition.x);
    let dpz = Math.abs(camera.position.z - previousPosition.z);
    let drx = Math.abs(camera.rotation.x - previousRotation.x);
    let dry = Math.abs(camera.rotation.y - previousRotation.y);
    let drz = Math.abs(camera.rotation.z - previousRotation.z);

    if ( dpx > dp || dpz > dp || drx > dr || dry > dr || drz > dr || force){
        let x = (camera.position.x / cube_cm) * 2.0;
        let y = (camera.position.y / cube_cm) * 2.0;
        let z = (camera.position.z / cube_cm) * 2.0;
        let a = camera.rotation.clone ();
        panaudiaMove({x:x, y:y, z:z}, a);
    }
    previousPosition.x = camera.position.x;
    previousPosition.y = camera.position.y;
    previousPosition.z = camera.position.z;
    previousRotation = camera.rotation.clone ();
}

function tooCloseToOthers(){
    const pos = controls.getObject().position.clone();
    for (let name in nodes) {
        let node = nodes[name];
        if (pos.distanceTo(node.obj.position) < 40 ){
            return true;
        }
    }
    return false;
}


function getTerrainIntersections(){
    raycaster.ray.origin.copy(controls.getObject().position);
    return raycaster.intersectObjects(objects, false);
}

function animateControls(time) {

    canJump = false;

    const xbefore = controls.getObject().position.x;
    const zbefore = controls.getObject().position.z;
    const tooClose1 = tooCloseToOthers();

    const intersections = getTerrainIntersections()
    const onObject = intersections.length > 0;
    const delta = (time - prevTime) / 1000;

    if(onObject){
        const ydiff = intersections[0].distance - 100.0;
        if (Math.abs(ydiff) > 2){
            velocity.y -= 9.8 * ydiff * delta * 1.0; // 100.0 = mass

             if (velocity.y < -250){
                 velocity.y = -250;
            }
        } else {
            canJump = true;
            velocity.y = Math.max(0, velocity.y);
        }

    } else {
        velocity.y = 0;
    }

    velocity.x -= velocity.x * speed * delta;
    velocity.z -= velocity.z * speed * delta;
    // velocity.y -= 9.8 * 100.0 * delta; // 100.0 = mass
    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize(); // this ensures consistent movements in all directions

    if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
    if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;

    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);

    controls.getObject().position.y += (velocity.y * delta); // new behavior

    const intersections2 = getTerrainIntersections()
    const onObject2 = intersections2.length > 0;
    const tooClose2 = tooCloseToOthers();

    if (!onObject2 || (!tooClose1 && tooClose2) ){
        controls.getObject().position.setX(xbefore);
        controls.getObject().position.setZ(zbefore);
        velocity.x = 0;
        velocity.z = 0;
    }

    world_elements.animateMapCamera(camera, mapCamera)
    move()

}

isTouchDevice = Boolean(navigator.maxTouchPoints || 'ontouchstart' in document.documentElement);
if (!isTouchDevice) {
    document.getElementById('mobile-turn').remove();
}

export const init_3d = init;
export const animate_3d = animate;
export function setPlayerId(uid, inner_colour, outer_colour){
    localPlayerId = uid;
    addMe(inner_colour, outer_colour);
}

