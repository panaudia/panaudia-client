import {init_3d, animate_3d} from 'world';
import {connect, disconnect} from 'panaudia';
import * as elements from 'elements';

init_3d(elements);
animate_3d();

window.connectToGateway = () => {
    // connect('ws://localhost:8080/websocket?uuid=' + nodeId, "side");
    // connect('ws://mac.lark.audio:8080/join?uuid=' + nodeId, "side");
}

window.disconnectFromGateway = () => {
    disconnect();
}
