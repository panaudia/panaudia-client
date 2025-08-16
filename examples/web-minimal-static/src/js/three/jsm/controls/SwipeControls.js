import {
	Euler,
	EventDispatcher,
	Vector3
} from 'three';

const _euler = new Euler( 0, 0, 0, 'YXZ' );
const _vector = new Vector3();

const _changeEvent = { type: 'change' };
const _lockEvent = { type: 'lock' };
const _unlockEvent = { type: 'unlock' };

const _PI_2 = Math.PI / 2;

class SwipeControls extends EventDispatcher {

	constructor( camera, domElement ) {

		super();

		this.camera = camera;
		this.domElement = domElement;

		this.active = false;

		// Set to constrain the pitch of the camera
		// Range is 0 to Math.PI radians
		this.minPolarAngle = 0; // radians
		this.maxPolarAngle = Math.PI; // radians

		this.pointerSpeed = 1.0;

		this._onTouchStart = onTouchStart.bind( this );
		this._onTouchMove = onTouchMove.bind( this );
		this._onTouchEnd = onTouchEnd.bind( this );

		this.turnTouchId = undefined;
		this.moveTouchId = undefined;
		this.turnX = undefined;
		this.moveX = undefined;
		this.turnY = undefined;
		this.moveY = undefined;

		this.Forward = false;
		this.Backward = false;
		this.Left = false;
		this.Right = false;

		this.lookingUp = false;
		this.lookingDown = false;
		this.lookingLeft = false;
		this.lookingRight = false;

		this.turnUsed = false;
		this.moveUsed = false;

		this.connect();
	}

	connect() {
		window.addEventListener( 'touchstart', this._onTouchStart );
		window.addEventListener( 'touchmove', this._onTouchMove );
		window.addEventListener( 'touchend', this._onTouchEnd );
	}

	disconnect() {
	}

	dispose() {

		this.disconnect();

	}

	getObject() { // retaining this method for backward compatibility

		return this.camera;

	}

	getDirection( v ) {

		return v.set( 0, 0, - 1 ).applyQuaternion( this.camera.quaternion );

	}

	moveForward( distance ) {

		// move forward parallel to the xz-plane
		// assumes camera.up is y-up

		const camera = this.camera;

		_vector.setFromMatrixColumn( camera.matrix, 0 );

		_vector.crossVectors( camera.up, _vector );

		camera.position.addScaledVector( _vector, distance );

	}

	moveRight( distance ) {
		const camera = this.camera;
		_vector.setFromMatrixColumn( camera.matrix, 0 );
		camera.position.addScaledVector( _vector, distance );
	}

	activate() {
		this.active = true;
	}

	deactivate() {
		this.active = false;
	}

	isActive() {
		return this.active;
	}

}

// event listeners

function onTouchStart( event ) {

	const width = this.domElement.getBoundingClientRect().width;


	if (this.active){
		if (event.touches[0].clientX > width/2){
			if(this.turnTouchId === undefined){
				this.turnTouchId = event.touches[0].identifier;
				this.turnX = event.touches[0].clientX;
				this.turnY = event.touches[0].clientY;
				this.turnUsed = true;
			}
		} else {
			if(this.moveTouchId === undefined){
				this.moveTouchId = event.touches[0].identifier;
				this.moveX = event.touches[0].clientX;
				this.moveY = event.touches[0].clientY;
				this.moveUsed = true;
			}
		}
	}
}

function onTouchMove( event ) {

	if(this.turnTouchId !== undefined){

		for (let i = 0; i < event.touches.length; i++) {
			let touch = event.touches[i];

		  if (touch.identifier === this.turnTouchId){

			const movementX =  (touch.clientX - this.turnX) * 1.5;
			const movementY = (touch.clientY - this.turnY) * 1.5;

			this.turnX = touch.clientX;
			this.turnY = touch.clientY;

			if (Math.abs(movementX) > Math.abs(movementY)){
				if (Math.abs(movementX) > 2){
					if (movementX > 0){
						this.lookingUp = false;
						this.lookingDown = false;
						this.lookingLeft = false;
						this.lookingRight = true;
					} else {
						this.lookingUp = false;
						this.lookingDown = false;
						this.lookingLeft = true;
						this.lookingRight = false;
					}
				}
			} else {
				if (Math.abs(movementY) > 2) {
					if (movementY > 0) {
						this.lookingUp = false;
						this.lookingDown = true;
						this.lookingLeft = false;
						this.lookingRight = false;
					} else {
						this.lookingUp = true;
						this.lookingDown = false;
						this.lookingLeft = false;
						this.lookingRight = false;
					}
				}
			}

			const camera = this.camera;
			_euler.setFromQuaternion( camera.quaternion );

			_euler.y -= movementX * 0.002 * this.pointerSpeed;
			_euler.x -= movementY * 0.002 * this.pointerSpeed;

			_euler.x = Math.max( _PI_2 - this.maxPolarAngle, Math.min( _PI_2 - this.minPolarAngle, _euler.x ) );

			camera.quaternion.setFromEuler( _euler );

			this.dispatchEvent( _changeEvent );

		  }
		}
	}
	if(this.moveTouchId !== undefined){

		for (let i = 0; i < event.touches.length; i++) {
			let touch = event.touches[i];

		  if (touch.identifier === this.moveTouchId){

			const movementX =  touch.clientX - this.moveX;
			const movementY = touch.clientY - this.moveY;

			// console.log("moving", movementX);

			this.moveX = touch.clientX;
			this.moveY = touch.clientY;

			if (Math.abs(movementX) > Math.abs(movementY)){
				if (Math.abs(movementX) > 2){
					if (movementX > 0){
						this.Forward = false;
						this.Backward = false;
						this.Left = false;
						this.Right = true;
					} else {
						this.Forward = false;
						this.Backward = false;
						this.Left = true;
						this.Right = false;
					}
				}
			} else {
				if (Math.abs(movementY) > 2) {
					if (movementY > 0) {
						this.Forward = false;
						this.Backward = true;
						this.Left = false;
						this.Right = false;
					} else {
						this.Forward = true;
						this.Backward = false;
						this.Left = false;
						this.Right = false;
					}
				}
			}

			this.dispatchEvent( _changeEvent );
		  }
		}
	}
}

function onTouchEnd( event ) {

	if(this.turnTouchId !== undefined){
		for (let i = 0; i < event.changedTouches.length; i++) {
			let touch = event.changedTouches[i];
		  if (touch.identifier === this.turnTouchId){
			this.turnTouchId = undefined;
		  }
		}
	}

	if(this.moveTouchId !== undefined){
		for (let i = 0; i < event.changedTouches.length; i++) {
			let touch = event.changedTouches[i];
		  if (touch.identifier === this.moveTouchId){
			this.moveTouchId = undefined;
			this.Forward = false;
			this.Backward = false;
			this.Left = false;
			this.Right = false;
			this.dispatchEvent( _changeEvent );
		  }
		}
	}
}

export { SwipeControls };
