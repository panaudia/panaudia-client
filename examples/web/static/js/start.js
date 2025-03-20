import {init_3d, animate_3d} from 'world';
import {connect, disconnect} from 'panaudia';
import * as elements from 'elements';

init_3d(elements);
animate_3d();


window.disconnectFromGateway = () => {
    disconnect();
}
