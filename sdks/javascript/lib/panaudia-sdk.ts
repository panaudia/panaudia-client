import {
    _setAttributesCallback,
    _setStateCallback,
    _setAmbisonicStateCallback,
    _setConnectionStatusCallback,
    _move,
    _moveAmbisonic,
    _disconnect,
    _connect,
    _connectAmbisonic,
} from './connection.js'

interface Vec3 {
    x: number
    y: number
    z: number
}

interface AmbisonicCoordinates {
    x: number
    y: number
    z: number
    yaw: number
    pitch: number
    roll: number
}

interface NodeAttributes {
    uuid: string
    name: string
    ticket: { string: any }
    connection: { string: any }
}

interface NodeState {
    uuid: string
    position: Vec3
    rotation: Vec3
    volume: number
    gone: boolean
}
interface AmbisonicNodeState extends AmbisonicCoordinates {
  uuid: string
  volume: number
  gone: boolean
}

interface StateCallback {
    (state: NodeState): void
}

interface AmbisonicStateCallback {
    (state: AmbisonicNodeState): void
}
interface AttributesCallback {
    (attrs: NodeAttributes): void
}

type ConnectionStatus = "connecting" | "connected" | "data_connected" | "disconnected" | "error";

interface ConnectionStatusCallback {
    (status: ConnectionStatus, message: string): void
}

export function setAttributesCallback(cb: AttributesCallback): void {
    _setAttributesCallback(cb)
}

export function setStateCallback(cb: StateCallback): void {
    _setStateCallback(cb)
}

export function setAmbisonicStateCallback(cb: AmbisonicStateCallback): void {
    _setAmbisonicStateCallback(cb)
}

export function setConnectionStatusCallback(cb: ConnectionStatusCallback) {
    _setConnectionStatusCallback(cb)
}

export function move(position: Vec3, rotation: Vec3): void {
    _move(position, rotation)
}

export function moveAmbisonic(coordinates: AmbisonicCoordinates): void {
    _moveAmbisonic(coordinates)
}

export function disconnect(): void {
    _disconnect()
}

export function connect(
    ticket: string,
    domParentId: string,
    position: Vec3,
    rotation: Vec3,
    attrs: { [key: string]: string } = {},
    url: string = 'https://panaudia.com/entrance',
): void {
    _connect(ticket, domParentId, position, rotation, attrs, url)
}

export function connectAmbisonic(
    ticket: string,
    domParentId: string,
    coordinates: AmbisonicCoordinates,
    attrs: { [key: string]: string } = {},
    url: string = 'https://panaudia.com/entrance',
): void {
    _connectAmbisonic(ticket, domParentId, coordinates, attrs, url)
}
