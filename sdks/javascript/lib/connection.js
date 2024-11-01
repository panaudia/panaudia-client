import { PanaudiaNodeAttributes } from './attributes.js';
import { PanaudiaNodeState } from './state.js';

let ws;
let pc;
let dcJson;
let dcData;
let attributesCallback;
let stateCallback;
let ambisonicStateCallback;
let connectionStatusCallback;

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
    ws.close();
}

function connect(
    ticket,
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

    connectAmbisonic(ticket, domParentId, nodeState, attrs, url);
}



function connectAmbisonic(
    ticket,
    domParentId,
    coordinates,
    attrs = {},
    url = 'https://panaudia.com/entrance',
) {

    let locationAttrs = {
        "loc[x]": coordinates.x,
        "loc[y]": coordinates.y,
        "loc[z]": coordinates.z,
        "loc[yaw]": coordinates.yaw,
        "loc[pitch]": coordinates.pitch,
        "loc[roll]": coordinates.roll,
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
                    ...locationAttrs
                });
                const connectionUrl = data.url + '?' + params.toString();
                connectToSpace(connectionUrl, domParentId);
            } else {
                console.error('lookup failed');
            }
        })
        .catch((error) => console.error('lookup error:', error));
}



function connectToSpace(connectionUrl, domPlayerParentId) {
    connectionStatusCallback('connecting', 'Connecting');

    navigator.mediaDevices
        .getUserMedia({
            audio: {
                autoGainControl: false,
                channelCount: 2,
                echoCancellation: false,
                latency: 0,
                noiseSuppression: false,
                sampleRate: 48000,
                sampleSize: 16,
                volume: 1.0,
            },
        })
        .then((stream) => {
            pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun.l.google.com:5349' },
                    { urls: 'stun:stun1.l.google.com:3478' },
                    { urls: 'stun:stun1.l.google.com:5349' },
                ],
            });

            stream.getTracks().forEach((track) => pc.addTrack(track, stream));

            addDataChannels(pc);

            // force the offer to include actual stereo
            pc.createOffer().then((d) => {
                d.sdp = d.sdp.replace('a=fmtp:111 ', 'a=fmtp:111 stereo=1; ');
                d.sdp = d.sdp.replace('stereo=1;', 'stereo=1; sprop-stereo=1;');

                pc.setLocalDescription(d).then((r) => {
                    init_ws(connectionUrl);
                });
            });

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

                event.streams[0].onremovetrack = ({ track }) => {
                    if (el.parentNode) {
                        el.parentNode.removeChild(el);
                    }
                };
            };
        })
        .catch(window.alert);
}

function addDataChannels(pc) {
    dcJson = pc.createDataChannel('attributes');
    dcJson.onmessage = (msg) => {
        let attributes = PanaudiaNodeAttributes.fromJson(msg.data);
        if (!attributes) {
            return log('failed to parse attributes');
        }
        attributesCallback(attributes);
    };

    let _dcData = pc.createDataChannel('state');
    _dcData.onopen = () => {
        dcData = _dcData;
        connectionStatusCallback('data_connected', 'Data channel connected');
    };
    _dcData.onmessage = (msg) => {
        if (msg.data instanceof ArrayBuffer) {
            let state = PanaudiaNodeState.fromDataBuffer(msg.data);
            if (stateCallback !== undefined){
                stateCallback(state.asWebGLCoordinates());
            }
            if (ambisonicStateCallback !== undefined){
                ambisonicStateCallback(state);
            }
        } else {
            PanaudiaNodeState.fromBlobAsWeb(msg.data, stateCallback);
        }
    };
}

function init_ws(url) {
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
            case 'answer':
                let answer = JSON.parse(msg.data);
                if (!answer) {
                    return log('failed to parse answer');
                }
                try {
                    console.log(answer);
                    pc.setRemoteDescription(answer);
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

    ws.onopen = function (evt) {
        let data = JSON.stringify(pc.localDescription);
        ws.send(JSON.stringify({ event: 'offer', data: data }));

        pc.onicecandidate = (e) => {
            if (e.candidate && e.candidate.candidate !== '') {
                let data = JSON.stringify(e.candidate);
                ws.send(JSON.stringify({ event: 'candidate', data: data }));
            }
        };
    };
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
    connectAmbisonic as _connectAmbisonic,
};
