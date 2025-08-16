import {PanaudiaNodeAttributes} from './attributes.js';
import {PanaudiaNodeState} from './state.js';

let ws;
let pc;
let dcData;
let attributesCallback;
let stateCallback;
let ambisonicStateCallback;
let connectionStatusCallback;
let micTracks;

function setAttributesCallback(cb) {
    attributesCallback = cb;
}

function setStateCallback(cb) {
    stateCallback = cb;
}

function setAmbisonicStateCallback(cb) {
    ambisonicStateCallback = cb;
}

function setConnectionStatusCallback(cb) {
    connectionStatusCallback = cb;
}

function move(position, rotation) {
    if (dcData !== undefined) {
        if (dcData.readyState === 'open') {
            let sourceState = PanaudiaNodeState.fromWebGLCoordinates(
                position.x,
                position.y,
                position.z,
                rotation.x,
                rotation.y,
                rotation.z,
            );
            dcData.send(sourceState.toDataBuffer());
        }
    }
}

function moveAmbisonic(coordinates) {
    if (dcData !== undefined) {
        if (dcData.readyState === 'open') {
            let sourceState = new PanaudiaNodeState(
                coordinates.x,
                coordinates.y,
                coordinates.z,
                coordinates.yaw,
                coordinates.pitch,
                coordinates.roll
            );
            dcData.send(sourceState.toDataBuffer());
        }
    }
}

function disconnect() {
    console.log("disconnecting");
    if (micTracks !== undefined){
        micTracks.forEach((track) => {
        track.stop();
    });
    }
    pc.close();
    ws.close();
}

function connect(
    ticket,
    data,
    domParentId,
    position,
    rotation,
    attrs = {},
    url = 'https://panaudia.com/entrance',
) {

    let nodeState = PanaudiaNodeState.fromWebGLCoordinates(
        position.x,
        position.y,
        position.z,
        rotation.x,
        rotation.y,
        rotation.z,
    );
    connectAmbisonic(ticket, data, domParentId, nodeState, attrs, url);
}


function connectDirect(
    data,
    domParentId,
    position,
    rotation,
    attrs = {},
    url = 'http://localhost:8080/join',
) {

    let nodeState = PanaudiaNodeState.fromWebGLCoordinates(
        position.x,
        position.y,
        position.z,
        rotation.x,
        rotation.y,
        rotation.z,
    );

    connectAmbisonicDirect(data, domParentId, nodeState, attrs, url);
}

function connectAmbisonicDirect(
    data,
    domParentId,
    coordinates,
    attrs = {},
    url = 'http://localhost:8080/join',
) {

    let extraAttrs = {
        "x": coordinates.x,
        "y": coordinates.y,
        "z": coordinates.z,
        "yaw": coordinates.yaw,
        "pitch": coordinates.pitch,
        "roll": coordinates.roll,
    }

    if (data === true) {
        extraAttrs["data"] = "true";
    }

    const params = new URLSearchParams({...attrs, ...extraAttrs});
    const directUrl = url + '?' + params.toString();
    connectToSpace(directUrl, domParentId);
}

function connectAmbisonic(
    ticket,
    data,
    domParentId,
    coordinates,
    attrs = {},
    url = 'https://panaudia.com/entrance',
) {

    let extraAttrs = {
        "x": coordinates.x,
        "y": coordinates.y,
        "z": coordinates.z,
        "yaw": coordinates.yaw,
        "pitch": coordinates.pitch,
        "roll": coordinates.roll,
    }

    if (data === true) {
        extraAttrs["data"] = "true";
    }

    fetch(url + '?ticket=' + ticket)
        .then((response) => {
            if (response.ok) {
                return response.json();
            }
        })
        .then((data) => {
            if (data.status === 'ok') {
                const params = new URLSearchParams({
                    ticket: ticket,
                    ...attrs,
                    ...extraAttrs
                });
                const url = data.url + '?' + params.toString();
                connectToSpace(url, domParentId);
            } else {
                console.error('lookup failed');
            }
        })
        .catch((error) => console.error('lookup error:', error));
}

async function connectToSpace(url, domPlayerParentId) {

    pc = new RTCPeerConnection({
            iceServers: [
                {urls: 'stun:stun.l.google.com:19302'},
                {urls: 'stun:stun.l.google.com:5349'},
                {urls: 'stun:stun1.l.google.com:3478'},
            ],
        });

    pc.onicecandidate = (e) => {
        if (e.candidate && e.candidate.candidate !== '') {
            let data = JSON.stringify(e.candidate);
            ws.send(JSON.stringify({event: 'candidate', data: data}));
        }
    };

    pc.ontrack = function (event) {
        connectionStatusCallback('connected', 'Connected');

        let el = document.createElement(event.track.kind);
        el.srcObject = event.streams[0];
        el.autoplay = true;
        el.controls = true;
        el.id = 'panaudia-player';

        document.getElementById(domPlayerParentId).prepend(el);

        event.track.onmute = function (event) {
            el.play();
        };

        event.streams[0].onremovetrack = ({track}) => {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        };
    };

    const stream = await navigator.mediaDevices.getUserMedia(
        {
            audio: {
                autoGainControl: true,
                echoCancellation: true,
                latency: 0,
                noiseSuppression: true,
                sampleRate: 48000,
                sampleSize: 16,
            },
        });

    micTracks = stream.getAudioTracks();

    micTracks.forEach((track) => {
        pc.addTrack(track, stream);
    });

    addDataChannels(pc);
    init_ws(url);
}

function addDataChannels(pc) {

    pc.ondatachannel = (ev) => {

        let receiveChannel = ev.channel;

        if (attributesCallback !== undefined && receiveChannel.label === "attributes") {
            receiveChannel.onmessage = (msg) => {
                let attributes = PanaudiaNodeAttributes.fromJson(msg.data);
                if (!attributes) {
                    return log('failed to parse attributes');
                }
                attributesCallback(attributes);
            };
        }

        if (receiveChannel.label === "state") {
            dcData = receiveChannel;
            receiveChannel.onopen = () => {
                connectionStatusCallback('data_connected', 'Data channel connected');
            };
            receiveChannel.onmessage = (msg) => {
                if (msg.data instanceof ArrayBuffer) {
                    let state = PanaudiaNodeState.fromDataBuffer(msg.data);
                    if (stateCallback !== undefined) {
                        stateCallback(state.asWebGLCoordinates());
                    }
                    if (ambisonicStateCallback !== undefined) {
                        ambisonicStateCallback(state);
                    }
                } else {
                    PanaudiaNodeState.fromBlobAsWeb(msg.data, stateCallback);
                }
            };
        }
    };
}

function init_ws(url) {
    connectionStatusCallback('connecting', 'Connecting');
    ws = new WebSocket(url);

    ws.onclose = function (evt) {
        connectionStatusCallback('disconnected', 'Disconnected');
    };

    ws.onmessage = function (evt) {
        let msg = JSON.parse(evt.data);
        if (!msg) {
            return log('failed to parse msg');
        }

        switch (msg.event) {
            case 'offer':

                let offer = JSON.parse(msg.data);
                if (!offer) {
                    return log('failed to parse offer');
                }
                try {
                    setDescriptions(offer);
                } catch (e) {
                    alert(e);
                }
                return;

            case 'candidate':
                let candidate = JSON.parse(msg.data);
                if (!candidate) {
                    return log('failed to parse candidate');
                }
                pc.addIceCandidate(candidate);
                return;

            case 'error':
                let errorMsg = JSON.parse(msg.data);
                if (!errorMsg) {
                    return log('failed to parse error message');
                }
                console.log('errorMsg', errorMsg);
                connectionStatusCallback('error', errorMsg.message);
                return;
        }
    };

    ws.onerror = function (evt) {
        log('ERROR: ' + evt);
    };
}

async function setDescriptions(offer) {
    // console.log("Recieved offer: ", offer.sdp);
    await pc.setRemoteDescription(offer);
    let answer = await pc.createAnswer();
    answer.sdp = answer.sdp.replace('a=fmtp:111 ', 'a=fmtp:111 stereo=1; sprop-stereo=1; ');
    await pc.setLocalDescription(answer);
    let data = JSON.stringify(answer);
    // console.log("Sending answer: ", answer.sdp);
    ws.send(JSON.stringify({event: 'answer', data: data}));
}

const log = (msg) => {
    console.log(msg);
};

export {
    setAttributesCallback as _setAttributesCallback,
    setStateCallback as _setStateCallback,
    setAmbisonicStateCallback as _setAmbisonicStateCallback,
    setConnectionStatusCallback as _setConnectionStatusCallback,
    move as _move,
    moveAmbisonic as _moveAmbisonic,
    disconnect as _disconnect,
    connect as _connect,
    connectDirect as _connectDirect,
    connectAmbisonic as _connectAmbisonic,
};
